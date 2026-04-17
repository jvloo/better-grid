// ============================================================================
// @better-grid/plugins — Free plugins for Better Grid
//
// Commercial plugins (gantt, aggregation, merge-cells, row-actions, advanced
// renderers) live in @better-grid/pro.
// ============================================================================

export { editing } from './free/editing';
export type { EditingOptions, EditingApi } from './free/editing';

export { sorting } from './free/sorting';
export type { SortingOptions, SortingApi, SortState, SortDirection } from './free/sorting';

export { filtering } from './free/filtering';
export type { FilteringOptions, FilteringApi, FilterState, FilterOperator } from './free/filtering';

export { formatting } from './free/formatting';
export type { FormattingOptions, FormattingApi, DateFormatPreset } from './free/formatting';

export { validation, VALIDATION_ERROR_CODES } from './free/validation';
export type {
  ValidationOptions,
  ValidationApi,
  ValidationError,
  ValidationErrorCode,
  ColumnValidationRule,
} from './free/validation';

export { clipboard } from './free/clipboard';
export type { ClipboardOptions, ClipboardApi } from './free/clipboard';

export { hierarchy } from './free/hierarchy';
export type { HierarchyOptions, HierarchyApi } from './free/hierarchy';

export { cellRenderers } from './free/cell-renderers';

export { autoDetect } from './free/auto-detect';
export type { AutoDetectOptions } from './free/auto-detect';

export { undoRedo } from './free/undo-redo';
export type { UndoRedoOptions, UndoRedoApi } from './free/undo-redo';

export { search } from './free/search';
export type { SearchOptions, SearchApi } from './free/search';

export { exportPlugin } from './free/export';
export type { ExportOptions, ExportApi, ExportData, ExportCell } from './free/export';

export { pagination } from './free/pagination';
export type { PaginationOptions, PaginationApi } from './free/pagination';

export { grouping } from './free/grouping';
export type {
  GroupingOptions,
  GroupingApi,
  GroupRowInfo,
  BuiltinAggregation,
  AggregationSpec,
} from './free/grouping';
