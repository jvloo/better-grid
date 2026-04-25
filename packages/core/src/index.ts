// ============================================================================
// @better-grid/core — Public API
// ============================================================================

export { createGrid } from './grid';

// Types
export type {
  // Grid
  GridOptions,
  GridInstance,
  GridState,
  GridEvents,
  RowStylesConfig,
  // Columns
  ColumnDef,
  CellType,
  CellEditorType,
  ColumnOption,
  BadgeOption,
  HeaderRow,
  HeaderCell,
  FooterRow,
  FooterCell,
  // Cells
  CellPosition,
  CellRange,
  CellChange,
  CellStyle,
  CellRenderContext,
  CellRenderer,
  CellTypeRenderer,
  // Selection
  Selection,
  SelectionOptions,
  // Scroll & Viewport
  ScrollState,
  VirtualRange,
  VirtualizationOptions,
  // Plugins
  GridPlugin,
  PluginContext,
  PluginGridApi,
  PluginState,
  KeyBinding,
  Command,
  // Hierarchy
  HierarchyConfig,
  HierarchyState,
  // Utility
  UnionToIntersection,
  // Type-level inference
  InferRow,
  InferState,
  InferPluginApis,
  InferPluginErrorCodes,
} from './types';

// Selection utilities
export {
  createEmptySelection,
  createCellSelection,
  createRangeSelection,
  extendSelection,
  addRangeToSelection,
  isCellInSelection,
  isCellActive,
} from './selection/model';

// Builders — pure utilities that generate config (not GridPlugins)
export { timeSeries } from './builders/time-series';
export type { TimeSeriesOptions, TimeSeriesResult } from './builders/time-series';

// Internal classes (for advanced usage / plugin development)
export { EventEmitter } from './events/emitter';
export { StateStore } from './state/store';
export { VirtualizationEngine } from './virtualization/engine';
export { ColumnManager } from './columns/manager';

// Shared utilities
export {
  snapToDevicePixel,
  getCellValue,
  clamp,
  parseNumericString,
  escapeXml,
} from './utils';
