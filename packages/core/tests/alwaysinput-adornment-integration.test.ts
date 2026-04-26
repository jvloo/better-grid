/**
 * Regression test: alwaysInput cells with prefix/suffix adornments render the
 * correct DOM structure — a separate span for the adornment and a bare numeric
 * value in the input, not baked-in text like "$7.5" or "7.5%".
 *
 * Bug: renderAlwaysInputCell created a bare <input> without wrapping
 * prefix/suffix spans, so percent/currency/unit columns lost their adornments
 * in always-on-input mode.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  rate: number;
  cost: number;
}

const data: Row[] = [
  { id: 1, rate: 7.5, cost: 1000 },
  { id: 2, rate: 3.5, cost: 2500 },
  { id: 3, rate: 11.5, cost: 500 },
];

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
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

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('alwaysInput — prefix/suffix adornments', () => {
  it('percent column renders a suffix span with "%" and bare number in input', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID' },
      {
        id: 'rate',
        field: 'rate',
        headerName: 'Rate',
        cellType: 'percent',
        suffix: '%',
        alwaysInput: true,
        editable: true,
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [editing()] });
    grid.mount(host);
    grid.refresh();

    const alwaysInputCells = host.querySelectorAll('.bg-cell--always-input');
    expect(alwaysInputCells.length).toBeGreaterThan(0);

    // Every always-input cell in the rate column must have a suffix span
    for (const cell of Array.from(alwaysInputCells)) {
      const suffixSpan = cell.querySelector<HTMLElement>('.bg-cell-input-suffix');
      expect(suffixSpan).not.toBeNull();
      expect(suffixSpan!.textContent).toBe('%');

      // The input value must NOT contain the suffix
      const input = cell.querySelector<HTMLInputElement>('input.bg-always-input');
      expect(input).not.toBeNull();
      expect(input!.value).not.toContain('%');
    }

    grid.unmount();
  });

  it('currency column renders a prefix span with "$" and bare number in input', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID' },
      {
        id: 'cost',
        field: 'cost',
        headerName: 'Cost',
        cellType: 'currency',
        prefix: '$',
        alwaysInput: true,
        editable: true,
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [editing()] });
    grid.mount(host);
    grid.refresh();

    const alwaysInputCells = host.querySelectorAll('.bg-cell--always-input');
    expect(alwaysInputCells.length).toBeGreaterThan(0);

    for (const cell of Array.from(alwaysInputCells)) {
      const prefixSpan = cell.querySelector<HTMLElement>('.bg-cell-input-prefix');
      expect(prefixSpan).not.toBeNull();
      expect(prefixSpan!.textContent).toBe('$');

      // The input value must NOT contain the prefix
      const input = cell.querySelector<HTMLInputElement>('input.bg-always-input');
      expect(input).not.toBeNull();
      expect(input!.value).not.toContain('$');
    }

    grid.unmount();
  });

  it('columns without prefix/suffix render no adornment spans', () => {
    const columns: ColumnDef<Row>[] = [
      {
        id: 'rate',
        field: 'rate',
        headerName: 'Rate',
        alwaysInput: true,
        editable: true,
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [editing()] });
    grid.mount(host);
    grid.refresh();

    const alwaysInputCells = host.querySelectorAll('.bg-cell--always-input');
    expect(alwaysInputCells.length).toBeGreaterThan(0);

    for (const cell of Array.from(alwaysInputCells)) {
      expect(cell.querySelector('.bg-cell-input-prefix')).toBeNull();
      expect(cell.querySelector('.bg-cell-input-suffix')).toBeNull();
    }

    grid.unmount();
  });

  it('input value is the bare number — no prefix/suffix baked in', () => {
    const columns: ColumnDef<Row>[] = [
      {
        id: 'rate',
        field: 'rate',
        headerName: 'Rate',
        suffix: '%',
        alwaysInput: true,
        editable: true,
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [editing()] });
    grid.mount(host);
    grid.refresh();

    const inputs = host.querySelectorAll<HTMLInputElement>('input.bg-always-input');
    expect(inputs.length).toBeGreaterThan(0);

    // All row values are plain numbers — input values should parse as numbers
    for (const input of Array.from(inputs)) {
      const val = input.value;
      expect(val).not.toContain('%');
      expect(Number.isFinite(parseFloat(val))).toBe(true);
    }

    grid.unmount();
  });
});
