// ============================================================================
// @better-grid/react — public exports
// ============================================================================

export { BetterGrid, type BetterGridProps } from './BetterGrid';
export { useGrid } from './useGrid';
export type { GridHandle, ReactGridOptions } from './types';
export { defineColumn, registerColumn } from './defineColumn';
export { configure } from './configure';
export { registerMode } from './presets/modes';
export type { ModeDefinition } from './presets/modes';
export type { FeatureName } from './presets/features';

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
