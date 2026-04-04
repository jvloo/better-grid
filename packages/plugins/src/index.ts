// ============================================================================
// @better-grid/plugins — Public API
// ============================================================================

export { editing } from './editing';
export type { EditingOptions, EditingApi } from './editing';

export { sorting } from './sorting';
export type { SortingOptions, SortingApi, SortState, SortDirection } from './sorting';

export { filtering } from './filtering';
export type { FilteringOptions, FilteringApi, FilterState, FilterOperator } from './filtering';

export { formatting } from './formatting';
export type { FormattingOptions, FormattingApi, DateFormatPreset } from './formatting';

export { validation } from './validation';
export type { ValidationOptions, ValidationApi, ValidationError } from './validation';

export { clipboard } from './clipboard';
export type { ClipboardOptions, ClipboardApi } from './clipboard';

export { hierarchy } from './hierarchy';
export type { HierarchyOptions, HierarchyApi } from './hierarchy';

export { cellRenderers } from './cell-renderers';

export { autoDetect } from './auto-detect';
export type { AutoDetectOptions } from './auto-detect';

export { undoRedo } from './undo-redo';
export type { UndoRedoOptions, UndoRedoApi } from './undo-redo';

export { search } from './search';
export type { SearchOptions, SearchApi } from './search';

export { exportPlugin } from './export';
export type { ExportOptions, ExportApi, ExportData, ExportCell } from './export';

export { pagination } from './pagination';
export type { PaginationOptions, PaginationApi } from './pagination';

export { grouping } from './grouping';
export type { GroupingOptions, GroupingApi, GroupRowInfo, BuiltinAggregation, AggregationSpec } from './grouping';

// Pro plugins (planned for @better-grid/pro, included here during development)
export { mergeCells } from './merge-cells';
export type { MergeCellsOptions, MergeCellsApi, MergeCellDef } from './merge-cells';

export { proRenderers } from './pro-renderers';

export { gantt } from './gantt';
export type { GanttOptions, GanttApi } from './gantt';

export { rowActions, RowActionIcons } from './row-actions';
export type { RowActionsOptions, RowActionsApi, RowAction } from './row-actions';
