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
  HierarchyState,
  CellRenderContext,
} from './types';
import { EventEmitter } from './events/emitter';
import { StateStore } from './state/store';
import { PluginRegistry } from './plugin/registry';
import { ColumnManager } from './columns/manager';
import { VirtualizationEngine } from './virtualization/engine';
import type { LayoutMeasurements } from './virtualization/engine';
import { RenderingPipeline } from './rendering/pipeline';
import { SelectionLayer } from './rendering/layers';
import { createEmptySelection, createCellSelection, extendSelection, addRangeToSelection } from './selection/model';
import { navigateCell, navigateTab, getNavigationDirection } from './keyboard/navigation';
import { computeZoneDimensions } from './virtualization/layout';

import { snapToDevicePixel } from './utils';

const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_HEADER_HEIGHT = 40;

export function createGrid<
  TData = unknown,
  TPlugins extends GridPlugin[] = GridPlugin[],
>(options: GridOptions<TData, TPlugins>): GridInstance<TData, TPlugins> {
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
  const pluginRegistry = new PluginRegistry();
  const keyBindings: KeyBinding[] = [];
  const commands = new Map<string, Command>();

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
  const headerRows = options.headerRows;
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
    frozenTopRows: options.frozenTopRows ?? 0,
    frozenLeftColumns: options.frozenLeftColumns ?? 0,
    pinnedTopRows: options.pinnedTopRows ?? [],
    pinnedBottomRows: options.pinnedBottomRows ?? [],
    hierarchyState: null,
    pluginState: {},
  };

  const store = new StateStore<TData>(initialState);

  // ---------------------------------------------------------------------------
  // Hierarchy (row tree) support
  // ---------------------------------------------------------------------------

  const hierarchyConfig = options.hierarchy as HierarchyConfig<TData> | undefined;

  /** Build the hierarchy state from data + expanded set */
  function buildHierarchyState(data: TData[], expandedRows: Set<string | number>): HierarchyState {
    const cfg = hierarchyConfig!;
    const childrenMap = new Map<string | number | null, number[]>();
    const rowDepths = new Map<string | number, number>();
    const parentIds = new Set<string | number>();
    const dataIndexToRowId = new Map<number, string | number>();

    // Build children map: parentId → array of data indices
    // Also build dataIndex → rowId map
    for (let i = 0; i < data.length; i++) {
      const row = data[i]!;
      const rowId = cfg.getRowId(row);
      const parentId = cfg.getParentId(row) ?? null;
      dataIndexToRowId.set(i, rowId);
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(i);
    }

    // Mark parent IDs (keys of childrenMap that are actual row IDs, not null)
    for (const [parentId] of childrenMap) {
      if (parentId !== null) {
        parentIds.add(parentId);
      }
    }

    // Walk tree depth-first to build visibleRows and rowDepths
    const visibleRows: number[] = [];

    function walk(parentId: string | number | null, depth: number): void {
      const children = childrenMap.get(parentId);
      if (!children) return;
      for (const dataIndex of children) {
        const row = data[dataIndex]!;
        const rowId = cfg.getRowId(row);
        rowDepths.set(rowId, depth);
        visibleRows.push(dataIndex);

        // Recurse into children if expanded
        if (expandedRows.has(rowId) && childrenMap.has(rowId)) {
          walk(rowId, depth + 1);
        }
      }
    }

    walk(null, 0);

    return { expandedRows, visibleRows, rowDepths, childrenMap, parentIds, dataIndexToRowId };
  }

  /** Rebuild hierarchy state and update the store */
  function rebuildHierarchy(): void {
    if (!hierarchyConfig) return;
    const state = store.getState();
    const currentExpanded = state.hierarchyState?.expandedRows ?? new Set<string | number>();
    const hierarchyState = buildHierarchyState(state.data, currentExpanded);
    store.update('hierarchy', () => ({ hierarchyState }));
  }

  /** Initialize hierarchy if configured */
  if (hierarchyConfig) {
    const defaultExpanded = hierarchyConfig.defaultExpanded !== false; // default true
    const initialExpanded = new Set<string | number>();
    if (defaultExpanded) {
      // Expand all rows that have children
      for (let i = 0; i < options.data.length; i++) {
        initialExpanded.add(hierarchyConfig.getRowId(options.data[i]!));
      }
    }
    const hierarchyState = buildHierarchyState(options.data, initialExpanded);
    store.update('hierarchy', () => ({ hierarchyState }));
  }

  // Resolve freeze clip config
  const freezeClipConfig = (() => {
    const opt = options.freezeClip;
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

  function recomputeMeasurements(): void {
    const state = store.getState();
    const rowCount = getEffectiveRowCount();
    const hs = state.hierarchyState;
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
        frozenTopRows: state.frozenTopRows,
        frozenBottomRows: 0,
        frozenLeftColumns: state.frozenLeftColumns,
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
      ? Math.max(0, Math.min(freezeClipWidth, zoneDims.frozenLeftWidth))
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

    store.update('visibleRange', () => ({ visibleRange }));

    // Render non-frozen cells into main cell container
    const frozenCols = state.frozenLeftColumns;
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
      state.frozenTopRows,
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
        state.frozenTopRows,
      );

      // Update frozen overlay width and clip scroll container
      const frozenWidth = measurements.colOffsets[frozenCols]!;
      frozenColOverlay!.style.width = `${frozenWidth}px`;
      // Match viewport height so frozen pinned rows align with main pinned rows
      const contentHeight = measurements.totalHeight + headerHeight + pinnedTopH + pinnedBottomH;
      const frozenH = Math.min(contentHeight, viewport!.clientHeight);
      frozenColOverlay!.style.height = `${frozenH}px`;
      frozenColOverlay!.style.bottom = 'auto';
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
        const clampedWidth = Math.max(0, Math.min(freezeClipWidth, fullFrozenWidth));
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
          const clampedWidth = Math.max(0, Math.min(freezeClipWidth!, fullFrozenWidth));
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
        renderPinnedRows(pinnedTopContainer, state.pinnedTopRows, state.columns, measurements, frozenCols);
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
        renderPinnedRows(pinnedBottomContainer, state.pinnedBottomRows, state.columns, measurements, frozenCols);
        pinnedBottomContainer.style.height = `${pinnedBottomH}px`;
        pinnedBottomContainer.style.width = `${measurements.totalWidth}px`;
        pinnedBottomContainer.style.transform = `translate3d(${-state.scrollLeft - clipOffset}px, 0, 0)`;
        if (wrapper) { wrapper.style.display = ''; wrapper.style.height = `${pinnedBottomH}px`; }
      } else if (wrapper) {
        wrapper.style.display = 'none'; wrapper.style.height = '0';
      }
    }
    // Render frozen pinned rows (frozen columns only, no horizontal scroll)
    if (frozenPinnedTopContainer && frozenCols > 0) {
      renderPinnedRows(frozenPinnedTopContainer, state.pinnedTopRows, state.columns, measurements, 0, frozenCols);
      frozenPinnedTopContainer.style.height = `${pinnedTopH}px`;
      frozenPinnedTopContainer.style.display = pinnedTopH > 0 ? '' : 'none';
    }
    if (frozenPinnedBottomContainer && frozenCols > 0) {
      renderPinnedRows(frozenPinnedBottomContainer, state.pinnedBottomRows, state.columns, measurements, 0, frozenCols);
      frozenPinnedBottomContainer.style.height = `${pinnedBottomH}px`;
      frozenPinnedBottomContainer.style.display = pinnedBottomH > 0 ? '' : 'none';
    }

    // Update cell container top offset (may change when pinned top rows are set dynamically)
    if (cellContainer) {
      cellContainer.style.top = `${headerHeight + pinnedTopH}px`;
    }
    // Update frozen cell overlay top offset to match
    if (frozenCellOverlay) {
      frozenCellOverlay.style.top = `${headerHeight + pinnedTopH}px`;
    }

    // Render selection layer
    selectionLayer?.render(state.selection, measurements);

    emitter.emit('render', visibleRange);
  }

  // ---------------------------------------------------------------------------
  // Pinned row rendering (static, no virtualization)
  // ---------------------------------------------------------------------------

  // Pinned rows are always re-rendered (cheap: typically 1-3 rows, no virtualization needed)

  function renderPinnedRows(
    pinnedContainer: HTMLElement,
    rows: TData[],
    columns: ColumnDef<TData>[],
    measurements: LayoutMeasurements,
    startCol?: number,
    endCol?: number,
  ): void {
    pinnedContainer.innerHTML = '';
    const colStart = startCol ?? 0;
    const colEnd = endCol ?? columns.length;
    if (rows.length === 0) return;

    const rowH = typeof options.rowHeight === 'number' ? options.rowHeight : DEFAULT_ROW_HEIGHT;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const rowData = rows[rowIdx]!;
      const top = rowIdx * rowH;

      for (let col = colStart; col < colEnd; col++) {
        const column = columns[col]!;
        const left = snapToDevicePixel(measurements.colOffsets[col]!);
        const width = snapToDevicePixel(measurements.colOffsets[col + 1]!) - left;

        const cell = document.createElement('div');
        cell.className = 'bg-cell bg-cell--pinned';
        cell.style.position = 'absolute';
        cell.style.transform = `translate3d(${left}px, ${snapToDevicePixel(top)}px, 0)`;
        cell.style.width = `${width}px`;
        cell.style.height = `${rowH}px`;
        cell.style.lineHeight = `${rowH}px`;

        // Apply column-level alignment
        cell.style.textAlign = column.align ?? '';
        cell.style.verticalAlign = column.verticalAlign ?? '';

        // Get value
        const value = column.accessorFn
          ? column.accessorFn(rowData, rowIdx)
          : column.accessorKey
            ? (rowData as Record<string, unknown>)[column.accessorKey]
            : undefined;

        // Build context for cellType rendering
        const context: CellRenderContext<TData> = {
          rowIndex: rowIdx,
          colIndex: col,
          row: rowData,
          column,
          value,
          isSelected: false,
          isActive: false,
          style: { top, left, width, height: rowH },
        };

        // Render priority: column renderer > cell type > valueModifier > default text
        const hidden = column.hideZero && value === 0;
        if (hidden) {
          // skip
        } else if (column.cellRenderer) {
          column.cellRenderer(cell, context);
        } else if (column.cellType && rendering.getCellType(column.cellType)) {
          rendering.getCellType(column.cellType)!.render(cell, context as CellRenderContext);
        } else if (column.valueModifier?.format) {
          cell.textContent = column.valueModifier.format(value);
        } else {
          cell.textContent = value != null ? String(value) : '';
        }

        pinnedContainer.appendChild(cell);
      }
    }
  }

  function getPinnedTopHeight(): number {
    const state = store.getState();
    const rowH = typeof options.rowHeight === 'number' ? options.rowHeight : DEFAULT_ROW_HEIGHT;
    return state.pinnedTopRows.length * rowH;
  }

  function getPinnedBottomHeight(): number {
    const state = store.getState();
    const rowH = typeof options.rowHeight === 'number' ? options.rowHeight : DEFAULT_ROW_HEIGHT;
    return state.pinnedBottomRows.length * rowH;
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
    const fullFrozenWidth = measurements.colOffsets[state.frozenLeftColumns]!;
    return Math.max(0, fullFrozenWidth - Math.max(0, Math.min(freezeClipWidth, fullFrozenWidth)));
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

    const selectionMode = options.selection?.mode ?? 'cell';
    if (selectionMode === 'none') return;

    const isCtrlHeld = event.ctrlKey || event.metaKey;

    if (event.shiftKey && store.getState().selection.active) {
      // Extend the last range (works with both plain Shift and Shift+Ctrl)
      const newSelection = extendSelection(store.getState().selection, cell);
      store.setSelection(newSelection);
    } else if (isCtrlHeld) {
      // Ctrl/Meta+click: add a new single-cell range to existing selection
      const currentSelection = store.getState().selection;
      const cellRange = {
        startRow: cell.rowIndex,
        endRow: cell.rowIndex,
        startCol: cell.colIndex,
        endCol: cell.colIndex,
      };
      const newSelection = addRangeToSelection(currentSelection, cellRange);
      // Update active cell to the newly clicked cell
      store.setSelection({ ...newSelection, active: cell });
    } else {
      store.setSelection(createCellSelection(cell));
    }

    emitter.emit('cell:click', cell, event as unknown as MouseEvent);
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
      frozenTopRows: state.frozenTopRows,
      frozenLeftColumns: state.frozenLeftColumns,
    };

    // Arrow key navigation
    const direction = getNavigationDirection(event);
    if (direction) {
      event.preventDefault();
      if (event.shiftKey) {
        // Extend selection
        // For shift+arrow, we extend from the active cell
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
  // Header rendering
  // ---------------------------------------------------------------------------

  let headersRendered = false;

  function renderHeaders(
    state: GridState<TData>,
    measurements: LayoutMeasurements,
  ): void {
    if (!headerContainer) return;
    if (headersRendered) return;

    headersRendered = true;
    headerContainer.innerHTML = '';
    if (frozenHeaderOverlay) frozenHeaderOverlay.innerHTML = '';

    if (headerRows && headerRows.length > 0) {
      renderMultiHeaders(state, measurements);
    } else {
      renderSingleHeaders(state, measurements);
    }
  }

  function renderSingleHeaders(
    state: GridState<TData>,
    measurements: LayoutMeasurements,
  ): void {
    for (let col = 0; col < state.columns.length; col++) {
      const column = state.columns[col]!;
      const left = measurements.colOffsets[col]!;
      const width = measurements.colOffsets[col + 1]! - left;
      const isFrozen = col < state.frozenLeftColumns;
      const isLastFrozenCol = col === state.frozenLeftColumns - 1;

      const cell = createHeaderCell({
        left,
        top: 0,
        width,
        height: headerHeight,
        content: column.header,
        colIndex: col,
        isFrozen,
        isLastFrozenCol,
        columnId: column.id,
        resizable: column.resizable !== false,
      });

      appendHeaderCell(cell, isFrozen);
    }
  }

  function renderMultiHeaders(
    state: GridState<TData>,
    measurements: LayoutMeasurements,
  ): void {
    let topOffset = 0;
    const totalRows = headerRows!.length;
    // Track cells occupied by rowSpan from previous rows: "rowIdx:colIdx"
    const occupied = new Set<string>();

    // Track column indices at the right edge of a group span.
    // These columns get resize handles that extend upward to cover the group row.
    const groupSpanEndCols = new Set<number>();
    const frozenCols = state.frozenLeftColumns;

    // Pre-scan all non-last header rows to find group span boundaries
    for (let ri = 0; ri < totalRows - 1; ri++) {
      const hRow = headerRows![ri]!;
      let ci = 0;
      for (const hCell of hRow.cells) {
        const s = hCell.colSpan ?? 1;
        const endC = Math.min(ci + s, state.columns.length);
        if (s > 1) {
          groupSpanEndCols.add(endC - 1);
          // Cross-boundary span: frozen portion's last col is also a group edge
          if (ci < frozenCols && endC > frozenCols) {
            groupSpanEndCols.add(frozenCols - 1);
          }
        }
        ci += s;
      }
    }

    for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
      const row = headerRows![rowIdx]!;
      const rowHeight = row.height ?? singleHeaderRowHeight;
      let colIndex = 0;
      let cellIdx = 0;

      while (cellIdx < row.cells.length && colIndex < state.columns.length) {
        // Skip columns occupied by rowSpan from previous rows
        while (colIndex < state.columns.length && occupied.has(`${rowIdx}:${colIndex}`)) {
          colIndex++;
        }
        if (colIndex >= state.columns.length) break;

        const cell = row.cells[cellIdx]!;
        cellIdx++;

        const span = cell.colSpan ?? 1;
        const rSpan = cell.rowSpan ?? 1;

        const left = measurements.colOffsets[colIndex]!;
        const endCol = Math.min(colIndex + span, state.columns.length);
        const height = rowHeight * rSpan;

        // Mark positions occupied by this cell's rowSpan for subsequent rows
        if (rSpan > 1) {
          for (let r = rowIdx + 1; r < rowIdx + rSpan && r < totalRows; r++) {
            for (let c = colIndex; c < endCol; c++) {
              occupied.add(`${r}:${c}`);
            }
          }
        }

        // A cell that spans to the last row acts as a last-row header
        const reachesLastRow = rowIdx + rSpan - 1 === totalRows - 1;

        const startsInFrozen = colIndex < frozenCols;
        const endsInScrollable = endCol > frozenCols;
        const crossesBoundary = startsInFrozen && endsInScrollable && span > 1;

        // Only headers reaching the last row get sort/context menu
        const targetColumnId = reachesLastRow
          ? (cell.columnId ?? state.columns[colIndex]?.id)
          : undefined;

        // Determine if the last column in this span is resizable
        const lastColInSpan = endCol - 1;
        const lastColResizable = state.columns[lastColInSpan]?.resizable !== false;
        // Only last-row headers get resize handles (extended upward to cover group rows)
        const canResize = reachesLastRow && lastColResizable;

        if (crossesBoundary) {
          // Split: frozen portion (cols colIndex..frozenCols-1)
          const frozenWidth = measurements.colOffsets[frozenCols]! - left;
          const frozenLastCol = frozenCols - 1;
          const frozenCanResize = reachesLastRow && state.columns[frozenLastCol]?.resizable !== false;
          const frozenEl = createHeaderCell({
            left,
            top: topOffset,
            width: frozenWidth,
            height,
            content: cell.content,
            colIndex,
            isFrozen: true,
            isLastFrozenCol: true,
            columnId: undefined,
            resizable: frozenCanResize,
            resizeColIndex: frozenLastCol,
            resizeHandleTop: groupSpanEndCols.has(frozenLastCol) ? -topOffset : undefined,
          });
          if (span > 1) frozenEl.classList.add('bg-header-cell--span');
          if (!reachesLastRow) frozenEl.classList.add('bg-header-cell--group');
          appendHeaderCell(frozenEl, true);

          // Split: scrollable continuation (no text — visually extends frozen header)
          const scrollLeft = measurements.colOffsets[frozenCols]!;
          const scrollWidth = measurements.colOffsets[endCol]! - scrollLeft;
          const scrollEl = createHeaderCell({
            left: scrollLeft,
            top: topOffset,
            width: scrollWidth,
            height,
            content: '',
            colIndex: frozenCols,
            isFrozen: false,
            isLastFrozenCol: false,
            columnId: undefined,
            resizable: canResize,
            resizeColIndex: lastColInSpan,
            resizeHandleTop: groupSpanEndCols.has(lastColInSpan) ? -topOffset : undefined,
          });
          scrollEl.style.borderLeft = 'none';
          if (span > 1) scrollEl.classList.add('bg-header-cell--span');
          if (!reachesLastRow) scrollEl.classList.add('bg-header-cell--group');
          appendHeaderCell(scrollEl, false);
        } else {
          const isFrozen = startsInFrozen;
          const isLastFrozenCol = endCol - 1 === frozenCols - 1;
          const width = measurements.colOffsets[endCol]! - left;

          const headerEl = createHeaderCell({
            left,
            top: topOffset,
            width,
            height,
            content: cell.content,
            colIndex,
            isFrozen,
            isLastFrozenCol,
            columnId: targetColumnId,
            resizable: canResize,
            resizeColIndex: lastColInSpan,
            resizeHandleTop: reachesLastRow && groupSpanEndCols.has(lastColInSpan) ? -topOffset : undefined,
          });

          // Add classes for multi-header styling
          if (span > 1) {
            headerEl.classList.add('bg-header-cell--span');
          }
          if (!reachesLastRow) {
            headerEl.classList.add('bg-header-cell--group');
          }

          appendHeaderCell(headerEl, isFrozen);
        }
        colIndex += span;
      }

      topOffset += rowHeight;
    }

  }

  function createHeaderCell(opts: {
    left: number;
    top: number;
    width: number;
    height: number;
    content: string | (() => HTMLElement | string);
    colIndex: number;
    isFrozen: boolean;
    isLastFrozenCol: boolean;
    columnId?: string;
    resizable: boolean;
    resizeColIndex?: number; // column index to resize (defaults to colIndex)
    resizeHandleTop?: number; // extend resize handle upward (negative value)
  }): HTMLElement {
    const cell = document.createElement('div');
    let cls = 'bg-header-cell';
    if (opts.isFrozen) cls += ' bg-header-cell--frozen-left';
    if (opts.isLastFrozenCol) cls += ' bg-header-cell--frozen-col-last';
    cell.className = cls;
    cell.style.position = 'absolute';
    cell.style.transform = `translate3d(${snapToDevicePixel(opts.left)}px, ${snapToDevicePixel(opts.top)}px, 0)`;
    cell.style.width = `${snapToDevicePixel(opts.width)}px`;
    cell.style.height = `${snapToDevicePixel(opts.height)}px`;
    cell.dataset.col = String(opts.colIndex);
    cell.dataset.baseLeft = String(opts.left);

    // Wrap content in a clipping span for consistent text-overflow: ellipsis
    const textSpan = document.createElement('span');
    textSpan.className = 'bg-header-cell__text';
    if (typeof opts.content === 'function') {
      const content = opts.content();
      if (typeof content === 'string') {
        textSpan.textContent = content;
      } else {
        textSpan.appendChild(content);
      }
    } else {
      textSpan.textContent = opts.content;
    }
    cell.appendChild(textSpan);

    // Show tooltip on hover when text is clipped
    cell.addEventListener('mouseenter', () => {
      if (textSpan.scrollWidth > textSpan.clientWidth) {
        showTooltip(cell, textSpan.textContent ?? '');
      }
    });
    cell.addEventListener('mouseleave', dismissTooltip);

    if (opts.columnId) {
      cell.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('bg-resize-handle')) return;
        for (const plugin of pluginRegistry.getAllPlugins()) {
          plugin.hooks?.onHeaderClick?.(opts.columnId!);
        }
      });

      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showHeaderContextMenu(e, opts.columnId!);
      });

      // Filter icon button — only when filtering plugin is registered
      if (pluginRegistry.getPlugin('filtering')) {
        const filterBtn = document.createElement('span');
        filterBtn.className = 'bg-header-cell__filter-btn';
        filterBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1.5h8M2.5 4h5M4 6.5h2M5 6.5V9"/></svg>';
        filterBtn.title = 'Filter';
        filterBtn.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          showFilterPanel(e, opts.columnId!);
        });
        // Prevent click from bubbling to header (which triggers sorting)
        filterBtn.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        cell.appendChild(filterBtn);
      }
    }

    if (opts.resizable) {
      const resizeCol = opts.resizeColIndex ?? opts.colIndex;
      const handle = document.createElement('div');
      handle.className = 'bg-resize-handle';
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        startColumnResize(resizeCol, e);
      });

      if (opts.resizeHandleTop != null && opts.resizeHandleTop < 0) {
        handle.style.top = `${opts.resizeHandleTop}px`;
        cell.style.overflow = 'visible';
      }
      cell.appendChild(handle);
    }

    return cell;
  }

  function appendHeaderCell(cell: HTMLElement, isFrozen: boolean): void {
    if (isFrozen && frozenHeaderOverlay) {
      cell.style.pointerEvents = 'auto';
      frozenHeaderOverlay.appendChild(cell);
    } else {
      headerContainer!.appendChild(cell);
    }
  }

  // ---------------------------------------------------------------------------
  // Scroll cell into view
  // ---------------------------------------------------------------------------

  function scrollCellIntoView(cell: CellPosition): void {
    if (!fakeScrollbar) return;

    const measurements = virtualization.getMeasurements();
    const rowTop = measurements.rowOffsets[cell.rowIndex]!;
    const rowBottom = measurements.rowOffsets[cell.rowIndex + 1]!;
    const colLeft = measurements.colOffsets[cell.colIndex]!;
    const colRight = measurements.colOffsets[cell.colIndex + 1]!;

    const viewTop = fakeScrollbar.scrollTop;
    const viewBottom = viewTop + (fakeScrollbar?.clientHeight ?? 0) - headerHeight;
    const viewLeft = fakeScrollbar.scrollLeft;
    const viewRight = viewLeft + (viewport?.clientWidth ?? 0);

    // Vertical scroll
    if (rowTop < viewTop) {
      fakeScrollbar.scrollTop = rowTop;
    } else if (rowBottom > viewBottom) {
      fakeScrollbar.scrollTop = rowBottom - (fakeScrollbar?.clientHeight ?? 0) + headerHeight;
    }

    // Horizontal scroll (skip if frozen column)
    const state = store.getState();
    if (cell.colIndex >= state.frozenLeftColumns) {
      if (colLeft < viewLeft) {
        fakeScrollbar.scrollLeft = colLeft;
      } else if (colRight > viewRight) {
        fakeScrollbar.scrollLeft = colRight - (viewport?.clientWidth ?? 0);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Column resize
  // ---------------------------------------------------------------------------

  function startColumnResize(colIndex: number, startEvent: PointerEvent): void {
    const startX = startEvent.clientX;
    const startWidth = columnManager.getWidth(colIndex);

    const onPointerMove = (e: PointerEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(columnManager.getColumns()[colIndex]?.minWidth ?? 50, startWidth + delta);
      instance.setColumnWidth(columnManager.getColumns()[colIndex]!.id, newWidth);
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  // ---------------------------------------------------------------------------
  // Freeze clip
  // ---------------------------------------------------------------------------

  function startFreezeClipDrag(startEvent: PointerEvent): void {
    startEvent.preventDefault();
    startEvent.stopPropagation();

    const measurements = virtualization.getMeasurements();
    const state = store.getState();
    const fullFrozenWidth = measurements.colOffsets[state.frozenLeftColumns]!;
    const containerRect = container!.getBoundingClientRect();
    // minVisible columns must stay visible — use their actual cumulative width
    const minCols = Math.min(freezeClipConfig.minVisible, state.frozenLeftColumns);
    const minWidth = minCols > 0 ? measurements.colOffsets[minCols]! : 0;

    const onPointerMove = (e: PointerEvent) => {
      const currentX = e.clientX - containerRect.left;
      // Clamp between minVisible-derived width and full frozen width
      const clampedWidth = Math.max(minWidth, Math.min(fullFrozenWidth, currentX));

      // Snap to full width if within 8px of the boundary (easy restore)
      if (clampedWidth >= fullFrozenWidth - 8) {
        freezeClipWidth = null; // null = no clip active
      } else {
        freezeClipWidth = clampedWidth;
      }
      scheduleRender();
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      emitter.emit('freezeClip:change', freezeClipWidth ?? fullFrozenWidth, fullFrozenWidth);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function restoreAllFrozenColumns(): void {
    if (freezeClipWidth !== null) {
      freezeClipWidth = null;
      scheduleRender();
      const measurements = virtualization.getMeasurements();
      const state = store.getState();
      const fullFrozenWidth = measurements.colOffsets[state.frozenLeftColumns]!;
      emitter.emit('freezeClip:change', fullFrozenWidth, fullFrozenWidth);
    }
  }

  // ---------------------------------------------------------------------------
  // Header context menu
  // ---------------------------------------------------------------------------

  let activeContextMenu: HTMLElement | null = null;

  function showHeaderContextMenu(event: MouseEvent, columnId: string): void {
    dismissContextMenu();

    const items: { label: string; action: () => void; active?: boolean }[] = [];

    // Collect menu items from plugins
    for (const plugin of pluginRegistry.getAllPlugins()) {
      if (plugin.id === 'sorting') {
        const api = pluginRegistry.getPlugin<{ getSortState: () => { columnId: string; direction: string }[]; clearSort: () => void; toggleSort: (id: string, multi?: boolean) => void }>(plugin.id);
        if (api) {
          const sorted = api.getSortState();
          const colSorted = sorted.find((s) => s.columnId === columnId);
          items.push(
            { label: 'Sort Ascending', action: () => { api.clearSort(); api.toggleSort(columnId); }, active: colSorted?.direction === 'asc' },
            { label: 'Sort Descending', action: () => { api.clearSort(); api.toggleSort(columnId); api.toggleSort(columnId); }, active: colSorted?.direction === 'desc' },
          );
          if (colSorted) {
            items.push({ label: 'Clear Sort', action: () => {
              // Remove just this column's sort by re-applying without it
              const remaining = sorted.filter((s) => s.columnId !== columnId);
              api.clearSort();
              for (const s of remaining) {
                api.toggleSort(s.columnId, true);
                if (s.direction === 'desc') api.toggleSort(s.columnId, true);
              }
            }});
          }
          if (sorted.length > 1) {
            items.push({ label: 'Clear All Sorts', action: () => api.clearSort() });
          }
        }
      }
    }

    // Filtering items
    for (const plugin of pluginRegistry.getAllPlugins()) {
      if (plugin.id === 'filtering') {
        const api = pluginRegistry.getPlugin<{ getFilters: () => { columnId: string }[]; setFilter: (id: string, value: unknown, op?: string) => void; removeFilter: (id: string) => void; clearFilters: () => void }>(plugin.id);
        if (api) {
          const filtered = api.getFilters();
          const colFiltered = filtered.find((f) => f.columnId === columnId);

          // Add a separator if sorting items exist
          if (items.length > 0) {
            items.push({ label: '─', action: () => {}, active: false });
          }

          items.push({
            label: colFiltered ? 'Change Filter...' : 'Filter...',
            action: () => {
              dismissContextMenu();
              showFilterPanel(event, columnId, colFiltered as { columnId: string; value: unknown; operator: string } | undefined);
            },
            active: !!colFiltered,
          });

          if (colFiltered) {
            items.push({ label: 'Clear Filter', action: () => api.removeFilter(columnId) });
          }
          if (filtered.length > 0) {
            items.push({ label: 'Clear All Filters', action: () => api.clearFilters() });
          }
        }
      }
    }

    if (items.length === 0) return;

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'bg-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${event.clientX}px;
      top: ${event.clientY}px;
      z-index: 100;
      background: var(--bg-context-menu-bg, #fff);
      border: 1px solid var(--bg-context-menu-border, #d0d0d0);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 4px 0;
      min-width: 160px;
      font: ${getComputedStyle(event.target as HTMLElement).font};
      font-weight: normal;
    `;

    for (const item of items) {
      // Separator
      if (item.label === '─') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: #e0e0e0; margin: 4px 0;';
        menu.appendChild(sep);
        continue;
      }

      const menuItem = document.createElement('div');
      menuItem.className = 'bg-context-menu__item' + (item.active ? ' bg-context-menu__item--active' : '');
      menuItem.textContent = item.label;
      const activeBg = 'var(--bg-dropdown-selected-bg, #e8f0fe)';
      menuItem.style.cssText = `
        padding: 6px 12px;
        cursor: pointer;
        user-select: none;
        ${item.active ? `background: ${activeBg}; font-weight: 500;` : ''}
      `;
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.background = 'var(--bg-context-menu-hover, #f0f0f0)';
      });
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.background = item.active ? activeBg : '';
      });
      menuItem.addEventListener('click', () => {
        item.action();
        dismissContextMenu();
      });
      menu.appendChild(menuItem);
    }

    document.body.appendChild(menu);
    activeContextMenu = menu;

    // Close on click outside
    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        dismissContextMenu();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    // Delay to avoid the contextmenu click itself dismissing
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  function dismissContextMenu(): void {
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Filter Panel (replaces browser prompt())
  // ---------------------------------------------------------------------------

  let activeFilterPanel: HTMLElement | null = null;

  function dismissFilterPanel(): void {
    if (activeFilterPanel) {
      activeFilterPanel.remove();
      activeFilterPanel = null;
    }
  }

  function showFilterPanel(
    event: MouseEvent,
    columnId: string,
    currentFilter?: { columnId: string; value: unknown; operator: string },
  ): void {
    dismissFilterPanel();

    const filteringPlugin = pluginRegistry.getPlugin<{
      setFilter: (id: string, value: unknown, op?: string) => void;
      removeFilter: (id: string) => void;
    }>('filtering');
    if (!filteringPlugin) return;

    // Determine column name and type for operator list
    const cols = columnManager.getColumns();
    const colDef = cols.find((c) => c.id === columnId);
    const columnName = (colDef?.header as string) || columnId;
    const cellType = colDef?.cellType as string | undefined;
    const isNumeric = cellType === 'number' || cellType === 'currency' || cellType === 'percent' || cellType === 'bigint';

    const textOperators = [
      { value: 'contains', label: 'Contains' },
      { value: 'eq', label: 'Equals' },
      { value: 'neq', label: 'Not equals' },
      { value: 'startsWith', label: 'Starts with' },
      { value: 'endsWith', label: 'Ends with' },
    ];
    const numberOperators = [
      { value: 'eq', label: 'Equals' },
      { value: 'neq', label: 'Not equals' },
      { value: 'gt', label: 'Greater than' },
      { value: 'gte', label: 'Greater or equal' },
      { value: 'lt', label: 'Less than' },
      { value: 'lte', label: 'Less or equal' },
    ];
    const operators = isNumeric ? numberOperators : textOperators;

    // Position: anchor below the header cell that was right-clicked
    const headerCell = (event.target as HTMLElement).closest('.bg-header-cell') as HTMLElement | null;
    let anchorX = event.clientX;
    let anchorY = event.clientY;
    if (headerCell) {
      const rect = headerCell.getBoundingClientRect();
      anchorX = rect.left;
      anchorY = rect.bottom;
    }

    // Build the panel
    const panel = document.createElement('div');
    panel.className = 'bg-filter-panel';
    const font = getComputedStyle(event.target as HTMLElement).font;
    panel.style.cssText = `
      position: fixed;
      left: ${anchorX}px;
      top: ${anchorY}px;
      z-index: 100;
      background: var(--bg-filter-panel-bg, #fff);
      border: 1px solid var(--bg-filter-panel-border, #d0d0d0);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 12px;
      min-width: 220px;
      font: ${font};
      font-weight: normal;
    `;

    // Title
    const title = document.createElement('div');
    title.className = 'bg-filter-panel__title';
    title.textContent = `Filter: ${columnName}`;
    title.style.cssText = 'font-weight: 600; margin-bottom: 8px; font-size: 13px;';
    panel.appendChild(title);

    // Operator select
    const select = document.createElement('select');
    select.className = 'bg-filter-panel__operator';
    select.style.cssText = `
      display: block;
      width: 100%;
      padding: 6px 8px;
      margin-bottom: 8px;
      border: 1px solid var(--bg-filter-panel-input-border, #ccc);
      border-radius: 4px;
      font: inherit;
      font-size: 13px;
      background: var(--bg-filter-panel-input-bg, #fff);
      appearance: auto;
    `;
    for (const op of operators) {
      const opt = document.createElement('option');
      opt.value = op.value;
      opt.textContent = op.label;
      select.appendChild(opt);
    }
    // Pre-select current operator
    if (currentFilter?.operator) {
      select.value = currentFilter.operator;
    }
    panel.appendChild(select);

    // Value input
    const input = document.createElement('input');
    input.className = 'bg-filter-panel__input';
    input.type = isNumeric ? 'number' : 'text';
    input.placeholder = 'Filter value...';
    input.style.cssText = `
      display: block;
      width: 100%;
      padding: 6px 8px;
      margin-bottom: 10px;
      border: 1px solid var(--bg-filter-panel-input-border, #ccc);
      border-radius: 4px;
      font: inherit;
      font-size: 13px;
      box-sizing: border-box;
      background: var(--bg-filter-panel-input-bg, #fff);
    `;
    // Pre-populate current value
    if (currentFilter?.value != null) {
      input.value = String(currentFilter.value);
    }
    panel.appendChild(input);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'bg-filter-panel__btn bg-filter-panel__btn--clear';
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `
      padding: 5px 12px;
      border: 1px solid var(--bg-filter-panel-btn-border, #ccc);
      border-radius: 4px;
      background: var(--bg-filter-panel-btn-bg, #fff);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    `;

    const applyBtn = document.createElement('button');
    applyBtn.className = 'bg-filter-panel__btn bg-filter-panel__btn--apply';
    applyBtn.textContent = 'Apply';
    applyBtn.style.cssText = `
      padding: 5px 12px;
      border: 1px solid var(--bg-filter-panel-apply-border, #1a73e8);
      border-radius: 4px;
      background: var(--bg-filter-panel-apply-bg, #1a73e8);
      color: var(--bg-filter-panel-apply-color, #fff);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    `;

    btnRow.appendChild(clearBtn);
    btnRow.appendChild(applyBtn);
    panel.appendChild(btnRow);

    // Actions
    function applyFilter(): void {
      const val = input.value;
      if (val === '') {
        filteringPlugin!.removeFilter(columnId);
      } else {
        filteringPlugin!.setFilter(columnId, val, select.value);
      }
      dismissFilterPanel();
    }

    function clearFilter(): void {
      filteringPlugin!.removeFilter(columnId);
      dismissFilterPanel();
    }

    applyBtn.addEventListener('click', applyFilter);
    clearBtn.addEventListener('click', clearFilter);

    // Keyboard: Enter → apply, Escape → dismiss
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyFilter();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dismissFilterPanel();
      }
    });

    select.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissFilterPanel();
      }
    });

    // Append and focus
    document.body.appendChild(panel);
    activeFilterPanel = panel;

    // Ensure panel stays within viewport
    requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        panel.style.left = `${Math.max(0, window.innerWidth - rect.width - 8)}px`;
      }
      if (rect.bottom > window.innerHeight) {
        panel.style.top = `${Math.max(0, anchorY - rect.height - 4)}px`;
      }
    });

    input.focus();

    // Close on click outside (delayed to avoid immediate dismiss)
    const closeHandler = (e: MouseEvent) => {
      if (!panel.contains(e.target as Node)) {
        dismissFilterPanel();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  // ---------------------------------------------------------------------------
  // Cell tooltip (for clipped text)
  // ---------------------------------------------------------------------------

  let tooltipEl: HTMLElement | null = null;
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  function showTooltip(target: HTMLElement, text: string, cursorX?: number, cursorY?: number): void {
    dismissTooltip();
    tooltipTimer = setTimeout(() => {
      const left = cursorX ?? target.getBoundingClientRect().left;
      const top = cursorY != null ? cursorY + 12 : target.getBoundingClientRect().bottom + 4;
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'bg-tooltip';
      tooltipEl.textContent = text;
      tooltipEl.style.cssText = `
        position: fixed;
        left: ${left}px;
        top: ${top}px;
        z-index: 100;
        background: var(--bg-context-menu-bg, #fff);
        border: 1px solid var(--bg-context-menu-border, #d0d0d0);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 4px 10px;
        font-size: 13px;
        white-space: nowrap;
        pointer-events: none;
      `;
      document.body.appendChild(tooltipEl);
    }, 500);
  }

  function dismissTooltip(): void {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  function invalidateHeaders(): void {
    headersRendered = false;
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
  // Plugin initialization
  // ---------------------------------------------------------------------------

  // Lazy reference to grid instance — plugins init before `instance` is assigned
  let instanceRef: GridInstance<TData, TPlugins> | null = null;
  const gridProxy = new Proxy({} as GridInstance<TData, TPlugins>, {
    get(_target, prop) {
      if (!instanceRef) throw new Error('Grid instance not yet initialized');
      return (instanceRef as unknown as Record<string | symbol, unknown>)[prop];
    },
  });

  function createPluginContext(plugin: GridPlugin): PluginContext<TData> {
    return {
      grid: gridProxy,
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
      registerCellDecorator: () => {
        // Cell decorator pipeline not yet implemented.
        // Use cellRenderer on ColumnDef for per-column custom rendering.
        return () => {};
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
    };
  }

  // ---------------------------------------------------------------------------
  // Grid instance
  // ---------------------------------------------------------------------------

  const instance: GridInstance<TData, TPlugins> = {
    $Infer: null as never, // type-only, never accessed at runtime

    mount(el: HTMLElement): void {
      if (mounted) instance.unmount();
      container = el;
      container.classList.add('bg-grid');
      container.tabIndex = 0;

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
      fakeScrollbar.className = 'bg-grid__scroll'; // keep class for plugin compat
      fakeScrollbar.style.position = 'absolute';
      fakeScrollbar.style.inset = '0';
      fakeScrollbar.style.overflow = 'auto';
      fakeScrollbar.style.zIndex = '1';

      scrollSizer = document.createElement('div');
      scrollSizer.className = 'bg-grid__sizer';
      fakeScrollbar.appendChild(scrollSizer);

      // Frozen column overlay — positioned absolutely over the grid,
      // doesn't participate in horizontal scroll. Syncs vertical scroll
      // via transform in the scroll handler (no lag since it never
      // moves horizontally with the scrollbar).
      const frozenLeftCols = options.frozenLeftColumns ?? 0;
      if (frozenLeftCols > 0) {
        frozenColOverlay = document.createElement('div');
        frozenColOverlay.className = 'bg-grid__frozen-overlay';
        frozenColOverlay.style.position = 'absolute';
        frozenColOverlay.style.top = '0';
        frozenColOverlay.style.left = '0';
        // height set dynamically in render() to match content
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
      selectionLayer = new SelectionLayer(cellContainer);
      selectionLayer.setFillHandleEnabled(options.selection?.fillHandle !== false);

      // Fill handle drag → copy source values to target rows
      selectionLayer.setFillDragHandler(({ sourceRange, targetRange }) => {
        const state = store.getState();
        const columns = state.columns;
        const sourceRowCount = sourceRange.endRow - sourceRange.startRow + 1;
        const sourceColCount = sourceRange.endCol - sourceRange.startCol + 1;
        const isVertical = targetRange.startCol === sourceRange.startCol && targetRange.endCol === sourceRange.endCol;
        const isHorizontal = targetRange.startRow === sourceRange.startRow && targetRange.endRow === sourceRange.endRow;

        // Collect source values per column to detect series patterns
        function getSourceValues(colIdx: number): unknown[] {
          const col = columns[colIdx];
          if (!col?.accessorKey) return [];
          const vals: unknown[] = [];
          for (let r = sourceRange.startRow; r <= sourceRange.endRow; r++) {
            vals.push((state.data[r] as Record<string, unknown>)?.[col.accessorKey]);
          }
          return vals;
        }

        // Detect numeric step from source values
        function detectStep(values: unknown[]): number | null {
          if (values.length < 2) return null;
          const nums = values.filter((v): v is number => typeof v === 'number');
          if (nums.length !== values.length) return null;
          const step = nums[1]! - nums[0]!;
          for (let i = 2; i < nums.length; i++) {
            if (Math.abs((nums[i]! - nums[i - 1]!) - step) > 1e-10) return null;
          }
          return step;
        }

        if (isVertical) {
          // Fill rows — detect series per column
          for (let col = targetRange.startCol; col <= targetRange.endCol; col++) {
            const column = columns[col];
            if (!column || column.editable === false) continue;

            const sourceVals = getSourceValues(col);
            const step = detectStep(sourceVals);
            const isDown = targetRange.startRow > sourceRange.endRow;

            for (let row = targetRange.startRow; row <= targetRange.endRow; row++) {
              const offset = isDown
                ? row - sourceRange.endRow
                : sourceRange.startRow - row;
              let value: unknown;

              if (step !== null && sourceVals.length >= 2) {
                // Series: continue the pattern
                const lastVal = isDown
                  ? (sourceVals[sourceVals.length - 1] as number)
                  : (sourceVals[0] as number);
                value = isDown
                  ? lastVal + step * offset
                  : lastVal - step * offset;
              } else {
                // Copy: cycle through source values
                const srcIdx = (row - targetRange.startRow) % sourceRowCount;
                const srcRow = state.data[sourceRange.startRow + srcIdx];
                if (srcRow && column.accessorKey) {
                  value = (srcRow as Record<string, unknown>)[column.accessorKey];
                }
              }

              if (value !== undefined) {
                instance.updateCell(row, column.id, value);
              }
            }
          }
        } else if (isHorizontal) {
          // Fill columns — copy source column values to target columns
          for (let row = targetRange.startRow; row <= targetRange.endRow; row++) {
            for (let col = targetRange.startCol; col <= targetRange.endCol; col++) {
              const column = columns[col];
              if (!column || column.editable === false) continue;

              const srcColIdx = sourceRange.startCol + ((col - targetRange.startCol) % sourceColCount);
              const srcCol = columns[srcColIdx];
              if (!srcCol?.accessorKey) continue;

              const value = (state.data[row] as Record<string, unknown>)?.[srcCol.accessorKey];
              if (value !== undefined) {
                instance.updateCell(row, column.id, value);
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

      // Events — scroll on fakeScrollbar, wheel forwarded from viewport
      fakeScrollbar.addEventListener('scroll', handleScroll, { passive: true });
      viewport.addEventListener('wheel', handleWheel, { passive: false });
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
      resizeObserver = new ResizeObserver(() => scheduleRender());
      resizeObserver.observe(container);

      mounted = true;
      recomputeMeasurements();
      scheduleRender();
      emitter.emit('mount');
    },

    unmount(): void {
      if (!mounted) return;

      fakeScrollbar?.removeEventListener('scroll', handleScroll);
      viewport?.removeEventListener('wheel', handleWheel);
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
      headersRendered = false;

      emitter.emit('unmount');
    },

    destroy(): void {
      // Skip if grid was re-mounted (StrictMode compatibility)
      if (mounted) return;
      pluginRegistry.destroyAll();
      emitter.removeAllListeners();
    },

    getData: () => store.getState().data,

    setData(data: TData[]): void {
      store.setData(data);
      store.update('rowHeights', () => ({
        rowHeights: data.map((_, i) => getRowHeight(i)),
      }));
      rebuildHierarchy();
      recomputeMeasurements();
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
      const oldValue = store.getState().data[dataIndex];
      store.setCellValue(dataIndex, columnId, value);
      const newRow = store.getState().data[dataIndex];
      if (oldValue !== undefined && newRow !== undefined) {
        emitter.emit('data:change', [
          { rowIndex, columnId, oldValue, newValue: value, row: newRow },
        ]);
        options.onDataChange?.([
          { rowIndex, columnId, oldValue, newValue: value, row: newRow },
        ]);
      }
      scheduleRender();
    },

    getPinnedTopRows: () => store.getState().pinnedTopRows,

    setPinnedTopRows(rows: TData[]): void {
      store.update('pinnedRows', () => ({ pinnedTopRows: rows }));
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

    getPinnedBottomRows: () => store.getState().pinnedBottomRows,

    setPinnedBottomRows(rows: TData[]): void {
      store.update('pinnedRows', () => ({ pinnedBottomRows: rows }));
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
      // Reset freeze clip if column count changed
      if (freezeClipWidth !== null) {
        freezeClipWidth = null;
      }
      invalidateHeaders();
      recomputeMeasurements();
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

    getSelection: () => store.getState().selection,

    setSelection(selection: Selection): void {
      store.setSelection(selection);
      emitter.emit('selection:change', selection);
      scheduleRender();
    },

    clearSelection(): void {
      instance.setSelection(createEmptySelection());
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
        const fullWidth = measurements.colOffsets[state.frozenLeftColumns]!;
        freezeClipWidth = Math.max(0, Math.min(width, fullWidth));
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
      const hierarchyState = buildHierarchyState(state.data, expanded);
      store.update('hierarchy', () => ({ hierarchyState }));
      recomputeMeasurements();
      scheduleRender();
    },

    expandAll(): void {
      if (!hierarchyConfig) return;
      const state = store.getState();
      const expanded = new Set<string | number>();
      for (const row of state.data) {
        expanded.add(hierarchyConfig.getRowId(row));
      }
      const hierarchyState = buildHierarchyState(state.data, expanded);
      store.update('hierarchy', () => ({ hierarchyState }));
      recomputeMeasurements();
      scheduleRender();
    },

    collapseAll(): void {
      if (!hierarchyConfig) return;
      const state = store.getState();
      const hierarchyState = buildHierarchyState(state.data, new Set());
      store.update('hierarchy', () => ({ hierarchyState }));
      recomputeMeasurements();
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

    getPlugin: <T,>(id: string) => pluginRegistry.getPlugin<T>(id),
    getState: () => store.getState(),
    getContainer: () => container,

    batch(fn: () => void): void {
      store.batch(fn);
      scheduleRender();
    },

    refresh(): void {
      recomputeMeasurements();
      scheduleRender();
    },
  };

  // Set the lazy reference so plugins can access the grid instance
  instanceRef = instance;

  // Register and init plugins (after instance is created)
  if (options.plugins?.length) {
    pluginRegistry.register(options.plugins);
    pluginRegistry.initAll(createPluginContext);
  }

  // Initial measurement
  recomputeMeasurements();

  return instance;
}
