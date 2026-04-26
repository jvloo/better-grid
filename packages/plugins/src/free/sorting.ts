// ============================================================================
// Sorting Plugin — Column sorting with multi-sort support
// ============================================================================

import type { GridPlugin, PluginContext } from '@better-grid/core';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

export interface SortingOptions {
  /** Allow multi-column sort (shift+click). Default: false */
  multiSort?: boolean;
  /** Maximum sort columns. Default: 3 */
  maxSortColumns?: number;
  /** Initial sort state */
  initialSort?: SortState[];
  /** Server-side sorting — emit events only, don't sort locally. Default: false */
  manualSorting?: boolean;
  /** Callback when sort changes */
  onSortChange?: (sortState: SortState[]) => void;
}

export interface SortingApi {
  getSortState(): SortState[];
  setSortState(state: SortState[]): void;
  clearSort(): void;
  toggleSort(columnId: string, multi?: boolean): void;
}

export function sorting(options?: SortingOptions): GridPlugin<'sorting', SortingApi> {
  const config = {
    multiSort: options?.multiSort ?? false,
    maxSortColumns: options?.maxSortColumns ?? 3,
    manualSorting: options?.manualSorting ?? false,
  };

  // Mutable ref so the hook can call toggleSort from init closure
  let onHeaderClickFn: ((columnId: string) => void) | null = null;

  return {
    id: 'sorting',

    hooks: {
      onHeaderClick(columnId: string) {
        onHeaderClickFn?.(columnId);
      },
    },

    init(ctx: PluginContext) {
      let sortState: SortState[] = options?.initialSort ?? [];
      let unsortedData: unknown[] | null = null;

      function toggleSort(columnId: string, multi = false): void {
        const column = ctx.grid.getState().columns.find((c) => c.id === columnId);
        if (!column || column.sortable === false) return;

        const existing = sortState.find((s) => s.columnId === columnId);

        if (existing) {
          if (existing.direction === 'asc') {
            sortState = sortState.map((s) =>
              s.columnId === columnId ? { ...s, direction: 'desc' as SortDirection } : s,
            );
          } else {
            sortState = sortState.filter((s) => s.columnId !== columnId);
          }
        } else {
          const newSort: SortState = { columnId, direction: 'asc' };
          if (multi && config.multiSort) {
            sortState = [...sortState.slice(-(config.maxSortColumns - 1)), newSort];
          } else {
            sortState = [newSort];
          }
        }

        applySort();
        updateHeaderIndicators();
        options?.onSortChange?.(sortState);
      }

      function applySort(): void {
        if (config.manualSorting) return;

        const currentData = ctx.grid.getData();

        // Save original order on first sort
        if (!unsortedData) {
          unsortedData = [...currentData];
        }

        if (sortState.length === 0) {
          // Restore original order
          if (unsortedData) {
            ctx.grid.setData(unsortedData as typeof currentData);
            unsortedData = null;
          }
          return;
        }

        const columns = ctx.grid.getState().columns;

        // Precompute per-sort-key accessor + comparator once, so the inner
        // sort callback doesn't repeat columns.find() for every row pair.
        type ResolvedSort = {
          direction: SortDirection;
          getValue: (row: unknown) => unknown;
          compare: (a: unknown, b: unknown) => number;
        };
        const resolved: ResolvedSort[] = [];
        for (const { columnId, direction } of sortState) {
          const col = columns.find((c) => c.id === columnId);
          if (!col) continue;

          let getValue: (row: unknown) => unknown;
          if (col.valueGetter) {
            const fn = col.valueGetter;
            getValue = (row) => fn(row, 0);
          } else if (col.field) {
            const key = col.field;
            getValue = (row) => (row as Record<string, unknown>)[key];
          } else {
            getValue = () => undefined;
          }

          const compare = col.comparator ?? defaultCompare;
          resolved.push({ direction, getValue, compare });
        }

        const sorted = [...currentData].sort((a, b) => {
          for (const { direction, getValue, compare } of resolved) {
            const valA = getValue(a);
            const valB = getValue(b);
            const cmp = compare(valA, valB);
            if (cmp !== 0) {
              return direction === 'desc' ? -cmp : cmp;
            }
          }
          return 0;
        });

        ctx.grid.setData(sorted as typeof currentData);
      }

      function defaultCompare(a: unknown, b: unknown): number {
        if (a == null && b == null) return 0;
        if (a == null) return -1;
        if (b == null) return 1;

        if (typeof a === 'number' && typeof b === 'number') {
          return a - b;
        }
        if (typeof a === 'string' && typeof b === 'string') {
          return a.localeCompare(b);
        }
        if (a instanceof Date && b instanceof Date) {
          return a.getTime() - b.getTime();
        }

        return String(a).localeCompare(String(b));
      }

      function updateHeaderIndicators(): void {
        // Remove all existing indicators
        document.querySelectorAll('.bg-sort-indicator').forEach((el) => el.remove());
        // Reset aria-sort on every column header — stale cells get 'none'
        document
          .querySelectorAll('.bg-header-cell[role="columnheader"][aria-sort]')
          .forEach((el) => el.setAttribute('aria-sort', 'none'));

        // Add indicators + aria-sort to sorted column headers
        for (const { columnId, direction } of sortState) {
          const col = ctx.grid.getState().columns.findIndex((c) => c.id === columnId);
          if (col === -1) continue;

          // Find column-level header cells (not group headers)
          const headerCells = document.querySelectorAll(
            `.bg-header-cell[data-col="${col}"]:not(.bg-header-cell--group)`,
          );
          for (const headerCell of headerCells) {
            headerCell.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
            const indicator = document.createElement('span');
            indicator.className = 'bg-sort-indicator';
            indicator.innerHTML = direction === 'asc'
              ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2v6M2.5 4.5L5 2l2.5 2.5"/></svg>'
              : '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2v6M2.5 5.5L5 8l2.5-2.5"/></svg>';
            indicator.style.opacity = '0.6';
            indicator.style.marginLeft = '4px';
            indicator.style.display = 'inline-flex';
            indicator.style.verticalAlign = 'middle';
            // Insert before filter button so sort icon appears first
            const filterBtn = headerCell.querySelector('.bg-header-cell__filter-btn');
            if (filterBtn) {
              headerCell.insertBefore(indicator, filterBtn);
            } else {
              headerCell.appendChild(indicator);
            }
          }
        }
      }

      const api: SortingApi = {
        getSortState: () => [...sortState],
        setSortState: (state) => {
          sortState = state;
          applySort();
          updateHeaderIndicators();
          options?.onSortChange?.(sortState);
        },
        clearSort: () => {
          sortState = [];
          applySort();
          updateHeaderIndicators();
          options?.onSortChange?.([]);
        },
        toggleSort,
      };

      // Wire header click → toggleSort
      onHeaderClickFn = (columnId) => toggleSort(columnId);

      ctx.expose(api);

      // Apply initial sort if any
      if (sortState.length > 0) {
        applySort();
        // Delay indicator update to after headers render
        setTimeout(updateHeaderIndicators, 0);
      }

      return () => {
        document.querySelectorAll('.bg-sort-indicator').forEach((el) => el.remove());
      };
    },
  };
}
