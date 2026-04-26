/**
 * Regression test: sort indicator and filter button must not overlap.
 *
 * After commit a765955 moved the filter button to `position: absolute; right: 6px`,
 * the sort indicator (also appended to the header cell) overlapped with it on
 * right-aligned headers. The fix:
 *   - `.bg-header-cell__filter-btn`  → position:absolute; right:6px;  width:16px
 *   - `.bg-sort-indicator`           → position:absolute; right:22px (= 6 + 16)
 *   - Without filter: right:6px
 *   - `.bg-header-cell--filterable`  → class added by headers.ts when filter plugin active
 *
 * NOTE: happy-dom does not apply CSS stylesheet rules to getComputedStyle — only
 * inline styles are visible. Therefore these tests verify structural invariants
 * (element presence, class presence, DOM parent) rather than computed CSS values.
 * The actual stacking is enforced by the CSS rules in grid.css.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { sorting } from '../../plugins/src/free/sorting';
import { filtering } from '../../plugins/src/free/filtering';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  name: string;
}

const columns: ColumnDef<Row>[] = [
  { id: 'id', field: 'id', headerName: 'ID', sortable: true, align: 'right' },
  { id: 'name', field: 'name', headerName: 'Name', sortable: true },
];

const data: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
];

let container: HTMLElement;
let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(container);
  // Fire rAF synchronously
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

describe('header icon stacking — sort indicator and filter button do not overlap', () => {
  it('both icons are direct children of the header cell (not inside the text span)', () => {
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [
        sorting({ initialSort: [{ columnId: 'id', direction: 'asc' }] }),
        filtering(),
      ],
    });
    grid.mount(container);
    grid.refresh();

    // Find the right-aligned 'id' column header — worst case for overlap
    const idHeader = container.querySelector<HTMLElement>('.bg-header-cell[data-col="0"]');
    expect(idHeader).not.toBeNull();

    const textSpan = idHeader!.querySelector<HTMLElement>('.bg-header-cell__text');
    expect(textSpan).not.toBeNull();

    const sortIndicator = idHeader!.querySelector<HTMLElement>('.bg-sort-indicator');
    expect(sortIndicator).not.toBeNull();

    const filterBtn = idHeader!.querySelector<HTMLElement>('.bg-header-cell__filter-btn');
    expect(filterBtn).not.toBeNull();

    // Both icons must be direct children of the cell, NOT inside the text span.
    // Being direct children of the cell means they participate in absolute
    // positioning relative to the cell, not in the flex text flow.
    expect(sortIndicator!.parentElement).toBe(idHeader);
    expect(filterBtn!.parentElement).toBe(idHeader);

    // The text span must NOT contain either icon
    expect(textSpan!.querySelector('.bg-sort-indicator')).toBeNull();
    expect(textSpan!.querySelector('.bg-header-cell__filter-btn')).toBeNull();

    grid.destroy();
  });

  it('sort indicator has opacity inline style (set by sorting plugin)', () => {
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [
        sorting({ initialSort: [{ columnId: 'id', direction: 'asc' }] }),
        filtering(),
      ],
    });
    grid.mount(container);
    grid.refresh();

    const idHeader = container.querySelector<HTMLElement>('.bg-header-cell[data-col="0"]');
    const sortIndicator = idHeader!.querySelector<HTMLElement>('.bg-sort-indicator');
    expect(sortIndicator).not.toBeNull();

    // Sorting plugin sets opacity inline — verify it's present
    expect(sortIndicator!.style.opacity).toBe('0.6');

    // Sorting plugin must NOT set marginLeft (old inline layout approach) —
    // with absolute positioning, marginLeft is not needed and would cause
    // the indicator to shift away from its absolute-right position.
    expect(sortIndicator!.style.marginLeft).toBe('');

    grid.destroy();
  });

  it('header cell has bg-header-cell--filterable class when filter plugin is active', () => {
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [filtering()],
    });
    grid.mount(container);
    grid.refresh();

    // All leaf header cells (data-col attribute present) should be filterable
    const headerCells = container.querySelectorAll<HTMLElement>('.bg-header-cell[data-col]');
    expect(headerCells.length).toBeGreaterThan(0);
    for (const cell of headerCells) {
      expect(cell.classList.contains('bg-header-cell--filterable')).toBe(true);
    }

    grid.destroy();
  });

  it('header cell does NOT have bg-header-cell--filterable when no filter plugin', () => {
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [sorting()],
    });
    grid.mount(container);
    grid.refresh();

    const headerCells = container.querySelectorAll<HTMLElement>('.bg-header-cell[data-col]');
    for (const cell of headerCells) {
      expect(cell.classList.contains('bg-header-cell--filterable')).toBe(false);
    }

    grid.destroy();
  });

  it('sort indicator is present after toggling sort with filter plugin active', () => {
    const sortPlugin = sorting();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [sortPlugin, filtering()],
    });
    grid.mount(container);
    grid.refresh();

    // No indicators before sorting
    expect(container.querySelectorAll('.bg-sort-indicator').length).toBe(0);

    // Toggle sort on 'name' column
    (grid.plugins as Record<string, { toggleSort(id: string): void }>).sorting.toggleSort('name');
    grid.refresh();

    const nameHeader = container.querySelector<HTMLElement>('.bg-header-cell[data-col="1"]');
    expect(nameHeader).not.toBeNull();

    // filterable class must be present (filter plugin active)
    expect(nameHeader!.classList.contains('bg-header-cell--filterable')).toBe(true);

    // Sort indicator must be a direct child of the header cell
    const sortIndicator = nameHeader!.querySelector<HTMLElement>('.bg-sort-indicator');
    expect(sortIndicator).not.toBeNull();
    expect(sortIndicator!.parentElement).toBe(nameHeader);

    // Filter button must also be a direct child of the header cell
    const filterBtn = nameHeader!.querySelector<HTMLElement>('.bg-header-cell__filter-btn');
    expect(filterBtn).not.toBeNull();
    expect(filterBtn!.parentElement).toBe(nameHeader);

    grid.destroy();
  });
});
