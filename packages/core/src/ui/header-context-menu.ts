// ============================================================================
// Header Context Menu Items — builds the MenuItem[] shown when the user
// right-clicks a column header.
//
// Extracted from grid.ts. Pure function: takes plugin APIs as deps and returns
// an array of menu items. The caller is responsible for showing the menu.
// ============================================================================

import type { MenuItem } from './context-menu';

export interface HeaderContextMenuSortApi {
  getSortState: () => readonly { columnId: string; direction: string }[];
  clearSort: () => void;
  toggleSort: (id: string, multi?: boolean) => void;
}

export interface HeaderContextMenuFilter {
  columnId: string;
  value?: unknown;
  operator?: string;
}

export interface HeaderContextMenuFilterApi {
  getFilters: () => readonly HeaderContextMenuFilter[];
  setFilter: (id: string, value: unknown, op?: string) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
}

export interface BuildHeaderContextMenuOptions {
  columnId: string;
  sortApi?: HeaderContextMenuSortApi;
  filterApi?: HeaderContextMenuFilterApi;
  /** Called by the "Filter..." item. Should open the filter panel for the current column. */
  onOpenFilterPanel: (currentFilter: HeaderContextMenuFilter | undefined) => void;
}

export function buildHeaderContextMenuItems(options: BuildHeaderContextMenuOptions): MenuItem[] {
  const items: MenuItem[] = [];
  const { columnId, sortApi, filterApi, onOpenFilterPanel } = options;

  if (sortApi) {
    const sorted = sortApi.getSortState();
    const colSorted = sorted.find((s) => s.columnId === columnId);

    items.push(
      {
        label: 'Sort Ascending',
        action: () => { sortApi.clearSort(); sortApi.toggleSort(columnId); },
        active: colSorted?.direction === 'asc',
      },
      {
        label: 'Sort Descending',
        // toggleSort cycles asc → desc → none, so two toggles land on desc
        action: () => { sortApi.clearSort(); sortApi.toggleSort(columnId); sortApi.toggleSort(columnId); },
        active: colSorted?.direction === 'desc',
      },
    );

    if (colSorted) {
      items.push({
        label: 'Clear Sort',
        action: () => {
          // Remove just this column's sort by re-applying the remaining ones
          const remaining = sorted.filter((s) => s.columnId !== columnId);
          sortApi.clearSort();
          for (const s of remaining) {
            sortApi.toggleSort(s.columnId, true);
            if (s.direction === 'desc') sortApi.toggleSort(s.columnId, true);
          }
        },
      });
    }

    if (sorted.length > 1) {
      items.push({ label: 'Clear All Sorts', action: () => sortApi.clearSort() });
    }
  }

  if (filterApi) {
    const filtered = filterApi.getFilters();
    const colFiltered = filtered.find((f) => f.columnId === columnId);

    if (items.length > 0) {
      items.push({ label: '─', action: () => {} });
    }

    items.push({
      label: colFiltered ? 'Change Filter...' : 'Filter...',
      action: () => onOpenFilterPanel(colFiltered),
      active: !!colFiltered,
    });

    if (colFiltered) {
      items.push({ label: 'Clear Filter', action: () => filterApi.removeFilter(columnId) });
    }
    if (filtered.length > 0) {
      items.push({ label: 'Clear All Filters', action: () => filterApi.clearFilters() });
    }
  }

  return items;
}
