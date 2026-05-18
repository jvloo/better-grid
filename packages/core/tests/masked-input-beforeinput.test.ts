import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
  start: string;
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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 240 });
  document.body.appendChild(host);
  return host;
}

const columns: ColumnDef<Row>[] = [
  {
    id: 'start',
    field: 'start',
    headerName: 'Start',
    editable: true,
    cellEditor: 'masked',
    mask: 'MM/YY',
    valueFormatter: (value) => {
      if (!value || typeof value !== 'string') return '';
      const [year, month] = value.split('-');
      return year && month ? `${month}/${year.slice(-2)}` : '';
    },
    valueParser: (value) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 4) return undefined;
      return `20${digits.slice(2, 4)}-${digits.slice(0, 2)}-01`;
    },
  },
];

describe('masked input beforeinput', () => {
  it('commits multi-character inserted text through the mask parser', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [{ start: '' }],
      plugins: [editing({ inputStyle: true })],
    });

    grid.mount(host);
    grid.refresh();
    grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 0 });

    const input = document.body.querySelector('.bg-cell-editor--masked') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input!.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: '08/23',
      inputType: 'insertText',
    }));
    expect(input!.value).toBe('08/23');

    grid.plugins.editing.commitEdit();

    expect(grid.getState().data[0]?.start).toBe('2023-08-01');

    grid.unmount();
  });
});
