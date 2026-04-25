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

export interface CellRenderContext<TData = unknown, TContext = unknown> {
  rowIndex: number;
  colIndex: number;
  row: TData;
  column: ColumnDef<TData>;
  value: unknown;
  isSelected: boolean;
  isActive: boolean;
  style: CellStyle;
  context: TContext;
}

export type CellRenderer<TData = unknown, TContext = unknown> = (
  container: HTMLElement,
  context: CellRenderContext<TData, TContext>,
) => void | (() => void);

export interface CellTypeRenderer<TData = unknown, TContext = unknown> {
  render(container: HTMLElement, context: CellRenderContext<TData, TContext>): void | (() => void);
  getStringValue?(context: CellRenderContext<TData, TContext>): string;
  parseStringValue?(value: string, context: CellRenderContext<TData, TContext>): unknown;
}

// ---------------------------------------------------------------------------
// Column Definitions
// ---------------------------------------------------------------------------

/** Built-in cell types for formatting and editing */
export type CellType = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'bigint' | 'select' | 'boolean' | (string & {});

/** Cell editor mode override */
export type CellEditorType =
  | 'text'
  | 'dropdown'
  | 'select'
  | 'selectWithInput'
  | 'number'
  | 'date'
  | 'autocomplete'
  | 'masked';

/** Dropdown option for select/autocomplete columns */
export interface ColumnOption {
  label: string;
  value: string | number | boolean;
}

/** Badge option for badge cellType — extends ColumnOption with styling */
export interface BadgeOption extends ColumnOption {
  /** Text color (e.g. '#166534') */
  color?: string;
  /** Background color (e.g. '#dcfce7') */
  bg?: string;
  /** CSS border shorthand (e.g. '1px solid #7dd3fc') */
  border?: string;
  /** Font weight (e.g. '500', '600', 'bold') */
  fontWeight?: string;
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
  editable?: boolean | ((row: TData, column: ColumnDef<TData>) => boolean);
  cellEditor?: CellEditorType;
  options?: (string | ColumnOption)[];

  // Sorting
  sortable?: boolean;
  comparator?: (a: unknown, b: unknown) => number;

  // Formatting
  hideZero?: boolean;

  /** Format the raw cell value to a display string (render time). */
  valueFormatter?: (value: unknown) => string;
  /** Parse a user-entered string back into the cell value (edit commit time). Return undefined to keep the original. */
  valueParser?: (value: string) => unknown;

  // Conditional styling
  cellStyle?: (value: unknown, row: unknown) => Record<string, string> | undefined;
  cellClass?: (value: unknown, row: unknown) => string | undefined;

  // Extensibility (for third-party plugins)
  meta?: Record<string, unknown>;
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
  /** Show fill handle at bottom-right of selection. Default: true */
  fillHandle?: boolean;
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
// Hierarchy (Row Tree)
// ---------------------------------------------------------------------------

/** Row hierarchy configuration for parent-child tree structures */
export interface HierarchyConfig<TData = unknown> {
  /** Get a stable unique ID for each row */
  getRowId: (row: TData) => string | number;
  /** Get the parent row ID. Return null/undefined for root rows */
  getParentId: (row: TData) => string | number | null | undefined;
  /** Whether rows start expanded. Default: true */
  defaultExpanded?: boolean;
}

/** Hierarchy state maintained by the grid engine when hierarchy is configured */
export interface HierarchyState {
  /** Set of expanded row IDs */
  expandedRows: Set<string | number>;
  /** Mapping from visible row position to original data index */
  visibleRows: number[];
  /** Depth of each row in the tree (for indentation) */
  rowDepths: Map<string | number, number>;
  /** Map from row ID to array of child data indices */
  childrenMap: Map<string | number | null, number[]>;
  /** Set of row IDs that have children */
  parentIds: Set<string | number>;
  /** Map from data index to row ID (reverse lookup) */
  dataIndexToRowId: Map<number, string | number>;
}

// ---------------------------------------------------------------------------
// Grid Options
// ---------------------------------------------------------------------------

// NOTE: `const TPlugins` modifier was specified by the plan but TypeScript only
// allows `const` type-parameter modifiers on functions/methods/classes — not on
// interface declarations (TS1277). The `const` inference for plugin tuples must
// be applied at the function call site (createGrid / useGrid signatures) where
// it actually takes effect. See Task 3.
export interface GridOptions<
  TData = unknown,
  TContext = unknown,
  TPlugins extends readonly GridPlugin[] = readonly GridPlugin[],
> {
  // Required
  data: TData[];
  columns: ColumnDef<TData>[];

  // Mode + features (string opt-in resolved by the react package; core accepts only `plugins`)
  plugins?: TPlugins;

  // Layout (grouped)
  size?: { width?: number | string; height?: number | string };
  frozen?: { top?: number; left?: number; clip?: boolean | FreezeClipOptions };
  pinned?: { top?: TData[]; bottom?: TData[] };
  headers?: HeaderRow[] | { layout: HeaderRow[]; height?: number };
  footers?: FooterRow[] | { layout: FooterRow[]; height?: number };
  rowHeight?: number | ((rowIndex: number) => number);
  /**
   * Default header row height when `headers` is not provided as an object form.
   * Retained as a sibling for the single-header simple case.
   */
  headerHeight?: number;
  tableStyle?: 'bordered' | 'borderless' | 'striped';

  // Behavior
  selection?: SelectionOptions;
  hierarchy?: HierarchyConfig<TData>;
  virtualization?: VirtualizationOptions;

  // Styling — single function form (replaces rowStyles + getRowStyle dual)
  rowStyle?: (row: TData, rowIndex: number) => Record<string, string> | undefined;

  // Closure-over-scope (read via ref every render so handler swaps don't re-init)
  context?: TContext;

  // Events (flat, React idiom)
  onCellChange?: (changes: CellChange<TData>[]) => void;
  onSelectionChange?: (selection: Selection) => void;
  onColumnResize?: (columnId: string, width: number) => void;

  // Reserved for v1.1 slots feature (see spec "Reserved extension points")
  slots?: Partial<GridSlots>;
  slotProps?: Partial<GridSlotProps>;
}

// v1: empty registries; v1.1 will populate via module augmentation.
export interface GridSlots {}
export interface GridSlotProps {}

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
  pinnedTopRows: TData[];
  pinnedBottomRows: TData[];
  hierarchyState: HierarchyState | null;
  /**
   * Plugin-owned state slices. Plugins contribute typed fields here via
   * declaration merging — the base shape is empty:
   *
   *     // inside a plugin package
   *     declare module '@better-grid/core' {
   *       interface PluginState {
   *         sorting: { columnId: string; direction: 'asc' | 'desc' }[];
   *       }
   *     }
   *
   * Consumers then read `grid.getState().pluginState.sorting` with full
   * inference, without the grid core needing to know the sorting plugin exists.
   */
  pluginState: PluginState;
}

/**
 * Augmentation point for plugin-owned state slices. Plugins extend this
 * interface via `declare module '@better-grid/core'` so that
 * `GridState.pluginState` surfaces their fields with exact types.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PluginState {}

// ---------------------------------------------------------------------------
// Plugin System
// ---------------------------------------------------------------------------

export interface KeyBinding {
  key: string;
  handler: (event: KeyboardEvent, cell: CellPosition | null) => boolean | void;
  priority?: number;
}

export interface Command {
  id: string;
  execute(payload: unknown): void;
  undo?(payload: unknown): void;
}

export interface PluginContext<TData = unknown> {
  grid: PluginGridApi<TData>;
  store: import('./state/store').StateStore<TData>;
  on<E extends keyof GridEvents<TData>>(event: E, handler: GridEvents<TData>[E]): () => void;
  emit<E extends keyof GridEvents<TData>>(event: E, ...args: Parameters<GridEvents<TData>[E]>): void;
  registerKeyBinding(binding: KeyBinding): () => void;
  registerCellType(type: string, renderer: CellTypeRenderer): () => void;
  registerCommand(command: Command): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expose(api: Record<string, any>): void;
  getPluginApi<T>(pluginId: string): T | undefined;
  showTooltip(target: HTMLElement, text: string, cursorX?: number, cursorY?: number): void;
  dismissTooltip(): void;
}

export interface GridPlugin<TId extends string = string, TApi = unknown> {
  id: TId;
  dependencies?: string[];
  /**
   * Phantom marker carrying the plugin's exposed API type for inference.
   * Never assigned at runtime — plugins declare their API shape in the return
   * type signature (e.g. `GridPlugin<'sorting', SortingApi>`) so that
   * `grid.plugins.sorting` can be statically typed via {@link InferPluginApis}.
   */
  $api?: TApi;
  /**
   * Canonical error-code dictionary the plugin may emit. Must be a runtime
   * object (typically `as const`) so the grid can merge all plugins' codes
   * into `grid.$errorCodes`. Keys should be SCREAMING_SNAKE_CASE identifiers
   * and values should mirror the key as a string literal.
   *
   * Consumers then narrow against them without magic strings:
   *
   *     if (err.code === grid.$errorCodes.REQUIRED_FIELD) { ... }
   */
  $errorCodes?: Readonly<Record<string, string>>;
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
  TPlugins extends readonly GridPlugin[] = readonly GridPlugin[],
> {
  mount(container: HTMLElement): void;
  unmount(): void;
  destroy(): void;

  getData(): TData[];
  setData(data: TData[]): void;
  updateRow(rowIndex: number, data: Partial<TData>): void;
  updateCell(rowIndex: number, columnId: string, value: unknown): void;

  getPinnedTopRows(): TData[];
  setPinnedTopRows(rows: TData[]): void;
  getPinnedBottomRows(): TData[];
  setPinnedBottomRows(rows: TData[]): void;

  getColumns(): ColumnDef<TData>[];
  setColumns(columns: ColumnDef<TData>[]): void;
  setColumnWidth(columnId: string, width: number): void;

  setContext(context: unknown): void;

  getSelection(): Selection;
  setSelection(selection: Selection): void;
  clearSelection(): void;

  /** Get the current freeze clip width in pixels, or null if no clip is active. */
  getFreezeClipWidth(): number | null;
  /** Set the freeze clip width in pixels. Pass null to remove the clip. */
  setFreezeClipWidth(width: number | null): void;

  // Hierarchy
  toggleRow(rowId: string | number): void;
  expandAll(): void;
  collapseAll(): void;

  scrollTo(row: number, column?: number): void;
  getScrollState(): ScrollState;

  on<E extends keyof GridEvents<TData>>(event: E, handler: GridEvents<TData>[E]): () => void;
  off<E extends keyof GridEvents<TData>>(event: E, handler: GridEvents<TData>[E]): void;

  /**
   * Typed access to plugin APIs keyed by plugin id. Populated lazily — reading
   * an entry returns the API previously published via `ctx.expose(...)`, or
   * undefined if the plugin hasn't exposed one yet.
   *
   * For plugins declared in the `plugins` tuple passed to `createGrid`, each
   * field is typed from the plugin's declared `$api`. For plugins added at
   * runtime via `addPlugin`, read through a cast:
   * `(grid.plugins as Record<string, MyApi>).foo`.
   */
  readonly plugins: InferPluginApis<TPlugins>;
  /**
   * Union of error-code dictionaries declared by each registered plugin.
   * Use instead of string literals so that renaming a code anywhere it's
   * emitted is caught at compile time:
   *
   *     if (err.code === grid.$errorCodes.INVALID_FORMAT) { ... }
   */
  readonly $errorCodes: InferPluginErrorCodes<TPlugins>;
  getState(): GridState<TData>;
  getContainer(): HTMLElement | null;
  getHeaderLayout(): HeaderRow[] | undefined;
  getCellType(type: string): CellTypeRenderer | undefined;

  addPlugin(plugin: GridPlugin): void;
  removePlugin(pluginId: string): void;

  batch(fn: () => void): void;
  refresh(): void;
}

// ---------------------------------------------------------------------------
// Plugin Grid API (narrow subset of GridInstance for plugins)
// ---------------------------------------------------------------------------

/**
 * The methods plugins are allowed to call on the grid.
 * Deliberately narrower than GridInstance — excludes lifecycle (mount/unmount/destroy),
 * the raw event emitter (on/off — use ctx.on/ctx.emit instead), and plugin lookup
 * (getPlugin — use ctx.getPluginApi).
 *
 * If you're writing a plugin and need a method not on this type, consider whether
 * the grid should expose it or whether the plugin is reaching too far.
 */
export interface PluginGridApi<TData = unknown> {
  // Data access
  getData(): TData[];
  setData(data: TData[]): void;
  updateCell(rowIndex: number, columnId: string, value: unknown): void;

  // Columns
  getColumns(): ColumnDef<TData>[];

  // State
  getState(): GridState<TData>;

  // Rendering
  refresh(): void;
  getContainer(): HTMLElement | null;
  getHeaderLayout(): HeaderRow[] | undefined;
  getCellType(type: string): CellTypeRenderer | undefined;

  // Selection
  setSelection(selection: Selection): void;

  // Scrolling
  scrollTo(row: number, column?: number): void;

  // Pinned rows
  setPinnedTopRows(rows: TData[]): void;
  setPinnedBottomRows(rows: TData[]): void;

  // Hierarchy (only relevant when hierarchy config is set)
  toggleRow(rowId: string | number): void;
  expandAll(): void;
  collapseAll(): void;
}

// ---------------------------------------------------------------------------
// Type-level inference helpers
// ---------------------------------------------------------------------------

/**
 * Extract the row type from a grid instance.
 * Usage: `type Row = InferRow<typeof grid>`
 */
export type InferRow<G> = G extends GridInstance<infer TData, infer _P> ? TData : never;

/**
 * Extract the grid-state type from a grid instance.
 * Usage: `type State = InferState<typeof grid>`
 */
export type InferState<G> =
  G extends GridInstance<infer TData, infer _P> ? GridState<TData> : never;

/**
 * Walk a `readonly GridPlugin[]` tuple and produce a record keyed by each
 * plugin's literal `id`, with values set to the plugin's declared `$api` type.
 *
 * Plugins that don't declare a TApi collapse to `unknown`. A non-literal
 * `readonly GridPlugin[]` degrades gracefully to `Record<string, unknown>`,
 * so consumers that don't `as const` (or pass plugins in inline-array position
 * without the `const` type-parameter modifier) still type-check.
 */
export type InferPluginApis<TPlugins extends readonly GridPlugin[] | undefined> =
  TPlugins extends readonly GridPlugin[]
    ? { readonly [P in TPlugins[number] as P['id']]: P extends GridPlugin<string, infer TApi> ? TApi : never }
    : Record<string, unknown>;

/**
 * Intersect all `$errorCodes` dictionaries declared by a plugin tuple into a
 * single readonly record. A plugin without `$errorCodes` contributes `{}`
 * (identity under intersection), so omitting the field costs nothing.
 *
 * When `TPlugins` isn't a literal tuple, falls back to `Record<string, string>`
 * — consumers still get a sane type, just without literal narrowing.
 */
export type InferPluginErrorCodes<TPlugins extends readonly GridPlugin[] | undefined> =
  TPlugins extends readonly GridPlugin[]
    ? UnionToIntersection<
        TPlugins[number] extends infer P
          ? P extends { $errorCodes: infer E }
            ? E
            : Record<never, never>
          : never
      > extends infer R
      ? { readonly [K in keyof R]: R[K] }
      : Record<string, string>
    : Record<string, string>;
