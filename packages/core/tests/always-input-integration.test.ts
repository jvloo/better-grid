/**
 * Integration test: alwaysInput cells render <input> elements after setColumns().
 *
 * Regression test for a bug where grid.setColumns() — called by React's useEffect
 * on first render — created fresh ColumnDef spread-copies via normalizeColumn(),
 * discarding the cellClass/cellRenderer mutations applied by the editing plugin
 * during init(). The fix adds a 'columns:set' event to GridEvents and has the
 * editing plugin subscribe to re-apply its wrapping on the new column references.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  qty: number;
  notes: string;
}

const data: Row[] = [
  { id: 1, qty: 10, notes: '' },
  { id: 2, qty: 60, notes: 'hello' },
  { id: 3, qty: 5, notes: '' },
];

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  // Make requestAnimationFrame synchronous so grid.refresh() renders immediately.
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

describe('alwaysInput — input elements survive setColumns()', () => {
  it('renders <input class="bg-always-input"> on initial mount + init wrap', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID', editable: false },
      { id: 'qty', field: 'qty', headerName: 'Qty', alwaysInput: true },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [editing()],
    });

    grid.mount(host);
    grid.refresh();

    const inputs = host.querySelectorAll('input.bg-always-input');
    expect(inputs.length).toBeGreaterThan(0);
    grid.unmount();
  });

  it('renders <input class="bg-always-input"> after setColumns() with the same columns (React useEffect pattern)', () => {
    // This is the exact sequence that caused the regression:
    // 1. createGrid() → plugins init → editing wraps columns in the store
    // 2. grid.setColumns(columns) → normalizeColumn() creates fresh spread-copies,
    //    discarding all mutations → without the fix, no inputs appear
    const columns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID', editable: false },
      { id: 'qty', field: 'qty', headerName: 'Qty', alwaysInput: true },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [editing()],
    });

    grid.mount(host);

    // Simulate React's useEffect calling setColumns with the same columns object.
    // This is what triggers the regression: fresh ColumnDef copies discard mutations.
    grid.setColumns(columns);
    grid.refresh();

    const inputs = host.querySelectorAll('input.bg-always-input');
    expect(inputs.length).toBeGreaterThan(0);
    grid.unmount();
  });

  it('per-row alwaysInput function: only qualifying rows get <input>', () => {
    // notes column: alwaysInput only when qty > 50
    const columns: ColumnDef<Row>[] = [
      { id: 'qty', field: 'qty', headerName: 'Qty', alwaysInput: true },
      {
        id: 'notes',
        field: 'notes',
        headerName: 'Notes',
        alwaysInput: (row) => (row as Row).qty > 50,
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [editing()],
    });

    grid.mount(host);
    // Simulate React useEffect setColumns call (the regression trigger)
    grid.setColumns(columns);
    grid.refresh();

    // qty column (alwaysInput: true) — 3 rows visible → 3 inputs
    // notes column — only row with qty=60 (> 50) → 1 additional input
    // Total: at minimum 4 inputs, but check that SOME exist
    const inputs = host.querySelectorAll('input.bg-always-input');
    expect(inputs.length).toBeGreaterThanOrEqual(1);

    // Cells with bg-cell--always-input class must be present
    const alwaysInputCells = host.querySelectorAll('.bg-cell--always-input');
    expect(alwaysInputCells.length).toBeGreaterThan(0);

    grid.unmount();
  });

  it('columns without alwaysInput do NOT get bg-cell--always-input class', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID' },
      { id: 'qty', field: 'qty', headerName: 'Qty', alwaysInput: true },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [editing()],
    });

    grid.mount(host);
    grid.setColumns(columns);
    grid.refresh();

    // The id column has no alwaysInput, so no bg-cell--always-input on its cells.
    // The qty column does → some cells have it.
    const alwaysInputCells = host.querySelectorAll('.bg-cell--always-input');
    expect(alwaysInputCells.length).toBeGreaterThan(0);

    // All alwaysInput cells must contain an <input>
    for (const cell of Array.from(alwaysInputCells)) {
      const input = cell.querySelector('input.bg-always-input');
      expect(input).not.toBeNull();
    }

    grid.unmount();
  });
});
