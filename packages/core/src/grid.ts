// ============================================================================
// createGrid() — Main factory function
// ============================================================================

import type {
  GridOptions,
  GridInstance,
  GridEvents,
  GridState,
  GridPlugin,
  Selection,
  ScrollState,
  ColumnDef,
  CellPosition,
  KeyBinding,
  Command,
  PluginContext,
  HierarchyConfig,
  CellChange,
} from './types';
import { EventEmitter } from './events/emitter';
import { StateStore } from './state/store';
import { PluginRegistry } from './plugin/registry';
import { ColumnManager } from './columns/manager';
import { VirtualizationEngine } from './virtualization/engine';
import type { LayoutMeasurements } from './virtualization/engine';
import { RenderingPipeline } from './rendering/pipeline';
import { SelectionLayer } from './rendering/layers';
import { createEmptySelection, createCellSelection, extendSelection, addRangeToSelection, normalizeSelection } from './selection/model';
import { navigateCell, navigateTab, getNavigationDirection } from './keyboard/navigation';
import { computeZoneDimensions } from './virtualization/layout';
import { createFilterPanel, type FilterApi } from './ui/filter-panel';
import { createContextMenu } from './ui/context-menu';
import { createTooltip } from './ui/tooltip';
import { startColumnResize as startColumnResizeDrag } from './ui/column-resize';
import { startFreezeClipDrag as startFreezeClipDragUI } from './ui/freeze-clip-drag';
import { scrollCellIntoView as scrollCellIntoViewUI } from './ui/scroll-into-view';
import {
  buildHeaderContextMenuItems,
  type HeaderContextMenuSortApi,
  type HeaderContextMenuFilterApi,
  type HeaderContextMenuFilter,
} from './ui/header-context-menu';
import { createHeaderRenderer, type HeaderRenderer } from './rendering/headers';
import { createPinnedRowRenderer, getPinnedRowsHeight } from './rendering/pinned-rows';
import { buildHierarchyState, buildInitialExpandedSet } from './hierarchy/build';

import { clamp, getCellValue, snapToDevicePixel } from './utils';

// Minimal ambient `process` declaration so bundlers can statically dead-code
// eliminate dev-mode warnings when consumers build with NODE_ENV=production.
declare const process: { env: { NODE_ENV?: string } };

const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_HEADER_HEIGHT = 40;

export function createGrid<
  TData = unknown,
  TContext = unknown,
  const TPlugins extends readonly GridPlugin[] = readonly GridPlugin[],
>(options: GridOptions<TData, TContext, TPlugins>): GridInstance<TData, TPlugins> {
  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------
  const emitter = new EventEmitter<GridEvents<TData>>();
  const columnManager = new ColumnManager<TData>();
  const virtualization = new VirtualizationEngine(
    options.virtualization?.overscanRows ?? 20,
    options.virtualization?.overscanColumns ?? 5,
  );
  const rendering = new RenderingPipeline<TData>();
  const frozenRendering = new RenderingPipeline<TData>();
  rendering.getRowStyle = options.rowStyle;
  frozenRendering.getRowStyle = options.rowStyle;
  const pluginRegistry = new PluginRegistry();
  const keyBindings: KeyBinding[] = [];
  const commands = new Map<string, Command>();

  // Resolve selection options once; used throughout grid lifecycle
  const normalizedSelection = normalizeSelection(options.selection);

  // Stable row-identity resolver.
  // Priority: top-level getRowId > hierarchy.getRowId > index fallback.
  // The hierarchy plugin always reads options.hierarchy?.getRowId for its own
  // state (unchanged). This resolver is only used for selection-stability on
  // setData and any future identity-sensitive paths in core.
  const resolveRowId: (row: TData, idx: number) => string | number =
    options.getRowId ??
    options.hierarchy?.getRowId ??
    ((_row: TData, idx: number) => idx);

  // Closure-over-scope: store on a ref so option swaps don't invalidate column
  // identity. Read at render time so handler swaps are picked up without re-init.
  const contextRef: { current: unknown } = { current: options.context };
  rendering.contextRef = contextRef;
  frozenRendering.contextRef = contextRef;

  function setContext(context: unknown): void {
    contextRef.current = context;
    // No notify — context is read every render via the ref; subscribers don't need
    // a separate signal. (If a re-render is needed for a context-only swap, the
    // caller can invoke grid.refresh().)
  }

  let container: HTMLElement | null = null;
  let viewport: HTMLElement | null = null;
  let fakeScrollbar: HTMLElement | null = null;
  let scrollSizer: HTMLElement | null = null;
  let headerContainer: HTMLElement | null = null;
  let cellContainer: HTMLElement | null = null;
  let frozenColOverlay: HTMLElement | null = null;
  let frozenHeaderOverlay: HTMLElement | null = null;
  let frozenCellOverlay: HTMLElement | null = null;
  let selectionLayer: SelectionLayer | null = null;
  let pinnedTopContainer: HTMLElement | null = null;
  let pinnedBottomContainer: HTMLElement | null = null;
  let frozenPinnedTopContainer: HTMLElement | null = null;
  let frozenPinnedBottomContainer: HTMLElement | null = null;
  let freezeClipHandle: HTMLElement | null = null;
  let freezeClipIndicator: HTMLElement | null = null;
  /** Current clip width in pixels. null = no clip active (full frozen width). */
  let freezeClipWidth: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let mounted = false;

  const singleHeaderRowHeight = options.headerHeight ?? DEFAULT_HEADER_HEIGHT;
  const headerRows = options.headers;
  const headerHeight = headerRows
    ? headerRows.reduce((sum, row) => sum + (row.height ?? singleHeaderRowHeight), 0)
    : singleHeaderRowHeight;

  // Resolve row height function
  const getRowHeight =
    typeof options.rowHeight === 'function'
      ? options.rowHeight
      : () => options.rowHeight as number ?? DEFAULT_ROW_HEIGHT;

  // Initialize columns
  columnManager.setColumns(options.columns);

  // Dev-mode: warn when a column's field isn't a property on the first data row.
  // Deferred to after setColumns so we can compare against the user-provided (non-normalized)
  // columns and skip the auto-fill fallthrough case.
  if (process.env.NODE_ENV !== 'production') {
    if (options.data.length > 0) {
      columnManager.validateAgainstSample(options.columns, options.data[0] as TData);
    }
  }

  // Initialize state store (use normalized columns from manager)
  const initialState: GridState<TData> = {
    data: options.data,
    columns: columnManager.getColumns(),
    columnWidths: columnManager.getWidths(),
    rowHeights: typeof options.rowHeight === 'function'
      ? options.data.map((_, i) => getRowHeight(i))
      : [], // uniform height — no per-row array needed
    scrollTop: 0,
    scrollLeft: 0,
    visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
    selection: createEmptySelection(),
    frozen: { top: options.frozen?.top ?? 0, left: options.frozen?.left ?? 0 },
    pinned: { top: options.pinned?.top ?? [], bottom: options.pinned?.bottom ?? [] },
    hierarchyState: null,
    pluginState: {} as GridState<TData>['pluginState'],
  };

  const store = new StateStore<TData>(initialState);

  // ---------------------------------------------------------------------------
  // Hierarchy (row tree) support
  // ---------------------------------------------------------------------------

  const hierarchyConfig = options.hierarchy as HierarchyConfig<TData> | undefined;

  /** Rebuild hierarchy state from current data + current expanded set */
  function rebuildHierarchy(): void {
    if (!hierarchyConfig) return;
    const state = store.getState();
    const currentExpanded = state.hierarchyState?.expandedRows ?? new Set<string | number>();
    const hierarchyState = buildHierarchyState(state.data, currentExpanded, hierarchyConfig);
    store.update('hierarchy', () => ({ hierarchyState }));
  }

  /** Initialize hierarchy if configured */
  if (hierarchyConfig) {
    const defaultExpanded = hierarchyConfig.defaultExpanded !== false; // default true
    const initialExpanded = buildInitialExpandedSet(options.data, hierarchyConfig, defaultExpanded);
    const hierarchyState = buildHierarchyState(options.data, initialExpanded, hierarchyConfig);
    store.update('hierarchy', () => ({ hierarchyState }));
  }

  // Resolve freeze clip config
  const freezeClipConfig = (() => {
    const opt = options.frozen?.clip;
    if (opt === false || opt === undefined) return { enabled: false, minVisible: 1 };
    if (opt === true) return { enabled: true, minVisible: 1 };
    return { enabled: true, minVisible: opt.minVisible ?? 1 };
  })();

  // Forward store changes to user callbacks
  if (options.onSelectionChange) {
    store.subscribe('selection', () => {
      options.onSelectionChange!(store.getState().selection);
    });
  }

  // ---------------------------------------------------------------------------
  // Measurements
  // ---------------------------------------------------------------------------

  /** Get the effective row count (hierarchy-aware) */
  function getEffectiveRowCount(): number {
    const state = store.getState();
    return state.hierarchyState ? state.hierarchyState.visibleRows.length : state.data.length;
  }

  /** Get visible data array: when hierarchy is active, returns rows in tree-walk order;
   *  otherwise returns the raw data array (no copy). */
  function getVisibleData(): TData[] {
    const state = store.getState();
    if (!state.hierarchyState) return state.data;
    return state.hierarchyState.visibleRows.map(i => state.data[i]!);
  }

  /** Map a visible row index to the original data index */
  function visibleToDataIndex(visibleIndex: number): number {
    const state = store.getState();
    if (!state.hierarchyState) return visibleIndex;
    return state.hierarchyState.visibleRows[visibleIndex] ?? visibleIndex;
  }

  /** Sync aria-rowcount/aria-colcount on the grid container. */
  function updateAriaCounts(): void {
    if (!container) return;
    const state = store.getState();
    container.setAttribute('aria-rowcount', String(getEffectiveRowCount()));
    container.setAttribute('aria-colcount', String(state.columns.length));
  }

  function recomputeMeasurements(): void {
    const state = store.getState();
    const rowCount = getEffectiveRowCount();
    const hs = state.hierarchyState;

    // Apply flex sizing when viewport is available (after mount).
    if (viewport) {
      columnManager.recomputeFlexWidths(viewport.clientWidth);
    }

    virtualization.recompute(
      rowCount,
      state.columns.length,
      (i) => {
        // When hierarchy is active, map visible position to data index for height lookup
        const dataIdx = hs ? (hs.visibleRows[i] ?? i) : i;
        return state.rowHeights.length > 0 ? (state.rowHeights[dataIdx] ?? DEFAULT_ROW_HEIGHT) : getRowHeight(dataIdx);
      },
      (i) => columnManager.getWidth(i),
    );
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  let renderPending = false;
  let headersDirty = true; // track whether headers need re-rendering
  function scheduleRender(): void {
    if (!viewport || !cellContainer || renderPending) return;
    renderPending = true;
    headersDirty = true;
    requestAnimationFrame(() => {
      renderPending = false;
      render();
    });
  }

  function render(): void {
    if (!viewport || !scrollSizer || !cellContainer) return;

    const state = store.getState();
    const measurements = virtualization.getMeasurements();
    const visibleData = getVisibleData();

    // Update scroll sizer (inside fakeScrollbar) for scrollbar dimensions.
    // The sizer must be tall enough so that at max scrollTop the last row
    // is fully visible inside the viewport (which is smaller than fakeScrollbar
    // due to the scrollbar gutter). Formula:
    //   maxScrollTop + (vpHeight - headerHeight) = totalHeight
    //   sizerHeight - sbClientHeight + vpHeight - headerHeight = totalHeight
    //   sizerHeight = totalHeight + sbClientHeight - vpHeight + headerHeight
    const sbClientHeight = fakeScrollbar?.clientHeight ?? viewport.clientHeight;
    const sbClientWidth = fakeScrollbar?.clientWidth ?? viewport.clientWidth;
    const pinnedTopH = getPinnedTopHeight();
    const pinnedBottomH = getPinnedBottomHeight();
    const vpHeight = viewport.clientHeight;
    const vpWidth = viewport.clientWidth;
    const clipOffset = getFreezeClipOffset();
    scrollSizer.style.width = `${measurements.totalWidth + sbClientWidth - vpWidth - clipOffset}px`;
    scrollSizer.style.height = `${measurements.totalHeight + sbClientHeight - vpHeight + headerHeight + pinnedTopH + pinnedBottomH}px`;

    // Cell container sized to full data dimensions (cells at data-space positions).
    // Container-level transform shifts them into the viewport.
    cellContainer.style.width = `${measurements.totalWidth}px`;
    cellContainer.style.height = `${measurements.totalHeight}px`;
    // Header width must also match for horizontal scrolling
    headerContainer!.style.width = `${measurements.totalWidth}px`;

    // Skip header re-render on scroll-only updates (headers are sticky / don't change)
    if (headersDirty) {
      renderHeaders(state, measurements);
      headersDirty = false;
    }

    // Compute frozen dimensions
    const zoneDims = computeZoneDimensions(
      {
        frozenTopRows: state.frozen.top,
        frozenBottomRows: 0,
        frozenLeftColumns: state.frozen.left,
        frozenRightColumns: 0,
      },
      (i) => state.rowHeights.length > 0 ? (state.rowHeights[i] ?? DEFAULT_ROW_HEIGHT) : getRowHeight(i),
      (i) => columnManager.getWidth(i),
    );

    // Compute visible range — use viewport dimensions (the actual visible clip area)
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    // scrollTop maps directly to data offset (scroll sizer = data height only)
    const dataScrollTop = state.scrollTop;

    // When freeze clip is active, the effective frozen width is smaller,
    // so more scrollable columns are visible in the viewport.
    const effectiveFrozenLeftWidth = freezeClipWidth !== null
      ? clamp(freezeClipWidth, 0, zoneDims.frozenLeftWidth)
      : zoneDims.frozenLeftWidth;

    const visibleRange = virtualization.computeVisibleRange(
      dataScrollTop,
      state.scrollLeft,
      viewportWidth,
      viewportHeight - headerHeight - pinnedTopH - pinnedBottomH,
      zoneDims.frozenTopHeight,
      zoneDims.frozenBottomHeight,
      effectiveFrozenLeftWidth,
      zoneDims.frozenRightWidth,
    );

    // Reuse same object ref when indices unchanged so store skip kicks in
    const prevRange = state.visibleRange;
    if (
      prevRange.startRow !== visibleRange.startRow ||
      prevRange.endRow !== visibleRange.endRow ||
      prevRange.startCol !== visibleRange.startCol ||
      prevRange.endCol !== visibleRange.endCol
    ) {
      store.update('visibleRange', () => ({ visibleRange }));
    }

    // Render non-frozen cells into main cell container
    const frozenCols = state.frozen.left;
    const mainStartCol = Math.max(visibleRange.startCol, frozenCols);

    rendering.renderCells(
      cellContainer,
      visibleRange.startRow,
      visibleRange.endRow,
      mainStartCol,
      visibleRange.endCol,
      visibleData,
      state.columns,
      measurements,
      state.selection,
      0, // no frozen col handling in main pipeline
      0,
      state.frozen.top,
    );

    // Render frozen columns into separate overlay (outside scroll container)
    if (frozenCellOverlay && frozenCols > 0) {
      frozenCellOverlay.style.height = `${measurements.totalHeight}px`;
      frozenRendering.renderCells(
        frozenCellOverlay,
        visibleRange.startRow,
        visibleRange.endRow,
        0,
        frozenCols,
        visibleData,
        state.columns,
        measurements,
        state.selection,
        frozenCols, // apply last-frozen-col class
        0,
        state.frozen.top,
      );

      // Update frozen overlay width and clip scroll container
      const frozenWidth = measurements.colOffsets[frozenCols]!;
      frozenColOverlay!.style.width = `${frozenWidth}px`;
      // When content is shorter than viewport, constrain height so shadow
      // doesn't extend past data. Otherwise let CSS bottom handle it.
      const contentHeight = measurements.totalHeight + headerHeight + pinnedTopH + pinnedBottomH;
      if (contentHeight < viewport!.clientHeight) {
        frozenColOverlay!.style.height = `${contentHeight}px`;
        frozenColOverlay!.style.bottom = 'auto';
      } else {
        frozenColOverlay!.style.height = '';
        frozenColOverlay!.style.bottom = 'var(--bg-scrollbar-size, 10px)';
      }
    }

    // Freeze clip: constrain frozen overlay width when clip is active
    if (freezeClipHandle && frozenColOverlay) {
      const fullFrozenWidth = measurements.colOffsets[frozenCols]!;
      const clipContentHeight = measurements.totalHeight + headerHeight;
      const handleHeight = Math.min(clipContentHeight, viewport!.clientHeight);

      if (freezeClipWidth === null) {
        // No clip active — handle sits at the frozen boundary
        freezeClipHandle.style.left = `${fullFrozenWidth}px`;
        frozenColOverlay.style.width = `${fullFrozenWidth}px`;
      } else {
        // Clip active — constrain overlay width, position handle at clip edge
        const clampedWidth = clamp(freezeClipWidth, 0, fullFrozenWidth);
        frozenColOverlay.style.width = `${clampedWidth}px`;
        freezeClipHandle.style.left = `${clampedWidth}px`;
      }
      // Re-apply scroll transforms with updated clip offset
      const scrollState = store.getState();
      const clipOffset = getFreezeClipOffset();
      if (cellContainer) {
        cellContainer.style.transform = `translate3d(${-scrollState.scrollLeft - clipOffset}px, ${-scrollState.scrollTop}px, 0)`;
      }
      if (headerContainer) {
        headerContainer.style.transform = `translate3d(${-scrollState.scrollLeft - clipOffset}px, 0, 0)`;
      }
      freezeClipHandle.style.height = `${handleHeight}px`;

      // Visual hint: show a subtle clipped-edge indicator
      if (freezeClipIndicator) {
        const isClipped = freezeClipWidth !== null && freezeClipWidth < fullFrozenWidth;
        if (isClipped) {
          const clampedWidth = clamp(freezeClipWidth!, 0, fullFrozenWidth);
          freezeClipIndicator.style.display = '';
          freezeClipIndicator.style.left = `${clampedWidth}px`;
          freezeClipIndicator.style.top = '0';
          freezeClipIndicator.style.height = `${handleHeight}px`;
        } else {
          freezeClipIndicator.style.display = 'none';
        }
      }

    }

    // Render pinned rows (always re-render — cheap since typically 1-3 rows)
    if (pinnedTopContainer) {
      const wrapper = pinnedTopContainer.parentElement;
      if (pinnedTopH > 0) {
        renderPinnedRows(pinnedTopContainer, state.pinned.top, state.columns, measurements, frozenCols);
        pinnedTopContainer.style.height = `${pinnedTopH}px`;
        pinnedTopContainer.style.width = `${measurements.totalWidth}px`;
        pinnedTopContainer.style.transform = `translate3d(${-state.scrollLeft - clipOffset}px, 0, 0)`;
        if (wrapper) { wrapper.style.display = ''; wrapper.style.height = `${pinnedTopH}px`; }
      } else if (wrapper) {
        wrapper.style.display = 'none'; wrapper.style.height = '0';
      }
    }
    if (pinnedBottomContainer) {
      const wrapper = pinnedBottomContainer.parentElement;
      if (pinnedBottomH > 0) {
        renderPinnedRows(pinnedBottomContainer, state.pinned.bottom, state.columns, measurements, frozenCols);
        pinnedBottomContainer.style.height = `${pinnedBottomH}px`;
        pinnedBottomContainer.style.width = `${measurements.totalWidth}px`;
        pinnedBottomContainer.style.transform = `translate3d(${-state.scrollLeft - clipOffset}px, 0, 0)`;
        if (wrapper) {
          wrapper.style.display = '';
          wrapper.style.height = `${pinnedBottomH}px`;
          // When content is shorter than viewport, stick to last row instead of viewport bottom
          const dataBottom = headerHeight + pinnedTopH + measurements.totalHeight;
          const viewportH = viewport!.clientHeight;
          if (dataBottom + pinnedBottomH < viewportH) {
            wrapper.style.bottom = 'auto';
            wrapper.style.top = `${dataBottom}px`;
          } else {
            wrapper.style.top = '';
            wrapper.style.bottom = '0';
          }
        }
      } else if (wrapper) {
        wrapper.style.display = 'none'; wrapper.style.height = '0';
      }
    }
    // Render frozen pinned rows (frozen columns only, no horizontal scroll)
    if (frozenPinnedTopContainer && frozenCols > 0) {
      renderPinnedRows(frozenPinnedTopContainer, state.pinned.top, state.columns, measurements, 0, frozenCols);
      frozenPinnedTopContainer.style.height = `${pinnedTopH}px`;
      frozenPinnedTopContainer.style.display = pinnedTopH > 0 ? '' : 'none';
    }
    if (frozenPinnedBottomContainer && frozenCols > 0) {
      renderPinnedRows(frozenPinnedBottomContainer, state.pinned.bottom, state.columns, measurements, 0, frozenCols);
      frozenPinnedBottomContainer.style.height = `${pinnedBottomH}px`;
      frozenPinnedBottomContainer.style.display = pinnedBottomH > 0 ? '' : 'none';
      // Match main pinned bottom position
      const dataBottom = headerHeight + pinnedTopH + measurements.totalHeight;
      const viewportH = viewport!.clientHeight;
      if (dataBottom + pinnedBottomH < viewportH) {
        frozenPinnedBottomContainer.style.bottom = 'auto';
        frozenPinnedBottomContainer.style.top = `${dataBottom}px`;
      } else {
        frozenPinnedBottomContainer.style.top = '';
        frozenPinnedBottomContainer.style.bottom = '0';
      }
    }

    // Update cell container top offset (may change when pinned top rows are set dynamically)
    if (cellContainer) {
      cellContainer.style.top = `${headerHeight + pinnedTopH}px`;
    }
    // Update frozen cell overlay top offset to match
    if (frozenCellOverlay) {
      frozenCellOverlay.style.top = `${headerHeight + pinnedTopH}px`;
    }

    // Render selection layer (readonly cols are cached on ColumnManager, rebuilt on setColumns)
    selectionLayer?.render(state.selection, measurements, columnManager.getReadonlyColumns());

    emitter.emit('render', visibleRange);
  }

  // ---------------------------------------------------------------------------
  // Pinned row rendering (delegated to rendering/pinned-rows.ts)
  // ---------------------------------------------------------------------------

  const pinnedRenderer = createPinnedRowRenderer<TData>({
    rendering,
    rowHeight: options.rowHeight,
    contextRef,
  });

  function renderPinnedRows(
    pinnedContainer: HTMLElement,
    rows: TData[],
    columns: ColumnDef<TData>[],
    measurements: LayoutMeasurements,
    startCol?: number,
    endCol?: number,
  ): void {
    pinnedRenderer.render(pinnedContainer, rows, columns, measurements, startCol, endCol);
  }

  function getPinnedTopHeight(): number {
    return getPinnedRowsHeight(store.getState().pinned.top.length, options.rowHeight);
  }

  function getPinnedBottomHeight(): number {
    return getPinnedRowsHeight(store.getState().pinned.bottom.length, options.rowHeight);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  /** Forward wheel events from viewport to fakeScrollbar */
  function handleWheel(e: WheelEvent): void {
    if (!fakeScrollbar) return;
    e.preventDefault();
    // Normalize deltaMode: 0=pixels, 1=lines(~40px), 2=pages
    const multiplier = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
    const dy = e.deltaY * multiplier;
    const dx = e.deltaX * multiplier;
    // Shift+scroll → horizontal scroll (standard UX convention)
    if (e.shiftKey && dx === 0) {
      fakeScrollbar.scrollLeft += dy;
    } else {
      fakeScrollbar.scrollTop += dy;
      fakeScrollbar.scrollLeft += dx;
    }
  }

  /** Pixel offset to shift scrollable content left when freeze clip is active. */
  function getFreezeClipOffset(): number {
    if (freezeClipWidth === null) return 0;
    const measurements = virtualization.getMeasurements();
    const state = store.getState();
    const fullFrozenWidth = measurements.colOffsets[state.frozen.left]!;
    return Math.max(0, fullFrozenWidth - clamp(freezeClipWidth, 0, fullFrozenWidth));
  }

  function handleScroll(): void {
    if (!fakeScrollbar) return;
    const scrollTop = fakeScrollbar.scrollTop;
    const scrollLeft = fakeScrollbar.scrollLeft;
    store.setScroll(scrollTop, scrollLeft);

    // Translate cell container to match scroll position.
    // Cells stay at data-space positions; the container transform shifts
    // them into the viewport. scrollTop maps directly to data offset
    // since the scroll sizer only covers data height (headers are fixed).
    // When freeze clip is active, shift content left by clipOffset so
    // scrollable cells fill the space freed by the clipped frozen area.
    const clipOffset = getFreezeClipOffset();
    if (cellContainer) {
      cellContainer.style.transform = `translate3d(${-scrollLeft - clipOffset}px, ${-scrollTop}px, 0)`;
    }
    // Translate headers horizontally
    if (headerContainer) {
      headerContainer.style.transform = `translate3d(${-scrollLeft - clipOffset}px, 0, 0)`;
    }
    // Sync frozen cell overlay vertical position (same offset as main cellContainer)
    if (frozenCellOverlay) {
      frozenCellOverlay.style.transform = `translate3d(0, ${-snapToDevicePixel(scrollTop)}px, 0)`;
    }
    // Sync pinned row horizontal scroll in the fast path (before rAF render)
    if (pinnedTopContainer) {
      pinnedTopContainer.style.transform = `translate3d(${-scrollLeft - clipOffset}px, 0, 0)`;
    }
    if (pinnedBottomContainer) {
      pinnedBottomContainer.style.transform = `translate3d(${-scrollLeft - clipOffset}px, 0, 0)`;
    }

    emitter.emit('scroll', { scrollTop, scrollLeft });

    // Render via rAF — safe because cells stay visible via container transform.
    // No blank flash since old cells remain in place until new ones are created.
    scheduleRender();
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!cellContainer) return;

    // Don't interfere with active editor inputs
    const target = event.target as HTMLElement;
    if (target.classList.contains('bg-cell-editor') || target.closest('.bg-cell--editing')) {
      return;
    }

    const cell = getCellFromEvent(event);
    if (!cell) return;

    // Always emit cell:click (editing and other plugins depend on it)
    emitter.emit('cell:click', cell, event as unknown as MouseEvent);

    const selectionMode = normalizedSelection.mode;
    if (selectionMode === 'off') return;

    const isCtrlHeld = event.ctrlKey || event.metaKey;
    const allowRange = selectionMode === 'range';
    const allowMultiRange = allowRange && normalizedSelection.multiRange;

    if (event.shiftKey && allowRange && store.getState().selection.active) {
      const newSelection = extendSelection(store.getState().selection, cell);
      store.setSelection(newSelection);
    } else if (isCtrlHeld && allowMultiRange) {
      const currentSelection = store.getState().selection;
      const cellRange = {
        startRow: cell.rowIndex,
        endRow: cell.rowIndex,
        startCol: cell.colIndex,
        endCol: cell.colIndex,
      };
      const newSelection = addRangeToSelection(currentSelection, cellRange);
      store.setSelection({ ...newSelection, active: cell });
    } else {
      store.setSelection(createCellSelection(cell));
    }

    emitter.emit('selection:change', store.getState().selection);
    scheduleRender();
  }

  function handleDblClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('bg-cell-editor') || target.closest('.bg-cell--editing')) {
      return;
    }
    const cell = getCellFromEvent(event);
    if (cell) {
      emitter.emit('cell:dblclick', cell, event);
    }
  }

  function handleCellMouseOver(event: MouseEvent): void {
    const cell = (event.target as HTMLElement).closest('.bg-cell') as HTMLElement | null;
    if (cell && cell.scrollWidth > cell.clientWidth) {
      showTooltip(cell, cell.textContent ?? '');
    }
  }

  function handleCellMouseOut(event: MouseEvent): void {
    const related = (event as MouseEvent).relatedTarget as HTMLElement | null;
    const cell = (event.target as HTMLElement).closest('.bg-cell');
    if (cell && !cell.contains(related)) {
      dismissTooltip();
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    const state = store.getState();

    // Run plugin key bindings first (higher priority first)
    // Only call handler when binding.key matches the event key (or '*' for catch-all)
    const sorted = [...keyBindings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const binding of sorted) {
      if (binding.key !== '*' && binding.key !== event.key) continue;
      const result = binding.handler(event, state.selection.active);
      if (result === true) {
        event.preventDefault();
        return;
      }
    }

    emitter.emit('key:down', event, state.selection.active);

    if (!state.selection.active) return;

    const bounds = {
      rowCount: getEffectiveRowCount(),
      colCount: state.columns.length,
      frozenTopRows: state.frozen.top,
      frozenLeftColumns: state.frozen.left,
    };

    // Arrow key navigation
    const direction = getNavigationDirection(event);
    if (direction) {
      event.preventDefault();
      if (event.shiftKey && normalizedSelection.mode === 'range') {
        // Shift+arrow: extend range (range mode only)
        const lastRange = state.selection.ranges[state.selection.ranges.length - 1];
        if (lastRange) {
          const end = navigateCell(
            { rowIndex: lastRange.endRow, colIndex: lastRange.endCol },
            direction,
            bounds,
          );
          const newSelection = extendSelection(state.selection, end);
          store.setSelection(newSelection);
        }
      } else {
        const newActive = navigateCell(state.selection.active, direction, bounds);
        store.setSelection(createCellSelection(newActive));
        scrollCellIntoView(newActive);
      }
      emitter.emit('selection:change', store.getState().selection);
      scheduleRender();
      return;
    }

    // Tab
    if (event.key === 'Tab') {
      event.preventDefault();
      const newActive = navigateTab(state.selection.active, !event.shiftKey, bounds);
      store.setSelection(createCellSelection(newActive));
      scrollCellIntoView(newActive);
      emitter.emit('key:tab', state.selection.active, event.shiftKey ? 'backward' : 'forward');
      emitter.emit('selection:change', store.getState().selection);
      scheduleRender();
      return;
    }

    // Enter
    if (event.key === 'Enter') {
      emitter.emit('key:enter', state.selection.active);
      return;
    }

    // Escape
    if (event.key === 'Escape') {
      emitter.emit('key:escape', state.selection.active);
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Header rendering (delegated to rendering/headers.ts)
  // ---------------------------------------------------------------------------

  let headerRenderer: HeaderRenderer<TData> | null = null;

  function renderHeaders(
    state: GridState<TData>,
    measurements: LayoutMeasurements,
  ): void {
    headerRenderer?.render(state, measurements);
  }


  // ---------------------------------------------------------------------------
  // Scroll cell into view
  // ---------------------------------------------------------------------------

  function scrollCellIntoView(cell: CellPosition): void {
    const measurements = virtualization.getMeasurements();
    scrollCellIntoViewUI({
      cell,
      fakeScrollbar,
      viewport,
      colOffsets: measurements.colOffsets,
      rowOffsets: measurements.rowOffsets,
      headerHeight,
      frozenLeftColumns: store.getState().frozen.left,
    });
  }

  // ---------------------------------------------------------------------------
  // Column resize
  // ---------------------------------------------------------------------------

  function startColumnResize(colIndex: number, startEvent: PointerEvent): void {
    const column = columnManager.getColumns()[colIndex]!;
    startColumnResizeDrag({
      startEvent,
      startWidth: columnManager.getWidth(colIndex),
      minWidth: column.minWidth,
      onUpdate: (width) => instance.setColumnWidth(column.id, width),
    });
  }

  // ---------------------------------------------------------------------------
  // Freeze clip
  // ---------------------------------------------------------------------------

  function startFreezeClipDrag(startEvent: PointerEvent): void {
    const measurements = virtualization.getMeasurements();
    const state = store.getState();
    startFreezeClipDragUI({
      startEvent,
      containerRect: container!.getBoundingClientRect(),
      colOffsets: measurements.colOffsets,
      frozenLeftColumns: state.frozen.left,
      minVisibleColumns: freezeClipConfig.minVisible,
      setClipWidth: (width) => {
        freezeClipWidth = width;
        scheduleRender();
      },
      onComplete: (finalWidth, fullFrozenWidth) => {
        emitter.emit('frozen:clip', finalWidth, fullFrozenWidth);
      },
    });
  }

  function restoreAllFrozenColumns(): void {
    if (freezeClipWidth !== null) {
      freezeClipWidth = null;
      scheduleRender();
      const measurements = virtualization.getMeasurements();
      const state = store.getState();
      const fullFrozenWidth = measurements.colOffsets[state.frozen.left]!;
      emitter.emit('frozen:clip', fullFrozenWidth, fullFrozenWidth);
    }
  }

  // ---------------------------------------------------------------------------
  // Header context menu (DOM via ui/context-menu.ts, items collected here)
  // ---------------------------------------------------------------------------

  const contextMenu = createContextMenu();
  const dismissContextMenu = contextMenu.dismiss;

  function showHeaderContextMenu(event: MouseEvent, columnId: string): void {
    dismissContextMenu();
    const sortApi = pluginRegistry.getPlugin<HeaderContextMenuSortApi>('sorting');
    const filterApi = pluginRegistry.getPlugin<HeaderContextMenuFilterApi>('filtering');

    const items = buildHeaderContextMenuItems({
      columnId,
      sortApi,
      filterApi,
      onOpenFilterPanel: (colFiltered: HeaderContextMenuFilter | undefined) => {
        dismissContextMenu();
        showFilterPanel(
          event,
          columnId,
          colFiltered as { columnId: string; value: unknown; operator: string } | undefined,
        );
      },
    });

    contextMenu.show(event, items);
  }

  // ---------------------------------------------------------------------------
  // Filter Panel (delegated to ui/filter-panel.ts)
  // ---------------------------------------------------------------------------

  const filterPanel = createFilterPanel({
    getColumns: () => columnManager.getColumns(),
    getFilterApi: () => pluginRegistry.getPlugin<FilterApi>('filtering'),
  });
  const showFilterPanel = filterPanel.show;
  const dismissFilterPanel = filterPanel.dismiss;

  // ---------------------------------------------------------------------------
  // Cell tooltip (delegated to ui/tooltip.ts)
  // ---------------------------------------------------------------------------

  const tooltip = createTooltip();
  const showTooltip = tooltip.show;
  const dismissTooltip = tooltip.dismiss;

  function invalidateHeaders(): void {
    headerRenderer?.invalidate();
  }

  function getCellFromEvent(event: Event): CellPosition | null {
    const target = event.target as HTMLElement;
    const cell = target.closest('.bg-cell') as HTMLElement | null;
    if (!cell) return null;

    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(row) || isNaN(col)) return null;

    return { rowIndex: row, colIndex: col };
  }

  // ---------------------------------------------------------------------------
  // Grid instance
  // ---------------------------------------------------------------------------

  const pluginsProxy = new Proxy(Object.create(null) as Record<string, unknown>, {
    get(_target, key) {
      if (typeof key !== 'string') return undefined;
      return pluginRegistry.getPlugin(key);
    },
    has(_target, key) {
      if (typeof key !== 'string') return false;
      return pluginRegistry.getPlugin(key) !== undefined;
    },
    ownKeys() {
      return pluginRegistry.getAllPlugins().map((p) => p.id);
    },
    getOwnPropertyDescriptor(_target, key) {
      if (typeof key !== 'string') return undefined;
      const api = pluginRegistry.getPlugin(key);
      if (api === undefined) return undefined;
      return { configurable: true, enumerable: true, value: api, writable: false };
    },
  });

  // `$errorCodes` walks the current plugin set each lookup so addPlugin /
  // removePlugin reflect immediately without extra bookkeeping. The first
  // plugin to declare a given key wins — duplicate keys should be rare and
  // would indicate a name clash that the grid doesn't try to resolve.
  const errorCodesProxy = new Proxy(Object.create(null) as Record<string, string>, {
    get(_target, key) {
      if (typeof key !== 'string') return undefined;
      for (const plugin of pluginRegistry.getAllPlugins()) {
        const codes = plugin.$errorCodes;
        if (codes && Object.prototype.hasOwnProperty.call(codes, key)) {
          return codes[key];
        }
      }
      return undefined;
    },
    has(_target, key) {
      if (typeof key !== 'string') return false;
      for (const plugin of pluginRegistry.getAllPlugins()) {
        if (plugin.$errorCodes && Object.prototype.hasOwnProperty.call(plugin.$errorCodes, key)) {
          return true;
        }
      }
      return false;
    },
    ownKeys() {
      const seen = new Set<string>();
      for (const plugin of pluginRegistry.getAllPlugins()) {
        if (!plugin.$errorCodes) continue;
        for (const k of Object.keys(plugin.$errorCodes)) seen.add(k);
      }
      return Array.from(seen);
    },
    getOwnPropertyDescriptor(_target, key) {
      if (typeof key !== 'string') return undefined;
      for (const plugin of pluginRegistry.getAllPlugins()) {
        const codes = plugin.$errorCodes;
        if (codes && Object.prototype.hasOwnProperty.call(codes, key)) {
          return { configurable: true, enumerable: true, value: codes[key], writable: false };
        }
      }
      return undefined;
    },
  });

  const instance: GridInstance<TData, TPlugins> = {
    mount(el: HTMLElement): void {
      if (mounted) instance.unmount();

      // Dev-mode: warn about cellTypes that no plugin has registered. Plugins are
      // initialized at createGrid time (or via addPlugin), so by mount time all
      // built-in + user-added plugin cellType renderers should be in the pipeline.
      // This is only a warning — a cellType might still be registered later via addPlugin.
      if (process.env.NODE_ENV !== 'production') {
        const BUILTIN_CELL_TYPES = new Set([
          'text', 'number', 'currency', 'percent', 'date', 'bigint', 'select', 'boolean',
        ]);
        const warned = new Set<string>();
        for (const col of columnManager.getColumns()) {
          const ct = col.cellType;
          if (!ct) continue;
          if (BUILTIN_CELL_TYPES.has(ct)) continue;
          if (rendering.getCellType(ct)) continue;
          if (warned.has(ct)) continue;
          warned.add(ct);
          console.warn(
            `[better-grid] Column "${col.id}": cellType "${ct}" is not built-in and no plugin has registered a renderer for it.`,
          );
        }
      }

      container = el;
      container.classList.add('bg-grid');
      container.classList.toggle('bg-grid--bordered', options.bordered ?? true);
      container.classList.toggle('bg-grid--striped', options.striped ?? false);
      container.tabIndex = 0;
      container.setAttribute('role', 'grid');
      updateAriaCounts();

      // ── Fake scrollbar pattern (AG Grid-inspired) ──
      // Viewport (overflow:hidden) holds headers + cells — nothing scrolls natively.
      // FakeScrollbar (overflow:auto, sibling) holds a sizer for native scrollbar UI.
      // Scroll events on fakeScrollbar drive JS that translates headers/cells via
      // container-level transforms. Old cells stay visible during compositor-JS gap.

      // Viewport — clips content, no native scroll. Sits on top of
      // fakeScrollbar but sized smaller to expose scrollbar tracks.
      viewport = document.createElement('div');
      viewport.className = 'bg-grid__viewport';
      viewport.style.position = 'absolute';
      viewport.style.top = '0';
      viewport.style.left = '0';
      viewport.style.right = 'var(--bg-scrollbar-size, 10px)';
      viewport.style.bottom = 'var(--bg-scrollbar-size, 10px)';
      viewport.style.overflow = 'hidden';
      viewport.style.zIndex = '2';

      // Header container (absolute, translated horizontally by scrollLeft)
      headerContainer = document.createElement('div');
      headerContainer.className = 'bg-grid__headers';
      headerContainer.style.position = 'absolute';
      headerContainer.style.top = '0';
      headerContainer.style.left = '0';
      headerContainer.style.height = `${headerHeight}px`;
      headerContainer.style.zIndex = '10';
      headerContainer.style.background = '#f8f9fa';

      // Pinned top wrapper (clips overflow, positioned below headers)
      const pinnedTopWrapper = document.createElement('div');
      pinnedTopWrapper.className = 'bg-grid__pinned-top';
      pinnedTopWrapper.style.position = 'absolute';
      pinnedTopWrapper.style.top = `${headerHeight}px`;
      pinnedTopWrapper.style.left = '0';
      pinnedTopWrapper.style.right = '0';
      pinnedTopWrapper.style.overflow = 'hidden';
      pinnedTopWrapper.style.zIndex = '4';
      const pinnedTopH = getPinnedTopHeight();
      pinnedTopWrapper.style.height = `${pinnedTopH}px`;
      if (pinnedTopH === 0) pinnedTopWrapper.style.display = 'none';

      pinnedTopContainer = document.createElement('div');
      pinnedTopContainer.style.position = 'relative';
      pinnedTopWrapper.appendChild(pinnedTopContainer);

      // Cell container (absolute, translated by scroll offsets)
      cellContainer = document.createElement('div');
      cellContainer.className = 'bg-grid__cells';
      cellContainer.style.position = 'absolute';
      cellContainer.style.top = `${headerHeight + pinnedTopH}px`;
      cellContainer.style.left = '0';

      // Pinned bottom wrapper (clips overflow, positioned at bottom of viewport)
      const pinnedBottomWrapper = document.createElement('div');
      pinnedBottomWrapper.className = 'bg-grid__pinned-bottom';
      pinnedBottomWrapper.style.position = 'absolute';
      pinnedBottomWrapper.style.bottom = '0';
      pinnedBottomWrapper.style.left = '0';
      pinnedBottomWrapper.style.right = '0';
      pinnedBottomWrapper.style.overflow = 'hidden';
      pinnedBottomWrapper.style.zIndex = '4';
      const pinnedBottomH = getPinnedBottomHeight();
      pinnedBottomWrapper.style.height = `${pinnedBottomH}px`;
      if (pinnedBottomH === 0) pinnedBottomWrapper.style.display = 'none';

      pinnedBottomContainer = document.createElement('div');
      pinnedBottomContainer.style.position = 'relative';
      pinnedBottomWrapper.appendChild(pinnedBottomContainer);

      viewport.appendChild(headerContainer);
      viewport.appendChild(pinnedTopWrapper);
      viewport.appendChild(cellContainer);
      viewport.appendChild(pinnedBottomWrapper);

      // Fake scrollbar — provides native scrollbar UI via an oversized sizer.
      // Sits behind viewport; scrollbar tracks are exposed at the right/bottom
      // edges where the viewport is sized smaller to leave room.
      fakeScrollbar = document.createElement('div');
      // Stable selector — editing, gantt, row-actions plugins all query `.bg-grid__scroll`.
      fakeScrollbar.className = 'bg-grid__scroll';
      fakeScrollbar.style.position = 'absolute';
      // Inset the scrollbar-bearing element from the right/bottom so the
      // scrollbar track doesn't get clipped by a rounded-corner container.
      // Controlled via --bg-scrollbar-inset (default 0). Set e.g. 12px on
      // a grid whose wrapper has border-radius: 12px so the scrollbar sits
      // inside the rounded area.
      fakeScrollbar.style.top = '0';
      fakeScrollbar.style.left = '0';
      fakeScrollbar.style.right = 'var(--bg-scrollbar-inset, 0)';
      fakeScrollbar.style.bottom = 'var(--bg-scrollbar-inset, 0)';
      fakeScrollbar.style.overflow = 'auto';
      fakeScrollbar.style.zIndex = '1';

      scrollSizer = document.createElement('div');
      scrollSizer.className = 'bg-grid__sizer';
      fakeScrollbar.appendChild(scrollSizer);

      // Frozen column overlay — positioned absolutely over the grid,
      // doesn't participate in horizontal scroll. Syncs vertical scroll
      // via transform in the scroll handler (no lag since it never
      // moves horizontally with the scrollbar).
      const frozenLeftCols = options.frozen?.left ?? 0;
      if (frozenLeftCols > 0) {
        frozenColOverlay = document.createElement('div');
        frozenColOverlay.className = 'bg-grid__frozen-overlay';
        frozenColOverlay.style.position = 'absolute';
        frozenColOverlay.style.top = '0';
        frozenColOverlay.style.left = '0';
        // Match viewport bottom so pinned rows align pixel-perfectly
        frozenColOverlay.style.bottom = 'var(--bg-scrollbar-size, 10px)';
        frozenColOverlay.style.overflow = 'hidden';
        frozenColOverlay.style.zIndex = '8';

        // Frozen header row
        frozenHeaderOverlay = document.createElement('div');
        frozenHeaderOverlay.className = 'bg-grid__frozen-headers';
        frozenHeaderOverlay.style.position = 'absolute';
        frozenHeaderOverlay.style.top = '0';
        frozenHeaderOverlay.style.left = '0';
        frozenHeaderOverlay.style.right = '0';
        frozenHeaderOverlay.style.height = `${headerHeight}px`;
        frozenHeaderOverlay.style.zIndex = '12';
        frozenHeaderOverlay.style.background = 'var(--bg-header-bg, #f8f9fa)';

        // Frozen pinned top rows (between header and data cells)
        frozenPinnedTopContainer = document.createElement('div');
        frozenPinnedTopContainer.className = 'bg-grid__frozen-pinned-top';
        frozenPinnedTopContainer.style.position = 'absolute';
        frozenPinnedTopContainer.style.top = `${headerHeight}px`;
        frozenPinnedTopContainer.style.left = '0';
        frozenPinnedTopContainer.style.right = '0';
        frozenPinnedTopContainer.style.zIndex = '5';
        const fpTopH = getPinnedTopHeight();
        frozenPinnedTopContainer.style.height = `${fpTopH}px`;
        if (fpTopH === 0) frozenPinnedTopContainer.style.display = 'none';

        // Frozen data cells (scrolls vertically via transform)
        frozenCellOverlay = document.createElement('div');
        frozenCellOverlay.className = 'bg-grid__frozen-cells';
        frozenCellOverlay.style.position = 'absolute';
        frozenCellOverlay.style.top = `${headerHeight + fpTopH}px`;
        frozenCellOverlay.style.left = '0';
        frozenCellOverlay.style.right = '0';
        frozenCellOverlay.style.overflow = 'hidden';

        // Frozen pinned bottom rows (fixed at bottom of viewport)
        frozenPinnedBottomContainer = document.createElement('div');
        frozenPinnedBottomContainer.className = 'bg-grid__frozen-pinned-bottom';
        frozenPinnedBottomContainer.style.position = 'absolute';
        frozenPinnedBottomContainer.style.bottom = '0';
        frozenPinnedBottomContainer.style.left = '0';
        frozenPinnedBottomContainer.style.right = '0';
        frozenPinnedBottomContainer.style.zIndex = '5';
        const fpBottomH = getPinnedBottomHeight();
        frozenPinnedBottomContainer.style.height = `${fpBottomH}px`;
        if (fpBottomH === 0) frozenPinnedBottomContainer.style.display = 'none';

        frozenColOverlay.appendChild(frozenHeaderOverlay);
        frozenColOverlay.appendChild(frozenPinnedTopContainer);
        frozenColOverlay.appendChild(frozenCellOverlay);
        frozenColOverlay.appendChild(frozenPinnedBottomContainer);
      }

      container.appendChild(viewport);
      container.appendChild(fakeScrollbar);

      // Append frozen overlay AFTER viewport so it renders on top
      if (frozenColOverlay) {
        container.appendChild(frozenColOverlay);
      }

      // Initialize header renderer with DOM and callback deps
      headerRenderer = createHeaderRenderer<TData>({
        headerContainer: headerContainer!,
        frozenHeaderOverlay,
        headerRows,
        headerHeight,
        singleHeaderRowHeight,
        tooltip,
        hasFilterPlugin: () => !!pluginRegistry.getPlugin('filtering'),
        getSortState: (columnId) => {
          const sortApi = pluginRegistry.getPlugin<{
            getSortState: () => readonly { columnId: string; direction: 'asc' | 'desc' }[];
          }>('sorting');
          const sorted = sortApi?.getSortState().find((s) => s.columnId === columnId);
          return sorted
            ? (sorted.direction === 'asc' ? 'ascending' : 'descending')
            : 'none';
        },
        onHeaderClick: (columnId) => {
          for (const plugin of pluginRegistry.getAllPlugins()) {
            plugin.hooks?.onHeaderClick?.(columnId);
          }
        },
        onHeaderContextMenu: (event, columnId) => showHeaderContextMenu(event, columnId),
        onFilterButtonClick: (event, columnId) => showFilterPanel(event, columnId),
        onColumnResize: (colIndex, event) => startColumnResize(colIndex, event),
      });

      // Freeze clip handle
      if (frozenLeftCols > 0 && freezeClipConfig.enabled) {
        freezeClipHandle = document.createElement('div');
        freezeClipHandle.className = 'bg-freeze-clip-handle';
        container.appendChild(freezeClipHandle);

        freezeClipHandle.addEventListener('pointerdown', startFreezeClipDrag);
        freezeClipHandle.addEventListener('dblclick', restoreAllFrozenColumns);
        freezeClipHandle.addEventListener('mouseenter', (e: MouseEvent) => {
          const text = freezeClipWidth !== null
            ? 'Double-click to expand'
            : 'Drag to clip';
          showTooltip(freezeClipHandle!, text, e.clientX, e.clientY);
        });
        freezeClipHandle.addEventListener('mouseleave', dismissTooltip);

        freezeClipIndicator = document.createElement('div');
        freezeClipIndicator.className = 'bg-freeze-clip-indicator';
        freezeClipIndicator.style.display = 'none';
        container.appendChild(freezeClipIndicator);
      }

      // Selection layer (inside cell container so offsets align with cells)
      selectionLayer = new SelectionLayer(cellContainer, container!);
      selectionLayer.setFillHandleEnabled(normalizedSelection.mode !== 'off' && normalizedSelection.fillHandle);

      // Fill handle drag → emit event for plugins, fallback to basic copy
      selectionLayer.setFillDragHandler(({ sourceRange, targetRange }) => {
        // Let plugins handle fill (e.g. clipboard pro series detection)
        let handled = false;
        const fillEvent = { sourceRange, targetRange, handled: false };
        emitter.emit('fill:execute' as keyof GridEvents<TData>, fillEvent as never);
        handled = fillEvent.handled;

        if (!handled) {
          // Default: cycle source values (no series detection)
          const state = store.getState();
          const columns = state.columns;
          const sourceRowCount = sourceRange.endRow - sourceRange.startRow + 1;
          const sourceColCount = sourceRange.endCol - sourceRange.startCol + 1;
          const isVertical = targetRange.startCol === sourceRange.startCol && targetRange.endCol === sourceRange.endCol;
          const isHorizontal = targetRange.startRow === sourceRange.startRow && targetRange.endRow === sourceRange.endRow;

          function getSourceValues(colIdx: number): unknown[] {
            const col = columns[colIdx];
            if (!col?.field) return [];
            const vals: unknown[] = [];
            for (let r = sourceRange.startRow; r <= sourceRange.endRow; r++) {
              vals.push((state.data[r] as Record<string, unknown>)?.[col.field]);
            }
            return vals;
          }

          if (isVertical) {
            for (let col = targetRange.startCol; col <= targetRange.endCol; col++) {
              const column = columns[col];
              if (!column || column.editable === false) continue;

              const sourceVals = getSourceValues(col);
              for (let row = targetRange.startRow; row <= targetRange.endRow; row++) {
                const srcIdx = (row - targetRange.startRow) % sourceRowCount;
                const value = sourceVals[srcIdx];
                if (value !== undefined) {
                  instance.updateCell(row, column.id, value);
                }
              }
            }
          } else if (isHorizontal) {
            for (let row = targetRange.startRow; row <= targetRange.endRow; row++) {
              for (let col = targetRange.startCol; col <= targetRange.endCol; col++) {
                const column = columns[col];
                if (!column || column.editable === false) continue;

                const srcColIdx = sourceRange.startCol + ((col - targetRange.startCol) % sourceColCount);
                const srcCol = columns[srcColIdx];
                if (!srcCol?.field) continue;

                const value = (state.data[row] as Record<string, unknown>)?.[srcCol.field];
                if (value !== undefined) {
                  instance.updateCell(row, column.id, value);
                }
              }
            }
          }
        }

        // Extend selection to include filled area
        store.setSelection({
          active: store.getState().selection.active,
          ranges: [{
            startRow: Math.min(sourceRange.startRow, targetRange.startRow),
            endRow: Math.max(sourceRange.endRow, targetRange.endRow),
            startCol: Math.min(sourceRange.startCol, targetRange.startCol),
            endCol: Math.max(sourceRange.endCol, targetRange.endCol),
          }],
        });
        scheduleRender();
      });

      // Events — scroll on fakeScrollbar, wheel forwarded from the whole grid
      // container (covers viewport, frozen column overlay, and pinned rows; if
      // we only bound to viewport, wheel events over the frozen overlay — an
      // absolutely-positioned sibling on top of viewport — would bubble to the
      // document and scroll the page instead of the grid).
      fakeScrollbar.addEventListener('scroll', handleScroll, { passive: true });
      container.addEventListener('wheel', handleWheel, { passive: false });
      cellContainer.addEventListener('pointerdown', handlePointerDown);
      cellContainer.addEventListener('dblclick', handleDblClick);
      cellContainer.addEventListener('mouseover', handleCellMouseOver);
      cellContainer.addEventListener('mouseout', handleCellMouseOut);
      if (frozenCellOverlay) {
        frozenCellOverlay.addEventListener('pointerdown', handlePointerDown);
        frozenCellOverlay.addEventListener('mouseover', handleCellMouseOver);
        frozenCellOverlay.addEventListener('mouseout', handleCellMouseOut);
        frozenCellOverlay.addEventListener('dblclick', handleDblClick);
      }
      container.addEventListener('keydown', handleKeyDown);

      // Resize observer
      resizeObserver = new ResizeObserver(() => {
        selectionLayer?.invalidateLayout();
        recomputeMeasurements();
        scheduleRender();
      });
      resizeObserver.observe(container);

      mounted = true;
      recomputeMeasurements();
      scheduleRender();
      emitter.emit('mount');
    },

    unmount(): void {
      if (!mounted) return;

      fakeScrollbar?.removeEventListener('scroll', handleScroll);
      container?.removeEventListener('wheel', handleWheel);
      cellContainer?.removeEventListener('pointerdown', handlePointerDown);
      cellContainer?.removeEventListener('dblclick', handleDblClick);
      cellContainer?.removeEventListener('mouseover', handleCellMouseOver);
      cellContainer?.removeEventListener('mouseout', handleCellMouseOut);
      dismissTooltip();
      dismissFilterPanel();
      container?.removeEventListener('keydown', handleKeyDown);
      resizeObserver?.disconnect();

      selectionLayer?.destroy();
      rendering.clear();
      frozenRendering.clear();

      if (container) {
        container.innerHTML = '';
        container.classList.remove('bg-grid');
        container.removeAttribute('role');
        container.removeAttribute('aria-rowcount');
        container.removeAttribute('aria-colcount');
      }

      container = null;
      viewport = null;
      fakeScrollbar = null;
      scrollSizer = null;
      headerContainer = null;
      cellContainer = null;
      frozenColOverlay = null;
      frozenHeaderOverlay = null;
      frozenCellOverlay = null;
      pinnedTopContainer = null;
      pinnedBottomContainer = null;
      frozenPinnedTopContainer = null;
      frozenPinnedBottomContainer = null;
      freezeClipHandle = null;
      freezeClipIndicator = null;
      selectionLayer = null;
      resizeObserver = null;
      mounted = false;
      headerRenderer = null;

      emitter.emit('unmount');
    },

    destroy(): void {
      // Defer plugin destruction to handle React StrictMode correctly.
      // StrictMode calls: ref(null) → unmount (mounted=false) → effect cleanup → destroy
      //   → then immediately: ref(node) → mount (mounted=true) → effect setup.
      // By deferring, we let mount() set mounted=true before checking,
      // so plugins survive the StrictMode simulated unmount/remount cycle.
      // On a real unmount, mounted stays false and plugins are properly cleaned up.
      if (mounted) return;
      setTimeout(() => {
        if (mounted) return; // Re-mounted by StrictMode — don't destroy
        pluginRegistry.destroyAll();
        emitter.removeAllListeners();
      }, 0);
    },

    getData: () => store.getState().data,

    setData(data: TData[]): void {
      // Selection-stability: when getRowId is provided (top-level or via
      // hierarchy), capture the selected row's id before swapping data so we
      // can relocate it in the new array after the swap.
      const hasRowId = options.getRowId != null || options.hierarchy?.getRowId != null;
      const oldState = store.getState();
      const oldActiveRow = oldState.selection.active;
      let preservedId: string | number | null = null;
      if (hasRowId && oldActiveRow != null) {
        const oldRow = oldState.data[oldActiveRow.rowIndex];
        if (oldRow !== undefined) {
          preservedId = resolveRowId(oldRow, oldActiveRow.rowIndex);
        }
      }

      store.setData(data);
      store.update('rowHeights', () => ({
        rowHeights: data.map((_, i) => getRowHeight(i)),
      }));
      rebuildHierarchy();
      recomputeMeasurements();
      updateAriaCounts();

      // Spec: state-on-data-swap defaults — selection clears, scroll resets to (0,0).
      // Exception: when getRowId is provided, relocate the previously-selected row
      // in the new array instead of clearing selection.
      // Editing plugin handles its own commit-or-cancel via existing rules.
      // Undo plugin clears its own history if subscribed to data:set.
      // TODO(perf): add a `resetOn: 'never' | 'data' | 'columns'` option to opt out.
      if (hasRowId && preservedId !== null && oldActiveRow !== null) {
        const newIdx = data.findIndex((row, idx) => resolveRowId(row, idx) === preservedId);
        if (newIdx >= 0) {
          // Row still exists in new data — update its position.
          const relocatedSelection = {
            ...oldState.selection,
            active: { ...oldActiveRow, rowIndex: newIdx },
            // Ranges are cleared on data swap; only the active anchor is preserved.
            ranges: [],
          };
          store.setSelection(relocatedSelection);
          emitter.emit('selection:change', relocatedSelection);
        } else {
          // Row was removed from the new dataset — fall through to clear.
          const clearedSelection = createEmptySelection();
          store.setSelection(clearedSelection);
          emitter.emit('selection:change', clearedSelection);
        }
      } else {
        const clearedSelection = createEmptySelection();
        store.setSelection(clearedSelection);
        emitter.emit('selection:change', clearedSelection);
      }

      store.setScroll(0, 0);
      if (fakeScrollbar) {
        fakeScrollbar.scrollTop = 0;
        fakeScrollbar.scrollLeft = 0;
      }
      emitter.emit('data:set', data);
      scheduleRender();
    },

    updateRow(rowIndex: number, data: Partial<TData>): void {
      const dataIndex = visibleToDataIndex(rowIndex);
      const current = store.getState().data;
      const newData = [...current];
      newData[dataIndex] = { ...newData[dataIndex], ...data } as TData;
      store.setData(newData);
      scheduleRender();
    },

    updateCell(rowIndex: number, columnId: string, value: unknown): void {
      const dataIndex = visibleToDataIndex(rowIndex);
      const oldRow = store.getState().data[dataIndex];
      if (oldRow === undefined) return;

      // Capture the previous CELL value before mutation (not the old row object)
      const column = columnManager.getAllColumns().find((c) => c.id === columnId);
      const oldValue = column ? getCellValue(oldRow, column, dataIndex) : undefined;

      store.setCellValue(dataIndex, columnId, value);
      const newRow = store.getState().data[dataIndex];
      if (newRow === undefined) return;

      const change: CellChange<TData> = { rowIndex, columnId, oldValue, newValue: value, row: newRow };
      emitter.emit('cell:change', [change]);
      options.onCellChange?.([change]);
      scheduleRender();
    },

    getPinnedTopRows: () => store.getState().pinned.top,

    setPinnedTopRows(rows: TData[]): void {
      store.update('pinned', () => ({ pinned: { ...store.getState().pinned, top: rows } }));
      // Update pinned top wrapper height and cell container top
      if (pinnedTopContainer?.parentElement) {
        const rowH = typeof options.rowHeight === 'number' ? options.rowHeight : DEFAULT_ROW_HEIGHT;
        const h = rows.length * rowH;
        pinnedTopContainer.parentElement.style.height = `${h}px`;
        pinnedTopContainer.parentElement.style.display = h === 0 ? 'none' : '';
        if (cellContainer) {
          cellContainer.style.top = `${headerHeight + h}px`;
        }
      }
      scheduleRender();
    },

    getPinnedBottomRows: () => store.getState().pinned.bottom,

    setPinnedBottomRows(rows: TData[]): void {
      store.update('pinned', () => ({ pinned: { ...store.getState().pinned, bottom: rows } }));
      // Update pinned bottom wrapper height
      if (pinnedBottomContainer?.parentElement) {
        const rowH = typeof options.rowHeight === 'number' ? options.rowHeight : DEFAULT_ROW_HEIGHT;
        const h = rows.length * rowH;
        pinnedBottomContainer.parentElement.style.height = `${h}px`;
        pinnedBottomContainer.parentElement.style.display = h === 0 ? 'none' : '';
      }
      scheduleRender();
    },

    getColumns: () => columnManager.getColumns(),

    setColumns(columns: ColumnDef<TData>[]): void {
      columnManager.setColumns(columns);
      store.update('columns', () => ({
        columns: columnManager.getColumns(),
        columnWidths: columnManager.getWidths(),
      }));
      // Notify plugins that columns have been replaced with fresh objects.
      // Plugins that mutate column defs (e.g. editing's alwaysInput wrap) must
      // re-apply their mutations to the new column references via this event.
      emitter.emit('columns:set', columnManager.getColumns());
      // Reset freeze clip if column count changed
      if (freezeClipWidth !== null) {
        freezeClipWidth = null;
      }
      invalidateHeaders();
      recomputeMeasurements();
      updateAriaCounts();
      scheduleRender();
    },

    setColumnWidth(columnId: string, width: number): void {
      const idx = columnManager.getColumnIndex(columnId);
      if (idx === -1) return;
      columnManager.setWidth(idx, width);
      store.setColumnWidth(idx, columnManager.getWidth(idx));
      invalidateHeaders();
      recomputeMeasurements();
      emitter.emit('column:resize', columnId, width);
      options.onColumnResize?.(columnId, width);
      scheduleRender();
    },

    setColumnHidden(columnId: string, hide: boolean): void {
      columnManager.setColumnHidden(columnId, hide);
      store.update('columns', () => ({
        columns: columnManager.getColumns(),
        columnWidths: columnManager.getWidths(),
      }));
      // Reset freeze clip when column count changes (mirrors setColumns behaviour)
      if (freezeClipWidth !== null) {
        freezeClipWidth = null;
      }
      invalidateHeaders();
      recomputeMeasurements();
      updateAriaCounts();
      scheduleRender();
    },

    setContext,

    getSelection: () => store.getState().selection,

    setSelection(selection: Selection): void {
      store.setSelection(selection);
      emitter.emit('selection:change', selection);
      scheduleRender();
    },

    clearSelection(): void {
      instance.setSelection(createEmptySelection());
    },

    getSelectionMode(): 'cell' | 'row' | 'range' | 'off' {
      return normalizedSelection.mode;
    },

    getFreezeClipWidth(): number | null {
      return freezeClipWidth;
    },

    setFreezeClipWidth(width: number | null): void {
      if (width === null) {
        freezeClipWidth = null;
      } else {
        const measurements = virtualization.getMeasurements();
        const state = store.getState();
        const fullWidth = measurements.colOffsets[state.frozen.left]!;
        freezeClipWidth = clamp(width, 0, fullWidth);
      }
      scheduleRender();
    },

    // Hierarchy methods
    toggleRow(rowId: string | number): void {
      if (!hierarchyConfig) return;
      const state = store.getState();
      const expanded = new Set(state.hierarchyState?.expandedRows ?? []);
      if (expanded.has(rowId)) {
        expanded.delete(rowId);
      } else {
        expanded.add(rowId);
      }
      const hierarchyState = buildHierarchyState(state.data, expanded, hierarchyConfig);
      store.update('hierarchy', () => ({ hierarchyState }));
      recomputeMeasurements();
      updateAriaCounts();
      scheduleRender();
    },

    expandAll(): void {
      if (!hierarchyConfig) return;
      const state = store.getState();
      const expanded = new Set<string | number>();
      for (const row of state.data) {
        expanded.add(hierarchyConfig.getRowId(row));
      }
      const hierarchyState = buildHierarchyState(state.data, expanded, hierarchyConfig);
      store.update('hierarchy', () => ({ hierarchyState }));
      recomputeMeasurements();
      updateAriaCounts();
      scheduleRender();
    },

    collapseAll(): void {
      if (!hierarchyConfig) return;
      const state = store.getState();
      const hierarchyState = buildHierarchyState(state.data, new Set(), hierarchyConfig);
      store.update('hierarchy', () => ({ hierarchyState }));
      recomputeMeasurements();
      updateAriaCounts();
      scheduleRender();
    },

    scrollTo(row: number, column?: number): void {
      if (!fakeScrollbar) return;
      const rowMetrics = virtualization.getRowMetrics(row);
      fakeScrollbar.scrollTop = rowMetrics.offset;
      if (column !== undefined) {
        const colMetrics = virtualization.getColMetrics(column);
        fakeScrollbar.scrollLeft = colMetrics.offset;
      }
    },

    getScrollState: (): ScrollState => ({
      scrollTop: store.getState().scrollTop,
      scrollLeft: store.getState().scrollLeft,
    }),

    on: (event, handler) => emitter.on(event, handler),
    off: (event, handler) => emitter.off(event, handler),

    plugins: pluginsProxy as GridInstance<TData, TPlugins>['plugins'],
    $errorCodes: errorCodesProxy as GridInstance<TData, TPlugins>['$errorCodes'],
    getState: () => store.getState(),
    getContainer: () => container,
    getHeaderLayout: () => headerRows,
    getCellType: (type: string) => rendering.getCellType(type),

    addPlugin(plugin: GridPlugin): void {
      pluginRegistry.addPlugin(plugin, createPluginContext);
    },
    removePlugin(pluginId: string): void {
      pluginRegistry.removePlugin(pluginId);
    },

    batch(fn: () => void): void {
      store.batch(fn);
      scheduleRender();
    },

    refresh(): void {
      recomputeMeasurements();
      scheduleRender();
    },
  };

  // ---------------------------------------------------------------------------
  // Plugin initialization (after `instance` is defined — plugins need to see it)
  // ---------------------------------------------------------------------------

  function createPluginContext(plugin: GridPlugin): PluginContext<TData> {
    return {
      grid: instance,
      store,
      on: (event, handler) => emitter.on(event, handler),
      emit: (event, ...args) => emitter.emit(event, ...args),
      registerKeyBinding: (binding) => {
        keyBindings.push(binding);
        return () => {
          const idx = keyBindings.indexOf(binding);
          if (idx >= 0) keyBindings.splice(idx, 1);
        };
      },
      registerCellType: (type, renderer) => {
        const unreg1 = rendering.registerCellType(type, renderer);
        const unreg2 = frozenRendering.registerCellType(type, renderer);
        return () => { unreg1(); unreg2(); };
      },
      registerCommand: (command) => {
        commands.set(command.id, command);
      },
      expose: (api) => {
        pluginRegistry.exposeApi(plugin.id, api);
      },
      getPluginApi: (id) => pluginRegistry.getPlugin(id),
      showTooltip: (target, text, cursorX, cursorY) => showTooltip(target, text, cursorX, cursorY),
      dismissTooltip: () => dismissTooltip(),
    };
  }

  if (options.plugins?.length) {
    pluginRegistry.register(options.plugins);
    pluginRegistry.initAll(createPluginContext);
  }

  // Initial measurement
  recomputeMeasurements();

  return instance;
}
