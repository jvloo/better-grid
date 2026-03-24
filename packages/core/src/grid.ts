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
  const pluginRegistry = new PluginRegistry();
  const keyBindings: KeyBinding[] = [];
  const commands = new Map<string, Command>();

  let container: HTMLElement | null = null;
  let scrollContainer: HTMLElement | null = null;
  let contentSizer: HTMLElement | null = null;
  let headerContainer: HTMLElement | null = null;
  let cellContainer: HTMLElement | null = null;
  let selectionLayer: SelectionLayer | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let mounted = false;

  const headerHeight = options.headerHeight ?? DEFAULT_HEADER_HEIGHT;

  // Resolve row height function
  const getRowHeight =
    typeof options.rowHeight === 'function'
      ? options.rowHeight
      : () => options.rowHeight as number ?? DEFAULT_ROW_HEIGHT;

  // Initialize columns
  columnManager.setColumns(options.columns);

  // Initialize state store
  const initialState: GridState<TData> = {
    data: options.data,
    columns: options.columns,
    columnWidths: columnManager.getWidths(),
    rowHeights: options.data.map((_, i) => getRowHeight(i)),
    scrollTop: 0,
    scrollLeft: 0,
    visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
    selection: createEmptySelection(),
    frozenTopRows: options.frozenTopRows ?? 0,
    frozenBottomRows: options.frozenBottomRows ?? 0,
    frozenLeftColumns: options.frozenLeftColumns ?? 0,
    frozenRightColumns: options.frozenRightColumns ?? 0,
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
    if (!mounted) return;
    requestAnimationFrame(render);
  }

  function render(): void {
    if (!mounted || !scrollContainer || !contentSizer || !cellContainer) return;

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
        frozenBottomRows: state.frozenBottomRows,
        frozenLeftColumns: state.frozenLeftColumns,
        frozenRightColumns: state.frozenRightColumns,
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

    // Ensure frozen columns are always in visible range
    const renderStartCol = Math.min(visibleRange.startCol, state.frozenLeftColumns > 0 ? 0 : visibleRange.startCol);

    // Render cells
    rendering.renderCells(
      cellContainer,
      visibleRange.startRow,
      visibleRange.endRow,
      renderStartCol,
      visibleRange.endCol,
      state.data,
      state.columns,
      measurements,
      state.selection,
      state.frozenLeftColumns,
      state.scrollLeft,
    );

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
    emitter.emit('scroll', { scrollTop, scrollLeft });
    scheduleRender();
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!cellContainer) return;
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
    if (!headerContainer || headersRendered) return;
    headersRendered = true;

    headerContainer.innerHTML = '';

    for (let col = 0; col < state.columns.length; col++) {
      const column = state.columns[col]!;
      const left = measurements.colOffsets[col]!;
      const width = measurements.colOffsets[col + 1]! - left;

      const headerCell = document.createElement('div');
      headerCell.className = 'bg-header-cell';
      headerCell.style.position = 'absolute';
      headerCell.style.transform = `translate3d(${left}px, 0, 0)`;
      headerCell.style.width = `${width}px`;
      headerCell.style.height = `${headerHeight}px`;
      headerCell.style.boxSizing = 'border-box';
      headerCell.style.display = 'flex';
      headerCell.style.alignItems = 'center';
      headerCell.style.padding = '0 8px';
      headerCell.style.fontWeight = '600';
      headerCell.style.borderRight = '1px solid #e0e0e0';
      headerCell.style.borderBottom = '2px solid #d0d0d0';
      headerCell.style.background = '#f8f9fa';
      headerCell.style.userSelect = 'none';
      headerCell.style.whiteSpace = 'nowrap';
      headerCell.style.overflow = 'hidden';
      headerCell.style.textOverflow = 'ellipsis';

      if (typeof column.header === 'function') {
        const content = column.header();
        if (typeof content === 'string') {
          headerCell.textContent = content;
        } else {
          headerCell.appendChild(content);
        }
      } else {
        headerCell.textContent = column.header;
      }

      headerCell.dataset.col = String(col);
      headerCell.addEventListener('click', () => {
        // Notify plugins (sorting can hook into this)
        for (const plugin of pluginRegistry.getAllPlugins()) {
          plugin.hooks?.onHeaderClick?.(column.id);
        }
      });

      headerContainer.appendChild(headerCell);
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
      registerCellType: (type, renderer) => rendering.registerCellType(type, renderer),
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
      container.appendChild(scrollContainer);

      // Selection layer (inside cell container so offsets align with cells)
      selectionLayer = new SelectionLayer(cellContainer);

      // Events
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      cellContainer.addEventListener('pointerdown', handlePointerDown);
      cellContainer.addEventListener('dblclick', handleDblClick);
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

      if (container) {
        container.innerHTML = '';
        container.classList.remove('bg-grid');
      }

      container = null;
      scrollContainer = null;
      contentSizer = null;
      cellContainer = null;
      selectionLayer = null;
      resizeObserver = null;
      mounted = false;

      emitter.emit('unmount');
    },

    destroy(): void {
      instance.unmount();
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
        columns,
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
