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

export function sorting(options?: SortingOptions): GridPlugin<'sorting'> {
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
        const sorted = [...currentData].sort((a, b) => {
          for (const { columnId, direction } of sortState) {
            const col = columns.find((c) => c.id === columnId);
            if (!col) continue;

            let valA: unknown;
            let valB: unknown;

            if (col.accessorFn) {
              valA = col.accessorFn(a, 0);
              valB = col.accessorFn(b, 0);
            } else if (col.accessorKey) {
              valA = (a as Record<string, unknown>)[col.accessorKey];
              valB = (b as Record<string, unknown>)[col.accessorKey];
            }

            let cmp: number;
            if (col.comparator) {
              cmp = col.comparator(valA, valB);
            } else {
              cmp = defaultCompare(valA, valB);
            }

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

        // Add indicators to sorted column headers
        for (const { columnId, direction } of sortState) {
          const col = ctx.grid.getState().columns.findIndex((c) => c.id === columnId);
          if (col === -1) continue;

          // Find column-level header cells (not group headers)
          const headerCells = document.querySelectorAll(
            `.bg-header-cell[data-col="${col}"]:not(.bg-header-cell--group)`,
          );
          for (const headerCell of headerCells) {
            const indicator = document.createElement('span');
            indicator.className = 'bg-sort-indicator';
            indicator.textContent = direction === 'asc' ? ' \u25B2' : ' \u25BC';
            indicator.style.fontSize = '10px';
            indicator.style.opacity = '0.6';
            indicator.style.marginLeft = '4px';
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
