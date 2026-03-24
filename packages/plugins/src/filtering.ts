// ============================================================================
// Filtering Plugin — Column filtering with local data support
// ============================================================================

import type { GridPlugin, PluginContext } from '@better-grid/core';

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';

export interface FilterState {
  columnId: string;
  value: unknown;
  operator: FilterOperator;
}

export interface FilteringOptions {
  /** Initial filter state */
  initialFilters?: FilterState[];
  /** Server-side filtering — emit events only, don't filter locally. Default: false */
  manualFiltering?: boolean;
  /** Callback when filters change */
  onFilterChange?: (filters: FilterState[]) => void;
}

export interface FilteringApi {
  getFilters(): FilterState[];
  setFilter(columnId: string, value: unknown, operator?: FilterOperator): void;
  removeFilter(columnId: string): void;
  clearFilters(): void;
}

export function filtering(options?: FilteringOptions): GridPlugin<'filtering'> {
  const config = {
    manualFiltering: options?.manualFiltering ?? false,
  };

  return {
    id: 'filtering',

    init(ctx: PluginContext) {
      let filters: FilterState[] = options?.initialFilters ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let unfilteredData: any[] | null = null;

      function applyFilters(): void {
        if (config.manualFiltering) return;

        const currentData = ctx.grid.getData();

        // Save original data on first filter
        if (!unfilteredData) {
          unfilteredData = [...currentData];
        }

        if (filters.length === 0) {
          // Restore original data
          if (unfilteredData) {
            ctx.grid.setData(unfilteredData);
            unfilteredData = null;
          }
          return;
        }

        const columns = ctx.grid.getState().columns;
        const sourceData = unfilteredData ?? currentData;

        const filtered = sourceData.filter((row: unknown) => {
          return filters.every(({ columnId, value, operator }) => {
            const col = columns.find((c) => c.id === columnId);
            if (!col) return true;

            let cellValue: unknown;
            if (col.accessorKey) {
              cellValue = (row as Record<string, unknown>)[col.accessorKey];
            }

            return matchesFilter(cellValue, value, operator);
          });
        });

        ctx.grid.setData(filtered);
      }

      function matchesFilter(cellValue: unknown, filterValue: unknown, operator: FilterOperator): boolean {
        if (filterValue == null || filterValue === '') return true;

        const cellStr = String(cellValue ?? '').toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        switch (operator) {
          case 'eq':
            return cellStr === filterStr;
          case 'neq':
            return cellStr !== filterStr;
          case 'contains':
            return cellStr.includes(filterStr);
          case 'startsWith':
            return cellStr.startsWith(filterStr);
          case 'endsWith':
            return cellStr.endsWith(filterStr);
          case 'gt':
            return Number(cellValue) > Number(filterValue);
          case 'gte':
            return Number(cellValue) >= Number(filterValue);
          case 'lt':
            return Number(cellValue) < Number(filterValue);
          case 'lte':
            return Number(cellValue) <= Number(filterValue);
          default:
            return true;
        }
      }

      function updateFilterIndicators(): void {
        // Remove existing indicators
        document.querySelectorAll('.bg-filter-indicator').forEach((el) => el.remove());

        // Add indicators to filtered columns
        for (const { columnId } of filters) {
          const col = ctx.grid.getState().columns.findIndex((c) => c.id === columnId);
          if (col === -1) continue;

          const headerCells = document.querySelectorAll(
            `.bg-header-cell[data-col="${col}"]:not(.bg-header-cell--group)`,
          );
          for (const headerCell of headerCells) {
            const indicator = document.createElement('span');
            indicator.className = 'bg-filter-indicator';
            indicator.textContent = ' \u25BC'; // ▼ funnel-like
            indicator.style.fontSize = '8px';
            indicator.style.opacity = '0.5';
            indicator.style.marginLeft = '4px';
            headerCell.appendChild(indicator);
          }
        }
      }

      const api: FilteringApi = {
        getFilters: () => [...filters],
        setFilter(columnId, value, operator = 'contains') {
          filters = filters.filter((f) => f.columnId !== columnId);
          if (value != null && value !== '') {
            filters.push({ columnId, value, operator });
          }
          applyFilters();
          updateFilterIndicators();
          options?.onFilterChange?.(filters);
        },
        removeFilter(columnId) {
          filters = filters.filter((f) => f.columnId !== columnId);
          applyFilters();
          updateFilterIndicators();
          options?.onFilterChange?.(filters);
        },
        clearFilters() {
          filters = [];
          applyFilters();
          updateFilterIndicators();
          options?.onFilterChange?.([]);
        },
      };

      // Apply initial filters
      if (filters.length > 0) {
        applyFilters();
        setTimeout(updateFilterIndicators, 0);
      }

      ctx.expose(api);

      return () => {
        document.querySelectorAll('.bg-filter-indicator').forEach((el) => el.remove());
      };
    },
  };
}
