import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { createCellSelection } from '../src/selection/model';
import { clipboard } from '../../plugins/src/free/clipboard';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  amount: number;
}

const data: Row[] = [{ id: 1, amount: 2_500_000 }];

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

describe('clipboard copy while editing', () => {
  it('copies the selected cell when a BG editor has focus and no editor text is selected', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: () => Promise.reject(new Error('force writeText fallback')),
        writeText: (text: string) => {
          writes.push(text);
          return Promise.resolve();
        },
      },
    });

    const columns: ColumnDef<Row>[] = [
      { id: 'amount', field: 'amount', headerName: 'Amount', editable: true },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [editing(), clipboard()],
      selection: { mode: 'range' },
    });

    grid.mount(host);
    grid.refresh();
    flushRaf();

    grid.setSelection(createCellSelection({ rowIndex: 0, colIndex: 0 }));
    grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 0 });
    flushRaf();

    const editor = document.querySelector<HTMLElement>('.bg-cell-editor');
    expect(editor).not.toBeNull();
    editor!.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    range.setStart(editor!.firstChild ?? editor!, (editor!.textContent ?? '').length);
    range.collapse(true);
    selection?.addRange(range);
    expect(grid.plugins.editing.isEditing()).toBe(true);

    editor!.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
    await Promise.resolve();
    await Promise.resolve();

    expect(writes).toEqual(['2500000']);

    grid.unmount();
  });
});
