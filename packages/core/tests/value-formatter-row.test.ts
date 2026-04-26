import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';

interface Row { amount: number; currency: 'USD' | 'EUR' }

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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('valueFormatter receives row', () => {
  test('per-row currency formatting via row.currency', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        {
          field: 'amount' as never,
          headerName: 'Amount',
          valueFormatter: (value, row) =>
            new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency }).format(Number(value)),
        },
      ],
      data: [{ amount: 100, currency: 'USD' }, { amount: 100, currency: 'EUR' }],
    });
    grid.mount(host);
    grid.refresh();

    const cells = host.querySelectorAll('.bg-cell');
    // First row: USD
    expect(cells[0]?.textContent).toContain('$');
    // Second row: EUR
    expect(cells[1]?.textContent).toContain('€');

    grid.unmount();
  });
});
