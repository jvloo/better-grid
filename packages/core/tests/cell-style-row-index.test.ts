import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';

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

describe('cellStyle / cellClass receive rowIndex', () => {
  test('rowIndex available in cellStyle', () => {
    const host = makeHost();
    const grid = createGrid<{ x: number }>({
      columns: [{
        field: 'x' as never,
        headerName: 'X',
        cellStyle: (_v, _r, rowIndex) => ({ fontWeight: rowIndex % 2 === 0 ? 'bold' : 'normal' }),
      }],
      data: [{ x: 0 }, { x: 1 }],
    });
    grid.mount(host);
    grid.refresh();
    const cells = host.querySelectorAll('.bg-cell');
    expect((cells[0] as HTMLElement).style.fontWeight).toBe('bold');
    expect((cells[1] as HTMLElement).style.fontWeight).toBe('normal');
    grid.unmount();
  });

  test('rowIndex available in cellClass', () => {
    const host = makeHost();
    const grid = createGrid<{ x: number }>({
      columns: [{
        field: 'x' as never,
        headerName: 'X',
        cellClass: (_v, _r, rowIndex) => `row-${rowIndex}`,
      }],
      data: [{ x: 0 }, { x: 1 }],
    });
    grid.mount(host);
    grid.refresh();
    const cells = host.querySelectorAll('.bg-cell');
    expect((cells[0] as HTMLElement).classList.contains('row-0')).toBe(true);
    expect((cells[1] as HTMLElement).classList.contains('row-1')).toBe(true);
    grid.unmount();
  });
});
