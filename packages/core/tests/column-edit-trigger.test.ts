import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
  name: string;
  amount: number;
}

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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 640 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 320 });
  document.body.appendChild(host);
  return host;
}

function clickCell(cell: HTMLElement): void {
  cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

function doubleClickCell(cell: HTMLElement): void {
  clickCell(cell);
  cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
}

describe('column edit trigger overrides', () => {
  it('lets click-to-edit grids use single click selection and double click editing for opt-in columns', () => {
    const host = makeHost();
    const columns: ColumnDef<Row>[] = [
      { id: 'name', field: 'name', headerName: 'Name', editable: true },
      {
        id: 'amount',
        field: 'amount',
        headerName: 'Amount',
        editable: true,
        meta: { editTrigger: 'dblclick' },
      },
    ];
    const grid = createGrid<Row>({
      columns,
      data: [{ name: 'Land', amount: 2_500_000 }],
      plugins: [editing({ editTrigger: 'click', inputStyle: true })],
      selection: { mode: 'range' },
    });

    grid.mount(host);
    grid.refresh();

    const normalCell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
    clickCell(normalCell);
    expect(grid.plugins.editing.isEditing()).toBe(true);
    grid.plugins.editing.commitEdit();

    const bulkCell = host.querySelector('.bg-cell[data-row="0"][data-col="1"]') as HTMLElement;
    clickCell(bulkCell);
    expect(grid.getSelection().active).toEqual({ rowIndex: 0, colIndex: 1 });
    expect(grid.plugins.editing.isEditing()).toBe(false);
    expect(host.querySelector('.bg-cell-editor')).toBeNull();

    doubleClickCell(bulkCell);
    expect(grid.plugins.editing.isEditing()).toBe(true);
    expect(document.body.querySelector('.bg-cell-editor')).not.toBeNull();

    grid.unmount();
  });
});
