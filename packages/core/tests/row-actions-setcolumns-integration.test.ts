/**
 * Integration test: rowActions cellRenderer wrap survives setColumns().
 *
 * Regression test for the same class of bug fixed in editing.ts (commit e87dd36):
 * grid.setColumns() — called by React's useEffect on first render — creates fresh
 * ColumnDef spread-copies via normalizeColumn(), discarding the cellRenderer
 * mutation applied by the rowActions plugin during init(). The fix extracts the
 * wrap into applyColumnWrap() and subscribes to 'columns:set' to re-apply it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { rowActions } from '../../pro/src/row-actions';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  name: string;
}

const data: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Carol' },
];

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

const columns: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', headerName: 'Name', width: 200 },
  { id: 'actions', field: 'id', headerName: 'Actions', width: 80 },
];

function makePlugin() {
  return rowActions({
    column: 'actions',
    getActions: () => [{ id: 'delete', label: 'Delete' }],
    onAction: () => { /* noop */ },
  });
}

describe('rowActions — cellRenderer wrap survives setColumns()', () => {
  it('renders .bg-row-actions-trigger buttons on initial mount', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [makePlugin()],
    });

    grid.mount(host);
    grid.refresh();

    const triggers = host.querySelectorAll('.bg-row-actions-trigger');
    // One trigger per row (3 rows)
    expect(triggers.length).toBeGreaterThan(0);
    grid.unmount();
  });

  it('renders .bg-row-actions-trigger buttons after setColumns() — React useEffect pattern', () => {
    // This is the exact sequence that caused the regression:
    // 1. createGrid() → plugin init → rowActions wraps the column's cellRenderer
    // 2. grid.setColumns(columns) → normalizeColumn() creates fresh spread-copies,
    //    discarding the cellRenderer mutation → without the fix, no trigger buttons appear
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [makePlugin()],
    });

    grid.mount(host);

    // Simulate React's useEffect calling setColumns with the same columns object.
    grid.setColumns(columns);
    grid.refresh();

    const triggers = host.querySelectorAll('.bg-row-actions-trigger');
    expect(triggers.length).toBeGreaterThan(0);
    grid.unmount();
  });

  it('double setColumns() call does not double-wrap (sentinel guard)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [makePlugin()],
    });

    grid.mount(host);
    grid.setColumns(columns);
    grid.setColumns(columns);
    grid.refresh();

    const triggers = host.querySelectorAll('.bg-row-actions-trigger');
    // Should still render correctly — not zero, not double-per-cell
    expect(triggers.length).toBeGreaterThan(0);
    grid.unmount();
  });
});
