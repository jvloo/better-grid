/**
 * Integration test: auto-detect inferred cellType/align survive setColumns().
 *
 * Regression test for the same class of bug fixed in editing.ts (commit e87dd36),
 * hierarchy.ts (commit ee88753), and row-actions.ts (commit 520e641):
 * grid.setColumns() — called by React's useEffect on first render — creates fresh
 * ColumnDef spread-copies via normalizeColumn(), discarding the cellType/align
 * mutations applied by the auto-detect plugin during init(). The fix extracts the
 * detection loop into applyAutoDetect() and subscribes to 'columns:set' to
 * re-apply it to the new column references.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { autoDetect } from '../../plugins/src/free/auto-detect';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  value: number;
  label: string;
  active: boolean;
}

const data: Row[] = [
  { id: 1, value: 1.5, label: 'Alpha', active: true },
  { id: 2, value: -7, label: 'Beta', active: false },
  { id: 3, value: 42, label: 'Gamma', active: true },
  { id: 4, value: 0.5, label: 'Delta', active: false },
  { id: 5, value: 100, label: 'Epsilon', active: true },
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

// Column definitions without explicit cellType — auto-detect should infer them.
const columns: ColumnDef<Row>[] = [
  { id: 'id', field: 'id', headerName: 'ID', width: 60 },
  { id: 'value', field: 'value', headerName: 'Value', width: 120 },
  { id: 'label', field: 'label', headerName: 'Label', width: 150 },
  { id: 'active', field: 'active', headerName: 'Active', width: 80 },
];

describe('auto-detect — inferred cellType/align survives setColumns()', () => {
  it('infers cellType="number" and align="right" on the numeric column at init', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [autoDetect()],
    });

    grid.mount(host);
    grid.refresh();

    const state = grid.getState();
    const valueCol = state.columns.find((c) => c.id === 'value');
    expect(valueCol?.cellType).toBe('number');
    expect(valueCol?.align).toBe('right');

    grid.unmount();
  });

  it('infers cellType="boolean" and align="center" on the boolean column at init', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [autoDetect()],
    });

    grid.mount(host);
    grid.refresh();

    const state = grid.getState();
    const activeCol = state.columns.find((c) => c.id === 'active');
    expect(activeCol?.cellType).toBe('boolean');
    expect(activeCol?.align).toBe('center');

    grid.unmount();
  });

  it('inferred cellType="number" survives setColumns() — React useEffect pattern', () => {
    // This is the exact sequence that caused the regression:
    // 1. createGrid() → plugin init → auto-detect infers cellType on columns
    // 2. grid.setColumns(columns) → normalizeColumn() creates fresh spread-copies,
    //    discarding the cellType mutation → without the fix, numbers render as raw values
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [autoDetect()],
    });

    grid.mount(host);

    // Simulate React's useEffect calling setColumns with the same column defs.
    grid.setColumns(columns);
    grid.refresh();

    const state = grid.getState();
    const valueCol = state.columns.find((c) => c.id === 'value');
    expect(valueCol?.cellType).toBe('number');
    expect(valueCol?.align).toBe('right');

    grid.unmount();
  });

  it('inferred cellType="boolean" survives setColumns() — React useEffect pattern', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [autoDetect()],
    });

    grid.mount(host);
    grid.setColumns(columns);
    grid.refresh();

    const state = grid.getState();
    const activeCol = state.columns.find((c) => c.id === 'active');
    expect(activeCol?.cellType).toBe('boolean');
    expect(activeCol?.align).toBe('center');

    grid.unmount();
  });

  it('columns with an explicit cellType are not overwritten after setColumns()', () => {
    const explicitColumns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID', width: 60 },
      // value has explicit cellType='currency' — auto-detect must not touch it
      { id: 'value', field: 'value', headerName: 'Value', width: 120, cellType: 'currency' },
      { id: 'label', field: 'label', headerName: 'Label', width: 150 },
      { id: 'active', field: 'active', headerName: 'Active', width: 80 },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns: explicitColumns,
      data,
      plugins: [autoDetect()],
    });

    grid.mount(host);
    grid.setColumns(explicitColumns);
    grid.refresh();

    const state = grid.getState();
    const valueCol = state.columns.find((c) => c.id === 'value');
    expect(valueCol?.cellType).toBe('currency');

    grid.unmount();
  });

  it('double setColumns() call does not double-apply or corrupt inferred types (sentinel guard)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [autoDetect()],
    });

    grid.mount(host);
    grid.setColumns(columns);
    grid.setColumns(columns);
    grid.refresh();

    const state = grid.getState();
    const valueCol = state.columns.find((c) => c.id === 'value');
    expect(valueCol?.cellType).toBe('number');
    expect(valueCol?.align).toBe('right');

    grid.unmount();
  });

  it('string columns receive no inferred cellType', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [autoDetect()],
    });

    grid.mount(host);
    grid.setColumns(columns);
    grid.refresh();

    const state = grid.getState();
    const labelCol = state.columns.find((c) => c.id === 'label');
    // Strings: no special cellType should be inferred
    expect(labelCol?.cellType).toBeUndefined();

    grid.unmount();
  });
});
