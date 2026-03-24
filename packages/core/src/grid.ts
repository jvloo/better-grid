// ============================================================================
// createGrid() — Main factory function
// ============================================================================

import type {
  GridOptions,
  GridInstance,
  GridState,
  GridPlugin,
  Selection,
  ScrollState,
  ColumnDef,
  CellPosition,
  KeyBinding,
  Command,
  PluginContext,
} from './types';
import { EventEmitter } from './events/emitter';
import { StateStore } from './state/store';
import { PluginRegistry } from './plugin/registry';
import { ColumnManager } from './columns/manager';
import { VirtualizationEngine } from './virtualization/engine';
import type { LayoutMeasurements } from './virtualization/engine';
import { RenderingPipeline } from './rendering/pipeline';
import { SelectionLayer } from './rendering/layers';
import { createEmptySelection, createCellSelection, extendSelection } from './selection/model';
import { navigateCell, navigateTab, getNavigationDirection } from './keyboard/navigation';
import { computeZoneDimensions } from './virtualization/layout';

const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_HEADER_HEIGHT = 40;

export function createGrid<
  TData = unknown,
  TPlugins extends GridPlugin[] = GridPlugin[],
>(options: GridOptions<TData, TPlugins>): GridInstance<TData, TPlugins> {
  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emitter = new EventEmitter<any>();
  const columnManager = new ColumnManager<TData>();
  const virtualization = new VirtualizationEngine(
    options.virtualization?.overscanRows ?? 5,
    options.virtualization?.overscanColumns ?? 3,
  );
  const rendering = new RenderingPipeline<TData>();
  const frozenRendering = new RenderingPipeline<TData>();
  const pluginRegistry = new PluginRegistry();
  const keyBindings: KeyBinding[] = [];
  const commands = new Map<string, Command>();

  let container: HTMLElement | null = null;
  let scrollContainer: HTMLElement | null = null;
  let contentSizer: HTMLElement | null = null;
  let headerContainer: HTMLElement | null = null;
  let cellContainer: HTMLElement | null = null;
  let frozenColOverlay: HTMLElement | null = null;
  let frozenHeaderOverlay: HTMLElement | null = null;
  let frozenCellOverlay: HTMLElement | null = null;
  let selectionLayer: SelectionLayer | null = null;
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
    rowHeights: options.data.map((_, i) => getRowHeight(i)),
    scrollTop: 0,
    scrollLeft: 0,
    visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
    selection: createEmptySelection(),
    frozenTopRows: options.frozenTopRows ?? 0,
    frozenLeftColumns: options.frozenLeftColumns ?? 0,
    pluginState: {},
  };

  const store = new StateStore<TData>(initialState);

  // Forward store changes to user callbacks
  if (options.onSelectionChange) {
    store.subscribe('selection', () => {
      options.onSelectionChange!(store.getState().selection);
    });
  }

  // ---------------------------------------------------------------------------
  // Measurements
  // ---------------------------------------------------------------------------

  function recomputeMeasurements(): void {
    const state = store.getState();
    virtualization.recompute(
      state.data.length,
      state.columns.length,
      (i) => state.rowHeights[i] ?? DEFAULT_ROW_HEIGHT,
      (i) => columnManager.getWidth(i),
    );
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function scheduleRender(): void {
    if (!scrollContainer || !cellContainer) return;
    requestAnimationFrame(render);
  }

  function render(): void {
    if (!scrollContainer || !contentSizer || !cellContainer) return;

    const state = store.getState();
    const measurements = virtualization.getMeasurements();

    // Update content sizer (header is sticky inside, cells below)
    contentSizer.style.width = `${measurements.totalWidth}px`;
    contentSizer.style.height = `${measurements.totalHeight + headerHeight}px`;

    // Cell container height must match data height exactly
    cellContainer.style.height = `${measurements.totalHeight}px`;

    // Render headers
    renderHeaders(state, measurements);

    // Compute frozen dimensions
    const zoneDims = computeZoneDimensions(
      {
        frozenTopRows: state.frozenTopRows,
        frozenBottomRows: 0,
        frozenLeftColumns: state.frozenLeftColumns,
        frozenRightColumns: 0,
      },
      (i) => state.rowHeights[i] ?? DEFAULT_ROW_HEIGHT,
      (i) => columnManager.getWidth(i),
    );

    // Compute visible range
    const viewportWidth = scrollContainer.clientWidth;
    const viewportHeight = scrollContainer.clientHeight;

    // Adjust scrollTop for header — data rows start after the sticky header
    const dataScrollTop = Math.max(0, state.scrollTop - headerHeight);

    const visibleRange = virtualization.computeVisibleRange(
      dataScrollTop,
      state.scrollLeft,
      viewportWidth,
      viewportHeight - headerHeight,
      zoneDims.frozenTopHeight,
      zoneDims.frozenBottomHeight,
      zoneDims.frozenLeftWidth,
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
      state.data,
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
        state.data,
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
      // Match content height so shadow doesn't extend past data
      const contentHeight = measurements.totalHeight + headerHeight;
      frozenColOverlay!.style.height = `${Math.min(contentHeight, scrollContainer!.clientHeight)}px`;
      frozenColOverlay!.style.bottom = 'auto';

      // Offset scroll content so cells don't bleed behind frozen overlay.
      // padding-left pushes content right, negative margin on sizer
      // compensates so scroll dimensions stay correct.
      scrollContainer!.style.paddingLeft = `${frozenWidth}px`;
      contentSizer!.style.marginLeft = `-${frozenWidth}px`;
    }

    // Render selection layer
    selectionLayer?.render(state.selection, measurements);

    emitter.emit('render', visibleRange);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleScroll(): void {
    if (!scrollContainer) return;
    const scrollTop = scrollContainer.scrollTop;
    const scrollLeft = scrollContainer.scrollLeft;
    store.setScroll(scrollTop, scrollLeft);

    // Sync frozen cell overlay vertical position.
    // The frozen overlay is outside the scroll container, so it doesn't
    // scroll. We translate the data cells portion to match scrollTop.
    // Header stays at top (no vertical translate needed).
    if (frozenCellOverlay) {
      const dataScrollTop = Math.max(0, scrollTop - headerHeight);
      frozenCellOverlay.style.transform = `translate3d(0, ${-dataScrollTop}px, 0)`;
    }

    emitter.emit('scroll', { scrollTop, scrollLeft });
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

    if (event.shiftKey && store.getState().selection.active) {
      // Extend selection
      const newSelection = extendSelection(store.getState().selection, cell);
      store.setSelection(newSelection);
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

  function handleKeyDown(event: KeyboardEvent): void {
    const state = store.getState();

    // Run plugin key bindings first (higher priority first)
    const sorted = [...keyBindings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const binding of sorted) {
      const result = binding.handler(event, state.selection.active);
      if (result === true) {
        event.preventDefault();
        return;
      }
    }

    emitter.emit('key:down', event, state.selection.active);

    if (!state.selection.active) return;

    const bounds = {
      rowCount: state.data.length,
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

    for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
      const row = headerRows![rowIdx]!;
      const rowHeight = row.height ?? singleHeaderRowHeight;
      const isLastRow = rowIdx === totalRows - 1;
      let colIndex = 0;

      for (const cell of row.cells) {
        const span = cell.colSpan ?? 1;
        const rSpan = cell.rowSpan ?? 1;

        if (colIndex >= state.columns.length) break;

        const left = measurements.colOffsets[colIndex]!;
        const endCol = Math.min(colIndex + span, state.columns.length);
        const width = measurements.colOffsets[endCol]! - left;
        const height = rowHeight * rSpan;

        // Determine if any spanned column is frozen
        const isFrozen = colIndex < state.frozenLeftColumns;
        const isLastFrozenCol = endCol - 1 === state.frozenLeftColumns - 1;

        // Only last-row headers get sort/context menu (group headers don't sort)
        const targetColumnId = isLastRow
          ? (cell.columnId ?? state.columns[colIndex]?.id)
          : undefined;

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
          resizable: isLastRow && span === 1 && state.columns[colIndex]?.resizable !== false,
        });

        // Add classes for multi-header styling
        if (span > 1) {
          headerEl.classList.add('bg-header-cell--span');
        }
        if (!isLastRow) {
          headerEl.classList.add('bg-header-cell--group');
        }

        appendHeaderCell(headerEl, isFrozen);
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
  }): HTMLElement {
    const cell = document.createElement('div');
    let cls = 'bg-header-cell';
    if (opts.isFrozen) cls += ' bg-header-cell--frozen-left';
    if (opts.isLastFrozenCol) cls += ' bg-header-cell--frozen-col-last';
    cell.className = cls;
    cell.style.position = 'absolute';
    cell.style.transform = `translate3d(${opts.left}px, ${opts.top}px, 0)`;
    cell.style.width = `${opts.width}px`;
    cell.style.height = `${opts.height}px`;
    cell.dataset.col = String(opts.colIndex);
    cell.dataset.baseLeft = String(opts.left);

    if (typeof opts.content === 'function') {
      const content = opts.content();
      if (typeof content === 'string') {
        cell.textContent = content;
      } else {
        cell.appendChild(content);
      }
    } else {
      cell.textContent = opts.content;
    }

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
    }

    if (opts.resizable) {
      const handle = document.createElement('div');
      handle.className = 'bg-resize-handle';
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        startColumnResize(opts.colIndex, e);
      });
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
    if (!scrollContainer) return;

    const measurements = virtualization.getMeasurements();
    const rowTop = measurements.rowOffsets[cell.rowIndex]!;
    const rowBottom = measurements.rowOffsets[cell.rowIndex + 1]!;
    const colLeft = measurements.colOffsets[cell.colIndex]!;
    const colRight = measurements.colOffsets[cell.colIndex + 1]!;

    const viewTop = scrollContainer.scrollTop - headerHeight;
    const viewBottom = viewTop + scrollContainer.clientHeight - headerHeight;
    const viewLeft = scrollContainer.scrollLeft;
    const viewRight = viewLeft + scrollContainer.clientWidth;

    // Vertical scroll
    if (rowTop < viewTop) {
      scrollContainer.scrollTop = rowTop + headerHeight;
    } else if (rowBottom > viewBottom) {
      scrollContainer.scrollTop = rowBottom - scrollContainer.clientHeight + headerHeight * 2;
    }

    // Horizontal scroll (skip if frozen column)
    const state = store.getState();
    if (cell.colIndex >= state.frozenLeftColumns) {
      if (colLeft < viewLeft) {
        scrollContainer.scrollLeft = colLeft;
      } else if (colRight > viewRight) {
        scrollContainer.scrollLeft = colRight - scrollContainer.clientWidth;
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
      registerCellDecorator: (_decorator) => {
        // TODO: implement decorator pipeline
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

      // Create scroll container
      scrollContainer = document.createElement('div');
      scrollContainer.className = 'bg-grid__scroll';
      scrollContainer.style.position = 'relative';
      scrollContainer.style.width = '100%';
      scrollContainer.style.height = '100%';
      scrollContainer.style.overflow = 'auto';
      scrollContainer.style.zIndex = '0'; // stacking context below frozen overlay

      // Content sizer (sets scroll dimensions)
      contentSizer = document.createElement('div');
      contentSizer.className = 'bg-grid__sizer';
      contentSizer.style.position = 'relative';

      // Header container (sticky at top)
      headerContainer = document.createElement('div');
      headerContainer.className = 'bg-grid__headers';
      headerContainer.style.position = 'sticky';
      headerContainer.style.top = '0';
      headerContainer.style.height = `${headerHeight}px`;
      headerContainer.style.zIndex = '10';
      headerContainer.style.background = '#f8f9fa';

      // Cell container (offset by header height)
      cellContainer = document.createElement('div');
      cellContainer.className = 'bg-grid__cells';
      cellContainer.style.position = 'relative';

      contentSizer.appendChild(headerContainer);
      contentSizer.appendChild(cellContainer);
      scrollContainer.appendChild(contentSizer);

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
        frozenHeaderOverlay.style.position = 'relative';
        frozenHeaderOverlay.style.height = `${headerHeight}px`;
        frozenHeaderOverlay.style.zIndex = '12';
        frozenHeaderOverlay.style.background = 'var(--bg-header-bg, #f8f9fa)';

        // Frozen data cells
        frozenCellOverlay = document.createElement('div');
        frozenCellOverlay.className = 'bg-grid__frozen-cells';
        frozenCellOverlay.style.position = 'relative';

        frozenColOverlay.appendChild(frozenHeaderOverlay);
        frozenColOverlay.appendChild(frozenCellOverlay);
      }

      container.appendChild(scrollContainer);

      // Append frozen overlay AFTER scroll container so it renders on top
      if (frozenColOverlay) {
        container.appendChild(frozenColOverlay);
      }

      // Selection layer (inside cell container so offsets align with cells)
      selectionLayer = new SelectionLayer(cellContainer);

      // Events
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      cellContainer.addEventListener('pointerdown', handlePointerDown);
      cellContainer.addEventListener('dblclick', handleDblClick);
      if (frozenCellOverlay) {
        frozenCellOverlay.addEventListener('pointerdown', handlePointerDown);
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

      scrollContainer?.removeEventListener('scroll', handleScroll);
      cellContainer?.removeEventListener('pointerdown', handlePointerDown);
      cellContainer?.removeEventListener('dblclick', handleDblClick);
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
      scrollContainer = null;
      contentSizer = null;
      headerContainer = null;
      cellContainer = null;
      frozenColOverlay = null;
      frozenHeaderOverlay = null;
      frozenCellOverlay = null;
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
      recomputeMeasurements();
      emitter.emit('data:set', data);
      scheduleRender();
    },

    updateRow(rowIndex: number, data: Partial<TData>): void {
      const current = store.getState().data;
      const newData = [...current];
      newData[rowIndex] = { ...newData[rowIndex], ...data } as TData;
      store.setData(newData);
      scheduleRender();
    },

    updateCell(rowIndex: number, columnId: string, value: unknown): void {
      const oldValue = store.getState().data[rowIndex];
      store.setCellValue(rowIndex, columnId, value);
      const newRow = store.getState().data[rowIndex];
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

    getColumns: () => columnManager.getColumns(),

    setColumns(columns: ColumnDef<TData>[]): void {
      columnManager.setColumns(columns);
      store.update('columns', () => ({
        columns: columnManager.getColumns(),
        columnWidths: columnManager.getWidths(),
      }));
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

    scrollTo(row: number, column?: number): void {
      if (!scrollContainer) return;
      const rowMetrics = virtualization.getRowMetrics(row);
      scrollContainer.scrollTop = rowMetrics.offset;
      if (column !== undefined) {
        const colMetrics = virtualization.getColMetrics(column);
        scrollContainer.scrollLeft = colMetrics.offset;
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
