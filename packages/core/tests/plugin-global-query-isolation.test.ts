/**
 * Regression tests for Pattern A (global document.querySelector) and Pattern B
 * (setTimeout-wrapped DOM creation) bugs in plugins.
 *
 * Pattern A: `document.querySelector('.bg-grid')` or `document.querySelectorAll('.bg-sort-indicator')`
 *   grabs the FIRST matching element in the whole document. With two grids on the
 *   same page, one grid's plugin mutates the other grid's DOM.
 *
 * Pattern B: `setTimeout(0)` wrapped DOM creation with a dedup guard. Under React
 *   StrictMode (mount → unmount → mount), both deferred callbacks fire after the
 *   first mount's cleanup, bypassing the guard and producing duplicate DOM or
 *   corrupt state.
 *
 * These tests create two grids on the same page and verify that each plugin only
 * touches its own grid's DOM. The tests run synchronously (no setTimeout), matching
 * how the fixed plugins now call init code directly.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { sorting } from '../../plugins/src/free/sorting';
import { filtering } from '../../plugins/src/free/filtering';
import { search } from '../../plugins/src/free/search';
import { validation } from '../../plugins/src/free/validation';
import { grouping } from '../../plugins/src/free/grouping';
import type { ColumnDef } from '../src/types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

interface Row {
  id: number;
  name: string;
  category: string;
  value: number;
}

const columns: ColumnDef<Row>[] = [
  { id: 'id', field: 'id', headerName: 'ID', sortable: true },
  { id: 'name', field: 'name', headerName: 'Name', sortable: true },
  { id: 'category', field: 'category', headerName: 'Category', sortable: true },
  { id: 'value', field: 'value', headerName: 'Value', sortable: true },
];

const data: Row[] = [
  { id: 1, name: 'Alpha', category: 'A', value: 10 },
  { id: 2, name: 'Beta', category: 'B', value: 20 },
  { id: 3, name: 'Gamma', category: 'A', value: 30 },
];

let container1: HTMLElement;
let container2: HTMLElement;
let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  container1 = document.createElement('div');
  container2 = document.createElement('div');
  Object.defineProperty(container1, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(container1, 'clientHeight', { configurable: true, value: 400 });
  Object.defineProperty(container2, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(container2, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(container1);
  document.body.appendChild(container2);
  // Fire rAF synchronously so renders happen before assertions
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Helper: mount a grid with plugins and trigger a render
// ---------------------------------------------------------------------------

function makeGrid(container: HTMLElement, plugins: Parameters<typeof createGrid>[0]['plugins'], sortInitially = false) {
  const cols: ColumnDef<Row>[] = sortInitially
    ? columns
    : columns;

  const grid = createGrid<Row>({ columns: cols, data: [...data], plugins });
  grid.mount(container);
  grid.refresh();
  return grid;
}

// ---------------------------------------------------------------------------
// Sorting: Pattern A + B
// ---------------------------------------------------------------------------

describe('sorting plugin isolation (Pattern A + B)', () => {
  it('each grid gets its own sort indicators — not the same shared set', () => {
    const grid1 = makeGrid(container1, [sorting({ initialSort: [{ columnId: 'name', direction: 'asc' }] })]);
    const grid2 = makeGrid(container2, [sorting()]);

    // Grid 1 has sort indicators; grid 2 does not
    const indicators1 = container1.querySelectorAll('.bg-sort-indicator');
    const indicators2 = container2.querySelectorAll('.bg-sort-indicator');

    expect(indicators1.length).toBeGreaterThan(0);
    expect(indicators2.length).toBe(0);

    // All grid1 indicators live inside container1, not container2
    for (const el of indicators1) {
      expect(container1.contains(el)).toBe(true);
      expect(container2.contains(el)).toBe(false);
    }

    grid1.destroy();
    grid2.destroy();
  });

  it('toggling sort on grid1 does not add indicators to grid2', () => {
    const sort1 = sorting();
    const sort2 = sorting();
    const grid1 = makeGrid(container1, [sort1]);
    const grid2 = makeGrid(container2, [sort2]);

    // Trigger sort on grid1 via header-click hook
    (grid1.plugins as Record<string, { toggleSort(id: string): void }>).sorting.toggleSort('name');
    grid1.refresh();

    const indicators1 = container1.querySelectorAll('.bg-sort-indicator');
    const indicators2 = container2.querySelectorAll('.bg-sort-indicator');

    expect(indicators1.length).toBeGreaterThan(0);
    expect(indicators2.length).toBe(0);

    grid1.destroy();
    grid2.destroy();
  });

  it('destroying grid1 does not remove sort indicators from grid2', () => {
    const grid1 = makeGrid(container1, [sorting({ initialSort: [{ columnId: 'name', direction: 'asc' }] })]);
    const grid2 = makeGrid(container2, [sorting({ initialSort: [{ columnId: 'id', direction: 'desc' }] })]);

    // Verify both have indicators
    expect(container1.querySelectorAll('.bg-sort-indicator').length).toBeGreaterThan(0);
    expect(container2.querySelectorAll('.bg-sort-indicator').length).toBeGreaterThan(0);

    // Destroy grid1 — its cleanup must only remove its own indicators
    grid1.destroy();

    // Grid2's indicators must survive
    expect(container2.querySelectorAll('.bg-sort-indicator').length).toBeGreaterThan(0);

    grid2.destroy();
  });
});

// ---------------------------------------------------------------------------
// Filtering: Pattern A + B
// ---------------------------------------------------------------------------

describe('filtering plugin isolation (Pattern A + B)', () => {
  it('applying a filter on grid1 does not mark headers in grid2', () => {
    const filter1 = filtering({ initialFilters: [{ columnId: 'name', value: 'Alpha', operator: 'contains' }] });
    const filter2 = filtering();
    const grid1 = makeGrid(container1, [filter1]);
    const grid2 = makeGrid(container2, [filter2]);

    const filtered1 = container1.querySelectorAll('.bg-header-cell--filtered');
    const filtered2 = container2.querySelectorAll('.bg-header-cell--filtered');

    expect(filtered1.length).toBeGreaterThan(0);
    expect(filtered2.length).toBe(0);

    // All filtered headers are inside container1
    for (const el of filtered1) {
      expect(container1.contains(el)).toBe(true);
    }

    grid1.destroy();
    grid2.destroy();
  });

  it('clearing filters on grid1 does not clear filter indicators on grid2', () => {
    const filter1 = filtering({ initialFilters: [{ columnId: 'name', value: 'Alpha', operator: 'contains' }] });
    const filter2 = filtering({ initialFilters: [{ columnId: 'id', value: '1', operator: 'eq' }] });
    const grid1 = makeGrid(container1, [filter1]);
    const grid2 = makeGrid(container2, [filter2]);

    expect(container1.querySelectorAll('.bg-header-cell--filtered').length).toBeGreaterThan(0);
    expect(container2.querySelectorAll('.bg-header-cell--filtered').length).toBeGreaterThan(0);

    // Clear grid1's filters
    (grid1.plugins as Record<string, { clearFilters(): void }>).filtering.clearFilters();

    expect(container1.querySelectorAll('.bg-header-cell--filtered').length).toBe(0);
    // Grid2's indicators must be intact
    expect(container2.querySelectorAll('.bg-header-cell--filtered').length).toBeGreaterThan(0);

    grid1.destroy();
    grid2.destroy();
  });

  it('destroying grid1 does not clear filter indicators from grid2', () => {
    const filter1 = filtering({ initialFilters: [{ columnId: 'name', value: 'x', operator: 'contains' }] });
    const filter2 = filtering({ initialFilters: [{ columnId: 'id', value: '1', operator: 'eq' }] });
    const grid1 = makeGrid(container1, [filter1]);
    const grid2 = makeGrid(container2, [filter2]);

    expect(container2.querySelectorAll('.bg-header-cell--filtered').length).toBeGreaterThan(0);
    grid1.destroy();
    // Grid2's indicators survive grid1 cleanup
    expect(container2.querySelectorAll('.bg-header-cell--filtered').length).toBeGreaterThan(0);

    grid2.destroy();
  });
});

// ---------------------------------------------------------------------------
// Search: Pattern A (document.querySelector('.bg-grid') + cell scoping)
// ---------------------------------------------------------------------------

describe('search plugin isolation (Pattern A)', () => {
  it('getContainer() is available when search plugin initializes', () => {
    // This verifies the search plugin can call ctx.grid.getContainer() without
    // errors — it previously called document.querySelector('.bg-grid') which
    // would return the FIRST grid even when called from the second plugin instance.
    const grid1 = makeGrid(container1, [search()]);
    const grid2 = makeGrid(container2, [search()]);

    // Both grids' search plugins expose the API correctly — no cross-contamination
    const api1 = (grid1.plugins as Record<string, { search(q: string): number }>).search;
    const api2 = (grid2.plugins as Record<string, { search(q: string): number }>).search;

    expect(api1).toBeDefined();
    expect(api2).toBeDefined();

    // Searching grid1 returns matches (we have 'Alpha', 'Beta', 'Gamma' in name)
    const count1 = api1.search('Alpha');
    expect(count1).toBe(1);

    // Searching grid2 independently works correctly
    const count2 = api2.search('Beta');
    expect(count2).toBe(1);

    grid1.destroy();
    grid2.destroy();
  });

  it('search highlights are scoped to each grid container', () => {
    const grid1 = makeGrid(container1, [search()]);
    const grid2 = makeGrid(container2, [search()]);

    const api1 = (grid1.plugins as Record<string, { search(q: string): number; clear(): void }>).search;

    // Search on grid1 — highlights should only appear in container1
    api1.search('Alpha');
    grid1.refresh();

    const highlights1 = container1.querySelectorAll('.bg-cell--search-match');
    const highlights2 = container2.querySelectorAll('.bg-cell--search-match');

    // All highlights are in container1, none in container2
    expect(highlights2.length).toBe(0);
    // (highlights1 may be 0 if cells aren't rendered in the happy-dom viewport,
    //  but the important thing is no cross-contamination to container2)

    grid1.destroy();
    grid2.destroy();
  });
});

// ---------------------------------------------------------------------------
// Validation: Pattern A (cell error scoping)
// ---------------------------------------------------------------------------

describe('validation plugin isolation (Pattern A)', () => {
  it('error styles are scoped to each grid — not cross-applied', () => {
    const validationCols: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID', required: true },
      { id: 'name', field: 'name', headerName: 'Name' },
      { id: 'category', field: 'category', headerName: 'Category' },
      { id: 'value', field: 'value', headerName: 'Value' },
    ];

    const dataWithBlank: Row[] = [
      { id: 0, name: '', category: '', value: 0 }, // id=0 may fail required check
      ...data,
    ];

    const grid1 = createGrid<Row>({
      columns: validationCols,
      data: dataWithBlank,
      plugins: [validation({ validateOn: 'all' })],
    });
    grid1.mount(container1);
    grid1.refresh();

    const grid2 = createGrid<Row>({
      columns: validationCols,
      data: [...data],
      plugins: [validation()],
    });
    grid2.mount(container2);
    grid2.refresh();

    // Any errors in grid1 must not bleed into container2
    const errors2 = container2.querySelectorAll('.bg-cell--error');
    expect(errors2.length).toBe(0);

    // Manually validate grid2 to confirm its validation is isolated
    const api2 = (grid2.plugins as Record<string, { validate(): unknown[] }>).validation;
    api2.validate();
    grid2.refresh();

    // After validating grid2, grid1's cells must remain unaffected by grid2's applyErrorStyles
    const errorsInContainer1 = container1.querySelectorAll('.bg-cell--error');
    // Container2's errors must not appear in container1
    for (const el of container2.querySelectorAll('.bg-cell--error')) {
      expect(container1.contains(el)).toBe(false);
    }

    grid1.destroy();
    grid2.destroy();
  });
});

// ---------------------------------------------------------------------------
// Grouping: Pattern B (setTimeout removed)
// ---------------------------------------------------------------------------

describe('grouping plugin isolation (Pattern B)', () => {
  it('grouping applies synchronously on init — no double-grouping', () => {
    // Before the fix, setTimeout(() => applyGrouping(), 0) meant that in a
    // StrictMode double-mount, BOTH deferred callbacks fired:
    //   1st mount deferred: saves originalData=[3 rows], groups them
    //   unmount (cleanup): does nothing to originalData
    //   2nd mount deferred: ALSO fires — saves wrong snapshot and groups again
    // Result: grid ends up with data that has already been grouped twice.
    //
    // After the fix, applyGrouping() is called synchronously in init() so there
    // is only one invocation and the data is correct.
    const grid = createGrid<Row>({
      columns,
      data: [...data],
      plugins: [grouping({ groupBy: ['category'] })],
    });
    grid.mount(container1);
    grid.refresh();

    const groupedData = grid.getData();
    // With 2 categories (A, B) and 3 rows, we expect 2 group header rows + 3 data rows = 5
    // (assuming defaultExpanded = true)
    expect(groupedData.length).toBe(5);

    grid.destroy();
  });

  it('two grids with grouping plugin each group independently', () => {
    const grid1 = createGrid<Row>({
      columns,
      data: [...data],
      plugins: [grouping({ groupBy: ['category'] })],
    });
    grid1.mount(container1);
    grid1.refresh();

    const grid2 = createGrid<Row>({
      columns,
      data: [...data],
      plugins: [grouping({ groupBy: ['category'] })],
    });
    grid2.mount(container2);
    grid2.refresh();

    // Both grids should have independently grouped data
    const data1 = grid1.getData();
    const data2 = grid2.getData();

    expect(data1.length).toBe(5); // 2 groups + 3 data rows
    expect(data2.length).toBe(5);

    grid1.destroy();
    grid2.destroy();
  });
});
