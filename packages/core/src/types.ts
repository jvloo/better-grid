// ============================================================================
// Core Types — @better-grid/core
// ============================================================================

// ---------------------------------------------------------------------------
// Utility Types
// ---------------------------------------------------------------------------

/** Merge a union of object types into a single intersection */
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

// ---------------------------------------------------------------------------
// Cell Position & Selection
// ---------------------------------------------------------------------------

export interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

export interface CellRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface Selection {
  /** The active (anchor) cell */
  active: CellPosition | null;
  /** Selected ranges (supports multi-range via Ctrl+click) */
  ranges: CellRange[];
}

// ---------------------------------------------------------------------------
// Scroll & Viewport
// ---------------------------------------------------------------------------

export interface ScrollState {
  scrollTop: number;
  scrollLeft: number;
}

export interface VirtualRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

// ---------------------------------------------------------------------------
// Cell Change
// ---------------------------------------------------------------------------

export interface CellChange<TData = unknown> {
  rowIndex: number;
  columnId: string;
  oldValue: unknown;
  newValue: unknown;
  row: TData;
}

// ---------------------------------------------------------------------------
// Cell Rendering
// ---------------------------------------------------------------------------

export interface CellStyle {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CellRenderContext<TData = unknown> {
  rowIndex: number;
  colIndex: number;
  row: TData;
  column: ColumnDef<TData>;
  value: unknown;
  isSelected: boolean;
  isActive: boolean;
  style: CellStyle;
}

export type CellRenderer<TData = unknown> = (
  container: HTMLElement,
  context: CellRenderContext<TData>,
) => void | (() => void);

export interface CellTypeRenderer {
  render(container: HTMLElement, context: CellRenderContext): void | (() => void);
  getStringValue?(context: CellRenderContext): string;
  parseStringValue?(value: string, context: CellRenderContext): unknown;
}

// ---------------------------------------------------------------------------
// Column Definitions
// ---------------------------------------------------------------------------

/** Built-in cell types for formatting and editing */
export type CellType = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'bigint' | 'select' | 'toggle' | (string & {});

/** Editor mode override */
export type EditorType = 'text' | 'dropdown';

/** Dropdown option for select/autocomplete columns */
export interface ColumnOption {
  label: string;
  value: string | number | boolean;
}

export interface ColumnDef<TData = unknown> {
  id: string;
  accessorKey?: keyof TData & string;
  accessorFn?: (row: TData, rowIndex: number) => unknown;
  header: string | (() => HTMLElement | string);

  // Layout
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;

  // Alignment
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';

  // Cell rendering
  cellType?: CellType;
  cellRenderer?: CellRenderer<TData>;

  // Editing
  editable?: boolean;
  editor?: EditorType;
  options?: (string | ColumnOption)[];

  // Sorting
  sortable?: boolean;
  comparator?: (a: unknown, b: unknown) => number;

  // Formatting
  dateFormat?: 'short' | 'medium' | 'long' | 'full' | 'iso' | 'month-year' | 'year' | 'time' | 'datetime';
  hideZero?: boolean;

  // Custom value parsing/formatting (e.g., for arbitrary precision with decimal.js)
  valueParser?: (value: string) => unknown;
  valueFormatter?: (value: unknown) => string;

  // Validation
  required?: boolean;
  rules?: ColumnValidationRule[];

  // Extensibility (for third-party plugins)
  meta?: Record<string, unknown>;
}

/** Validation rule for a column */
export interface ColumnValidationRule {
  /** Return true if valid, or an error message string if invalid */
  validate: (value: unknown, row: unknown) => boolean | string;
  /** Fallback error message when validate returns false */
  message?: string;
}

// ---------------------------------------------------------------------------
// Header & Footer Rows (multi-level)
// ---------------------------------------------------------------------------

export interface HeaderCell {
  id: string;
  columnId?: string;
  content: string | (() => HTMLElement | string);
  colSpan?: number;
  rowSpan?: number;
}

export interface HeaderRow {
  id: string;
  height?: number;
  cells: HeaderCell[];
}

export interface FooterCell {
  id: string;
  columnId?: string;
  content: string | (() => HTMLElement | string);
  colSpan?: number;
}

export interface FooterRow {
  id: string;
  height?: number;
  cells: FooterCell[];
}

// ---------------------------------------------------------------------------
// Selection Options
// ---------------------------------------------------------------------------

export interface SelectionOptions {
  mode: 'cell' | 'row' | 'range' | 'none';
  multiRange?: boolean;
}

// ---------------------------------------------------------------------------
// Virtualization Options
// ---------------------------------------------------------------------------

export interface VirtualizationOptions {
  /** Extra rows rendered outside viewport for smooth scroll. Default: 5 */
  overscanRows?: number;
  /** Extra columns rendered outside viewport. Default: 3 */
  overscanColumns?: number;
}

// ---------------------------------------------------------------------------
// Freeze Clip Options
// ---------------------------------------------------------------------------

export interface FreezeClipOptions {
  /** Minimum number of frozen columns that remain visible when clipping. Default: 1. Set 0 to allow hiding all. */
  minVisible?: number;
}

// ---------------------------------------------------------------------------
// Grid Events
// ---------------------------------------------------------------------------

export interface GridEvents<TData = unknown> {
  // Selection
  'selection:change': (selection: Selection) => void;
  'selection:start': (cell: CellPosition) => void;
  'selection:extend': (range: CellRange) => void;

  // Scroll
  scroll: (state: ScrollState) => void;

  // Data
  'data:change': (changes: CellChange<TData>[]) => void;
  'data:set': (data: TData[]) => void;

  // Column
  'column:resize': (columnId: string, width: number) => void;

  // Freeze clip
  'freezeClip:change': (clipWidth: number, fullFrozenWidth: number) => void;

  // Keyboard
  'key:down': (event: KeyboardEvent, cell: CellPosition | null) => void;
  'key:enter': (cell: CellPosition) => void;
  'key:escape': (cell: CellPosition) => void;
  'key:tab': (cell: CellPosition, direction: 'forward' | 'backward') => void;

  // Cell
  'cell:click': (cell: CellPosition, event: MouseEvent) => void;
  'cell:dblclick': (cell: CellPosition, event: MouseEvent) => void;
  'cell:focus': (cell: CellPosition) => void;
  'cell:blur': (cell: CellPosition) => void;

  // Lifecycle
  mount: () => void;
  unmount: () => void;
  render: (visibleRange: VirtualRange) => void;

  // Plugin custom events (extensible)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => void;
}

// ---------------------------------------------------------------------------
// Grid Options
// ---------------------------------------------------------------------------

export interface GridOptions<
  TData = unknown,
  TPlugins extends GridPlugin[] = GridPlugin[],
> {
  columns: ColumnDef<TData>[];
  data: TData[];
  rowHeight?: number | ((rowIndex: number) => number);
  headerHeight?: number;
  frozenTopRows?: number;
  frozenLeftColumns?: number;
  freezeClip?: boolean | FreezeClipOptions;
  headerRows?: HeaderRow[];
  footerRows?: FooterRow[];
  selection?: SelectionOptions;
  virtualization?: VirtualizationOptions;
  plugins?: TPlugins;
  onSelectionChange?: (selection: Selection) => void;
  onDataChange?: (changes: CellChange<TData>[]) => void;
  onColumnResize?: (columnId: string, width: number) => void;
}

// ---------------------------------------------------------------------------
// Grid State
// ---------------------------------------------------------------------------

export interface GridState<TData = unknown> {
  data: TData[];
  columns: ColumnDef<TData>[];
  columnWidths: number[];
  rowHeights: number[];
  scrollTop: number;
  scrollLeft: number;
  visibleRange: VirtualRange;
  selection: Selection;
  frozenTopRows: number;
  frozenLeftColumns: number;
  pluginState: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Plugin System
// ---------------------------------------------------------------------------

export interface KeyBinding {
  key: string;
  handler: (event: KeyboardEvent, cell: CellPosition | null) => boolean | void;
  priority?: number;
}

export interface CellDecorator {
  id: string;
  priority?: number;
  decorate(cell: HTMLElement, context: CellRenderContext): void;
  cleanup?(cell: HTMLElement): void;
}

export interface Command {
  id: string;
  execute(payload: unknown): void;
  undo?(payload: unknown): void;
}

export interface PluginContext<TData = unknown> {
  grid: GridInstance<TData>;
  store: import('./state/store').StateStore<TData>;
  on<E extends keyof GridEvents<TData>>(event: E, handler: GridEvents<TData>[E]): () => void;
  emit<E extends keyof GridEvents<TData>>(event: E, ...args: Parameters<GridEvents<TData>[E]>): void;
  registerKeyBinding(binding: KeyBinding): () => void;
  registerCellDecorator(decorator: CellDecorator): () => void;
  registerCellType(type: string, renderer: CellTypeRenderer): () => void;
  registerCommand(command: Command): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expose(api: Record<string, any>): void;
  getPluginApi<T>(pluginId: string): T | undefined;
}

export interface GridPlugin<TId extends string = string> {
  id: TId;
  dependencies?: string[];
  $types?: {
    columnDef?: Record<string, unknown>;
    cellState?: Record<string, unknown>;
    gridOptions?: Record<string, unknown>;
    gridState?: Record<string, unknown>;
    events?: Record<string, unknown>;
  };
  init?(ctx: PluginContext): (() => void) | void;
  hooks?: {
    beforeCellCommit?(event: { rowIndex: number; colIndex: number; oldValue: unknown; newValue: unknown }):
      | { rowIndex: number; colIndex: number; oldValue: unknown; newValue: unknown }
      | false;
    afterCellCommit?(event: { rowIndex: number; colIndex: number; oldValue: unknown; newValue: unknown }): void;
    beforeRender?(rows: unknown[]): unknown[];
    onKeyDown?(event: KeyboardEvent, cell: CellPosition | null): boolean | void;
    onHeaderClick?(columnId: string): void;
    onSelectionChange?(selection: Selection): void;
  };
  cellRenderers?: Record<string, CellTypeRenderer>;
}

// ---------------------------------------------------------------------------
// Grid Instance
// ---------------------------------------------------------------------------

export interface GridInstance<
  TData = unknown,
  TPlugins extends GridPlugin[] = GridPlugin[],
> {
  /** Type inference — use as `typeof grid.$Infer.Row` */
  $Infer: {
    Row: TData;
    CellState: unknown;
    GridState: GridState<TData>;
    Plugins: TPlugins;
  };

  mount(container: HTMLElement): void;
  unmount(): void;
  destroy(): void;

  getData(): TData[];
  setData(data: TData[]): void;
  updateRow(rowIndex: number, data: Partial<TData>): void;
  updateCell(rowIndex: number, columnId: string, value: unknown): void;

  getColumns(): ColumnDef<TData>[];
  setColumns(columns: ColumnDef<TData>[]): void;
  setColumnWidth(columnId: string, width: number): void;

  getSelection(): Selection;
  setSelection(selection: Selection): void;
  clearSelection(): void;

  /** Get the current freeze clip width in pixels, or null if no clip is active. */
  getFreezeClipWidth(): number | null;
  /** Set the freeze clip width in pixels. Pass null to remove the clip. */
  setFreezeClipWidth(width: number | null): void;

  scrollTo(row: number, column?: number): void;
  getScrollState(): ScrollState;

  on<E extends keyof GridEvents<TData>>(event: E, handler: GridEvents<TData>[E]): () => void;
  off<E extends keyof GridEvents<TData>>(event: E, handler: GridEvents<TData>[E]): void;

  getPlugin<T>(pluginId: string): T | undefined;
  getState(): GridState<TData>;

  batch(fn: () => void): void;
  refresh(): void;
}
