import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 240 });
  document.body.appendChild(host);
  return host;
}

describe('editing inputStyle reuse', () => {
  it('reuses formatter-only input boxes across refreshes', () => {
    const host = makeHost();
    const columns: ColumnDef<Row>[] = [
      {
        id: 'amount',
        field: 'amount',
        headerName: 'Amount',
        editable: true,
        valueFormatter: (value) => `$${Number(value).toLocaleString('en-AU')}`,
      },
    ];
    const grid = createGrid<Row>({
      columns,
      data: [{ amount: 1200 }],
      plugins: [editing({ inputStyle: true })],
    });

    grid.mount(host);
    grid.refresh();

    const first = host.querySelector('.bg-input-box');
    expect(first).not.toBeNull();

    grid.refresh();

    expect(host.querySelector('.bg-input-box')).toBe(first);

    grid.unmount();
  });
});
