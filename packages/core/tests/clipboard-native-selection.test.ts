import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid } from '../src/grid';
import { clipboard } from '../../plugins/src/free/clipboard';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
  name: string;
  amount?: number;
  editable?: boolean;
}

let originalClipboard: Clipboard | undefined;
let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalClipboard = navigator.clipboard;
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  globalThis.requestAnimationFrame = originalRaf;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 300 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 160 });
  document.body.appendChild(host);
  return host;
}

function makeColumns(): ColumnDef<Row>[] {
  return [
    {
      id: 'name',
      field: 'name',
      headerName: 'Name',
      width: 120,
    },
  ];
}

function getMountedGridElement(host: HTMLElement): HTMLElement {
  return host.classList.contains('bg-grid') ? host : (host.querySelector('.bg-grid') as HTMLElement);
}

describe('clipboard native text selection', () => {
  it('lets the browser copy selected text instead of grid range data on Ctrl+C', () => {
    const host = makeHost();
    const onCopy = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: [{ name: 'Alpha' }],
      plugins: [clipboard({ onCopy })],
      selection: false,
    });

    grid.mount(host);
    grid.refresh();

    const gridEl = getMountedGridElement(host);
    const textEl = host.querySelector('.bg-cell__text') as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    gridEl.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
    expect(onCopy).not.toHaveBeenCalled();

    grid.unmount();
  });

  it('still handles Ctrl+C through the grid clipboard when no browser text is selected', () => {
    const host = makeHost();
    const onCopy = vi.fn();
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    });
    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: [{ name: 'Alpha' }],
      plugins: [clipboard({ onCopy })],
      selection: { mode: 'range' },
    });

    grid.mount(host);
    grid.refresh();
    grid.setSelection({ active: { rowIndex: 0, colIndex: 0 }, ranges: [] });

    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    getMountedGridElement(host).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onCopy).toHaveBeenCalledWith('Alpha');
    expect(write.mock.calls.length + writeText.mock.calls.length).toBeGreaterThan(0);

    grid.unmount();
  });

  it('honors cellSelectionPredicate before creating a range selection', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { id: 'name', field: 'name', headerName: 'Name', width: 120 },
        { id: 'amount', field: 'amount', headerName: 'Amount', width: 120 },
      ],
      data: [{ name: 'Alpha', amount: 1 }],
      selection: {
        mode: 'range',
        cellSelectionPredicate: ({ column }) => column.id === 'amount',
      },
    });

    grid.mount(host);
    grid.refresh();

    const nameCell = host.querySelector('.bg-cell') as HTMLElement;
    nameCell.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      pointerId: 1,
    }));

    expect(grid.getState().selection.active).toBeNull();
    expect(grid.getState().selection.ranges).toEqual([]);

    const amountCell = host.querySelectorAll('.bg-cell')[1] as HTMLElement;
    amountCell.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      pointerId: 2,
    }));

    expect(grid.getState().selection.active).toEqual({ rowIndex: 0, colIndex: 1 });
    expect(grid.getState().selection.ranges).toEqual([
      { startRow: 0, endRow: 0, startCol: 1, endCol: 1 },
    ]);

    grid.unmount();
  });

  it('focuses the grid when a selectable cell is clicked so Ctrl+C copies the selected range', () => {
    const host = makeHost();
    const onCopy = vi.fn();
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    });
    const grid = createGrid<Row>({
      columns: [
        { id: 'name', field: 'name', headerName: 'Name', width: 120 },
        { id: 'amount', field: 'amount', headerName: 'Amount', width: 120 },
      ],
      data: [{ name: 'Alpha', amount: 42 }],
      plugins: [clipboard({ onCopy })],
      selection: {
        mode: 'range',
        cellSelectionPredicate: ({ column }) => column.id === 'amount',
      },
    });

    grid.mount(host);
    grid.refresh();

    const gridEl = getMountedGridElement(host);
    const amountCell = host.querySelectorAll('.bg-cell')[1] as HTMLElement;
    amountCell.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      pointerId: 1,
    }));

    expect(document.activeElement).toBe(gridEl);

    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.activeElement?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onCopy).toHaveBeenCalledWith('42');
    expect(write.mock.calls.length + writeText.mock.calls.length).toBeGreaterThan(0);

    grid.unmount();
  });

  it('honors fillHandlePredicate when rendering the fill handle', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { id: 'name', field: 'name', headerName: 'Name', width: 120 },
        { id: 'amount', field: 'amount', headerName: 'Amount', width: 120 },
      ],
      data: [
        { name: 'Alpha', amount: 1, editable: true },
        { name: 'Beta', amount: 2, editable: false },
      ],
      selection: {
        mode: 'range',
        fillHandle: true,
        fillHandlePredicate: ({ row, column }) => column.id === 'amount' && row.editable === true,
      },
    });

    grid.mount(host);
    grid.refresh();

    grid.setSelection({
      active: { rowIndex: 0, colIndex: 0 },
      ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0 }],
    });
    expect(host.querySelector('.bg-fill-handle')).toBeNull();

    grid.setSelection({
      active: { rowIndex: 1, colIndex: 1 },
      ranges: [{ startRow: 1, endRow: 1, startCol: 1, endCol: 1 }],
    });
    expect(host.querySelector('.bg-fill-handle')).toBeNull();

    grid.setSelection({
      active: { rowIndex: 0, colIndex: 1 },
      ranges: [{ startRow: 0, endRow: 0, startCol: 1, endCol: 1 }],
    });
    expect(host.querySelector('.bg-fill-handle')).not.toBeNull();

    grid.unmount();
  });

  it('renders the selection overlay above active and editing cells', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [{ id: 'amount', field: 'amount', headerName: 'Amount', width: 120, editable: true }],
      data: [{ name: 'Alpha', amount: 1 }],
      selection: { mode: 'range' },
    });

    grid.mount(host);
    grid.refresh();
    grid.setSelection({
      active: { rowIndex: 0, colIndex: 0 },
      ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 0 }],
    });

    const overlay = host.querySelector('.bg-selection-overlay') as HTMLElement;
    expect(overlay.style.zIndex).toBe('6');
    expect(host.querySelector('.bg-selection-range')).not.toBeNull();

    grid.unmount();
  });

  it('supports per-column double-click edit trigger while the grid defaults to click edit', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { id: 'name', field: 'name', headerName: 'Name', width: 120, editable: true },
        {
          id: 'amount',
          field: 'amount',
          headerName: 'Amount',
          width: 120,
          editable: true,
          meta: { editTrigger: 'dblclick' },
        },
      ],
      data: [{ name: 'Alpha', amount: 42 }],
      plugins: [editing({ editTrigger: 'click' })],
      selection: { mode: 'range' },
    });

    grid.mount(host);
    grid.refresh();

    let cells = host.querySelectorAll('.bg-cell');
    const nameCell = cells[0] as HTMLElement;
    let amountCell = cells[1] as HTMLElement;

    amountCell.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      pointerId: 1,
    }));
    expect(amountCell.classList.contains('bg-cell--editing')).toBe(false);

    nameCell.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      pointerId: 2,
    }));
    expect(nameCell.classList.contains('bg-cell--editing')).toBe(true);

    amountCell.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      pointerId: 3,
    }));
    cells = host.querySelectorAll('.bg-cell');
    amountCell = cells[1] as HTMLElement;
    expect(amountCell.classList.contains('bg-cell--editing')).toBe(false);

    amountCell.dispatchEvent(new MouseEvent('dblclick', {
      bubbles: true,
      button: 0,
    }));
    expect(amountCell.classList.contains('bg-cell--editing')).toBe(true);

    grid.unmount();
  });

});
