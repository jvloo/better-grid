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
  // Columns
  ColumnDef,
  CellType,
  EditorType,
  ColumnOption,
  ColumnValidationRule,
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
  CellDecorator,
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
  KeyBinding,
  Command,
  // Utility
  UnionToIntersection,
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

// Internal classes (for advanced usage / plugin development)
export { EventEmitter } from './events/emitter';
export { StateStore } from './state/store';
export { VirtualizationEngine } from './virtualization/engine';
export { ColumnManager } from './columns/manager';
