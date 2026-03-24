// ============================================================================
// @better-grid/react — Public API
// ============================================================================

export { BetterGrid } from './BetterGrid';
export type { BetterGridProps } from './BetterGrid';
export { useGrid } from './hooks/useGrid';

// Re-export core types for convenience
export type {
  GridOptions,
  GridInstance,
  GridPlugin,
  ColumnDef,
  CellPosition,
  CellRange,
  Selection,
} from '@better-grid/core';
