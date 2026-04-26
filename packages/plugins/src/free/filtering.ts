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

export function filtering(options?: FilteringOptions): GridPlugin<'filtering', FilteringApi> {
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

        // Precompute each active filter's accessor + (value, operator) once.
        // Inner row predicate then reuses these without repeating columns.find().
        // Filters whose columnId doesn't resolve preserve the prior behavior of
        // evaluating to `true` (i.e. they pass) — we simply omit them here.
        type ResolvedFilter = {
          getValue: (row: unknown) => unknown;
          value: unknown;
          operator: FilterOperator;
        };
        const resolvedFilters: ResolvedFilter[] = [];
        for (const { columnId, value, operator } of filters) {
          const col = columns.find((c) => c.id === columnId);
          if (!col) continue;

          let getValue: (row: unknown) => unknown;
          if (col.field) {
            const key = col.field;
            getValue = (row) => (row as Record<string, unknown>)[key];
          } else {
            getValue = () => undefined;
          }

          resolvedFilters.push({ getValue, value, operator });
        }

        const filtered = sourceData.filter((row: unknown) => {
          for (const { getValue, value, operator } of resolvedFilters) {
            if (!matchesFilter(getValue(row), value, operator)) return false;
          }
          return true;
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
        // Scope all queries to THIS grid's container so two grids on the same
        // page don't clobber each other's filter indicators (Pattern A fix).
        const gridEl = ctx.grid.getContainer();
        if (!gridEl) return;

        // Remove active-filter class from all headers
        gridEl.querySelectorAll('.bg-header-cell--filtered').forEach((el) =>
          el.classList.remove('bg-header-cell--filtered'),
        );

        // Mark filtered columns so the filter button stays visible + highlighted
        for (const { columnId } of filters) {
          const col = ctx.grid.getState().columns.findIndex((c) => c.id === columnId);
          if (col === -1) continue;

          const headerCells = gridEl.querySelectorAll(
            `.bg-header-cell[data-col="${col}"]:not(.bg-header-cell--group)`,
          );
          for (const headerCell of headerCells) {
            headerCell.classList.add('bg-header-cell--filtered');
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
      }

      // Re-apply filter indicators after every render: header cells are re-created
      // by the rendering pipeline on each render cycle, so the filtered class must
      // be re-applied after each render. This also covers the initial mount — no
      // setTimeout needed (Pattern B fix: setTimeout caused a StrictMode
      // double-mount race where two concurrent init()s each scheduled a deferred
      // call and both fired, applying indicators twice or to the wrong grid).
      const unsubRender = ctx.on('render', () => {
        if (filters.length > 0) {
          updateFilterIndicators();
        }
      });

      ctx.expose(api);

      return () => {
        unsubRender();
        // Scope cleanup to this grid's container (Pattern A fix).
        ctx.grid.getContainer()?.querySelectorAll('.bg-header-cell--filtered').forEach((el) =>
          el.classList.remove('bg-header-cell--filtered'),
        );
      };
    },
  };
}
