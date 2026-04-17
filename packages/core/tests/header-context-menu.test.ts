import { describe, expect, it, vi } from 'vitest';
import {
  buildHeaderContextMenuItems,
  type HeaderContextMenuSortApi,
  type HeaderContextMenuFilterApi,
} from '../src/ui/header-context-menu';

function makeSortApi(initial: { columnId: string; direction: string }[] = []): HeaderContextMenuSortApi {
  let state = [...initial];
  return {
    getSortState: () => state,
    clearSort: vi.fn(() => { state = []; }),
    toggleSort: vi.fn(),
  };
}

function makeFilterApi(initial: { columnId: string; value?: unknown; operator?: string }[] = []): HeaderContextMenuFilterApi {
  return {
    getFilters: () => initial,
    setFilter: vi.fn(),
    removeFilter: vi.fn(),
    clearFilters: vi.fn(),
  };
}

describe('buildHeaderContextMenuItems', () => {
  it('returns an empty list when no plugins are passed', () => {
    const items = buildHeaderContextMenuItems({
      columnId: 'a',
      onOpenFilterPanel: () => {},
    });
    expect(items).toEqual([]);
  });

  it('emits sort items when sortApi is present', () => {
    const sortApi = makeSortApi();
    const items = buildHeaderContextMenuItems({
      columnId: 'a',
      sortApi,
      onOpenFilterPanel: () => {},
    });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Sort Ascending');
    expect(labels).toContain('Sort Descending');
    expect(labels).not.toContain('Clear Sort');
  });

  it('marks the ascending item active when the column is sorted asc', () => {
    const sortApi = makeSortApi([{ columnId: 'a', direction: 'asc' }]);
    const items = buildHeaderContextMenuItems({
      columnId: 'a',
      sortApi,
      onOpenFilterPanel: () => {},
    });
    const ascItem = items.find((i) => i.label === 'Sort Ascending');
    const descItem = items.find((i) => i.label === 'Sort Descending');
    expect(ascItem!.active).toBe(true);
    expect(descItem!.active).toBe(false);
  });

  it('shows "Clear Sort" only for the currently-sorted column', () => {
    const sortApi = makeSortApi([{ columnId: 'b', direction: 'asc' }]);

    const forB = buildHeaderContextMenuItems({ columnId: 'b', sortApi, onOpenFilterPanel: () => {} });
    expect(forB.map((i) => i.label)).toContain('Clear Sort');

    const forA = buildHeaderContextMenuItems({ columnId: 'a', sortApi, onOpenFilterPanel: () => {} });
    expect(forA.map((i) => i.label)).not.toContain('Clear Sort');
  });

  it('shows "Clear All Sorts" when more than one column is sorted', () => {
    const one = makeSortApi([{ columnId: 'a', direction: 'asc' }]);
    const two = makeSortApi([
      { columnId: 'a', direction: 'asc' },
      { columnId: 'b', direction: 'desc' },
    ]);

    const onLy = buildHeaderContextMenuItems({ columnId: 'a', sortApi: one, onOpenFilterPanel: () => {} });
    expect(onLy.map((i) => i.label)).not.toContain('Clear All Sorts');

    const multi = buildHeaderContextMenuItems({ columnId: 'a', sortApi: two, onOpenFilterPanel: () => {} });
    expect(multi.map((i) => i.label)).toContain('Clear All Sorts');
  });

  it('inserts a separator between sort and filter sections when both are present', () => {
    const items = buildHeaderContextMenuItems({
      columnId: 'a',
      sortApi: makeSortApi(),
      filterApi: makeFilterApi(),
      onOpenFilterPanel: () => {},
    });
    const labels = items.map((i) => i.label);
    const sepIdx = labels.indexOf('─');
    const filterIdx = labels.indexOf('Filter...');
    expect(sepIdx).toBeGreaterThan(-1);
    expect(filterIdx).toBe(sepIdx + 1);
  });

  it('labels the filter item "Change Filter..." when the column is already filtered', () => {
    const filterApi = makeFilterApi([{ columnId: 'a', value: 'x', operator: 'eq' }]);
    const items = buildHeaderContextMenuItems({
      columnId: 'a',
      filterApi,
      onOpenFilterPanel: () => {},
    });
    expect(items.find((i) => i.label === 'Change Filter...')).toBeDefined();
    expect(items.find((i) => i.label === 'Filter...')).toBeUndefined();
  });

  it('passes the current filter to onOpenFilterPanel when the item is invoked', () => {
    const filterApi = makeFilterApi([{ columnId: 'a', value: 'x', operator: 'eq' }]);
    const onOpenFilterPanel = vi.fn();
    const items = buildHeaderContextMenuItems({
      columnId: 'a',
      filterApi,
      onOpenFilterPanel,
    });
    items.find((i) => i.label === 'Change Filter...')!.action();
    expect(onOpenFilterPanel).toHaveBeenCalledWith({ columnId: 'a', value: 'x', operator: 'eq' });
  });

  it('Clear Filter calls filterApi.removeFilter for the current column', () => {
    const filterApi = makeFilterApi([{ columnId: 'a', value: 'x' }]);
    const items = buildHeaderContextMenuItems({
      columnId: 'a',
      filterApi,
      onOpenFilterPanel: () => {},
    });
    items.find((i) => i.label === 'Clear Filter')!.action();
    expect(filterApi.removeFilter).toHaveBeenCalledWith('a');
  });

  it('Clear All Filters is present when any filter exists', () => {
    const filterApi = makeFilterApi([{ columnId: 'b', value: 'y' }]);
    const items = buildHeaderContextMenuItems({
      columnId: 'a',
      filterApi,
      onOpenFilterPanel: () => {},
    });
    expect(items.map((i) => i.label)).toContain('Clear All Filters');
  });
});
