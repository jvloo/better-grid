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

  return {
    id: 'sorting',

    init(ctx: PluginContext) {
      let sortState: SortState[] = options?.initialSort ?? [];

      function toggleSort(columnId: string, multi = false): void {
        const existing = sortState.find((s) => s.columnId === columnId);

        if (existing) {
          if (existing.direction === 'asc') {
            // asc → desc
            sortState = sortState.map((s) =>
              s.columnId === columnId ? { ...s, direction: 'desc' as SortDirection } : s,
            );
          } else {
            // desc → remove
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

        options?.onSortChange?.(sortState);
      }

      const api: SortingApi = {
        getSortState: () => sortState,
        setSortState: (state) => {
          sortState = state;
          options?.onSortChange?.(sortState);
        },
        clearSort: () => {
          sortState = [];
          options?.onSortChange?.([]);
        },
        toggleSort,
      };

      ctx.expose(api);

      return () => {};
    },
  };
}
