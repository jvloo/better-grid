import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { createCellSelection } from '../src/selection/model';
import type { CellChange, ColumnDef } from '../src/types';

interface Row {
  id: number;
  label: string;
  amount: number;
  note: string;
  canEditAmount: boolean;
}

const data: Row[] = [
  { id: 1, label: 'Read only', amount: 10, note: 'Locked', canEditAmount: false },
  { id: 2, label: 'Editable', amount: 20, note: 'Editable note', canEditAmount: true },
];

let originalRaf: typeof requestAnimationFrame;
let originalCancelRaf: typeof cancelAnimationFrame;
let pendingRaf: FrameRequestCallback[] = [];

beforeEach(() => {
  document.body.innerHTML = '';
  pendingRaf = [];
  originalRaf = globalThis.requestAnimationFrame;
  originalCancelRaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    pendingRaf.push(cb);
    return pendingRaf.length;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
  document.body.innerHTML = '';
});

function flushRaf(): void {
  for (let safety = 0; safety < 32 && pendingRaf.length > 0; safety++) {
    const queue = pendingRaf;
    pendingRaf = [];
    for (const cb of queue) cb(performance.now());
  }
}

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 640 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 320 });
  document.body.appendChild(host);
  return host;
}

describe('selection fill handle editability', () => {
  it('renders selection for selected cells but only renders the fill handle for editable cells', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'label', field: 'label', headerName: 'Label', editable: false },
      {
        id: 'amount',
        field: 'amount',
        headerName: 'Amount',
        editable: (row) => row.canEditAmount,
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      selection: { mode: 'range', fillHandle: true },
    });

    grid.mount(host);
    grid.refresh();
    flushRaf();

    grid.setSelection(createCellSelection({ rowIndex: 0, colIndex: 1 }));
    flushRaf();
    expect(host.querySelector('.bg-fill-handle')).toBeNull();
    expect(host.querySelector('.bg-selection-range--single')).not.toBeNull();

    grid.setSelection(createCellSelection({ rowIndex: 1, colIndex: 1 }));
    flushRaf();
    expect(host.querySelector('.bg-fill-handle')).not.toBeNull();
    const sourceRange = host.querySelector<HTMLElement>('.bg-selection-range--single');
    expect(sourceRange).not.toBeNull();
    const overlay = host.querySelector<HTMLElement>('.bg-selection-overlay');
    const activeCell = host.querySelector<HTMLElement>('.bg-cell--active');
    expect(overlay).not.toBeNull();
    expect(activeCell).not.toBeNull();
    expect(Number(getComputedStyle(overlay!).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(activeCell!).zIndex),
    );

    grid.setSelection(createCellSelection({ rowIndex: 1, colIndex: 0 }));
    flushRaf();
    expect(host.querySelector('.bg-fill-handle')).toBeNull();
    expect(host.querySelector('.bg-selection-range--single')).not.toBeNull();

    grid.unmount();
  });

  it('honors selection fillHandlePredicate for editable non-bulk cells', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'label', field: 'label', headerName: 'Label', editable: false },
      {
        id: 'amount',
        field: 'amount',
        headerName: 'Amount',
        editable: (row) => row.canEditAmount,
      },
      { id: 'note', field: 'note', headerName: 'Note', editable: true },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      selection: {
        mode: 'range',
        fillHandle: true,
        fillHandlePredicate: ({ column }) => column.id === 'amount',
      },
    });

    grid.mount(host);
    grid.refresh();
    flushRaf();

    grid.setSelection(createCellSelection({ rowIndex: 1, colIndex: 2 }));
    flushRaf();
    expect(host.querySelector('.bg-fill-handle')).toBeNull();
    expect(host.querySelector('.bg-selection-range--single')).not.toBeNull();

    grid.setSelection(createCellSelection({ rowIndex: 1, colIndex: 1 }));
    flushRaf();
    expect(host.querySelector('.bg-fill-handle')).not.toBeNull();
    expect(host.querySelector('.bg-selection-range--single')).not.toBeNull();

    grid.unmount();
  });

  it('keeps native text selection and skips grid selection for non-selectable cells', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'label', field: 'label', headerName: 'Label', editable: true },
      {
        id: 'amount',
        field: 'amount',
        headerName: 'Amount',
        editable: (row) => row.canEditAmount,
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      selection: {
        mode: 'range',
        fillHandle: true,
        cellSelectionPredicate: ({ column }) => column.id === 'amount',
      },
    });

    grid.mount(host);
    grid.refresh();
    flushRaf();

    const labelCell = host.querySelector<HTMLElement>('.bg-cell[data-row="0"][data-col="0"]');
    const amountCell = host.querySelector<HTMLElement>('.bg-cell[data-row="0"][data-col="1"]');
    expect(labelCell).not.toBeNull();
    expect(amountCell).not.toBeNull();
    expect(labelCell!.classList.contains('bg-cell--native-text-selectable')).toBe(true);
    expect(amountCell!.classList.contains('bg-cell--native-text-selectable')).toBe(false);

    labelCell!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    flushRaf();
    expect(grid.getSelection().active).toBeNull();
    expect(grid.getSelection().ranges).toHaveLength(0);
    expect(document.activeElement).not.toBe(host);

    amountCell!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    flushRaf();
    expect(grid.getSelection().active).toEqual({ rowIndex: 0, colIndex: 1 });
    expect(document.activeElement).toBe(host);
    expect(host.querySelector('.bg-fill-handle')).toBeNull();
    expect(host.querySelector('.bg-selection-range--single')).not.toBeNull();

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    flushRaf();
    expect(grid.getSelection().active).toEqual({ rowIndex: 0, colIndex: 1 });

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    flushRaf();
    expect(grid.getSelection().active).toEqual({ rowIndex: 1, colIndex: 1 });
    expect(host.querySelector('.bg-fill-handle')).not.toBeNull();
    expect(host.querySelector('.bg-selection-range--single')).not.toBeNull();

    grid.unmount();
  });

  it('batches fallback fill-handle updates into one cell-change payload', () => {
    const columns: ColumnDef<{ jan: number; feb: number; mar: number }>[] = [
      { id: 'jan', field: 'jan', headerName: 'Jan', width: 80, editable: true },
      { id: 'feb', field: 'feb', headerName: 'Feb', width: 80, editable: true },
      { id: 'mar', field: 'mar', headerName: 'Mar', width: 80, editable: true },
    ];
    const optionCalls: CellChange<{ jan: number; feb: number; mar: number }>[][] = [];

    const host = makeHost();
    const grid = createGrid<{ jan: number; feb: number; mar: number }>({
      columns,
      data: [{ jan: 10, feb: 20, mar: 30 }],
      selection: { mode: 'range', fillHandle: true },
      onCellChange: (changes) => optionCalls.push(changes),
    });

    grid.mount(host);
    grid.refresh();
    flushRaf();

    grid.setSelection(createCellSelection({ rowIndex: 0, colIndex: 0 }));
    flushRaf();

    const handle = host.querySelector<HTMLElement>('.bg-fill-handle');
    expect(handle).not.toBeNull();

    handle!.dispatchEvent(new PointerEvent('pointerdown', { clientX: 80, clientY: 20, bubbles: true, cancelable: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 220, clientY: 20, bubbles: true, cancelable: true }));
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 220, clientY: 20, bubbles: true, cancelable: true }));
    flushRaf();

    expect(optionCalls).toHaveLength(1);
    expect(optionCalls[0]).toHaveLength(2);
    expect(optionCalls[0]!.map((change) => [change.columnId, change.oldValue, change.newValue])).toEqual([
      ['feb', 20, 10],
      ['mar', 30, 10],
    ]);
    expect(grid.getData()).toEqual([{ jan: 10, feb: 10, mar: 10 }]);

    grid.unmount();
  });
});
