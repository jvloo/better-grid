// ============================================================================
// Filtering Plugin — Column filtering
// ============================================================================

import type { GridPlugin, PluginContext } from '@better-grid/core';

export interface FilterState {
  columnId: string;
  value: unknown;
  operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
}

export interface FilteringOptions {
  /** Initial filter state */
  initialFilters?: FilterState[];
  /** Server-side filtering — emit events only. Default: false */
  manualFiltering?: boolean;
  /** Callback when filters change */
  onFilterChange?: (filters: FilterState[]) => void;
}

export interface FilteringApi {
  getFilters(): FilterState[];
  setFilter(columnId: string, value: unknown, operator?: FilterState['operator']): void;
  removeFilter(columnId: string): void;
  clearFilters(): void;
}

export function filtering(options?: FilteringOptions): GridPlugin<'filtering'> {
  return {
    id: 'filtering',

    init(ctx: PluginContext) {
      let filters: FilterState[] = options?.initialFilters ?? [];

      const api: FilteringApi = {
        getFilters: () => filters,
        setFilter(columnId, value, operator = 'eq') {
          filters = filters.filter((f) => f.columnId !== columnId);
          filters.push({ columnId, value, operator });
          options?.onFilterChange?.(filters);
        },
        removeFilter(columnId) {
          filters = filters.filter((f) => f.columnId !== columnId);
          options?.onFilterChange?.(filters);
        },
        clearFilters() {
          filters = [];
          options?.onFilterChange?.([]);
        },
      };

      ctx.expose(api);

      return () => {};
    },
  };
}
