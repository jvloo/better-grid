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

describe('column.headerAlign', () => {
  test('defaults to align when unset', () => {
    const host = makeHost();
    const grid = createGrid<{ x: number }>({
      columns: [{ field: 'x' as never, headerName: 'X', align: 'right' }],
      data: [],
    });
    grid.mount(host);
    grid.refresh();
    const headerCell = host.querySelector('.bg-header-cell') as HTMLElement;
    expect(headerCell.style.textAlign).toBe('right');
    grid.unmount();
  });

  test('headerAlign overrides align', () => {
    const host = makeHost();
    const grid = createGrid<{ x: number }>({
      columns: [{ field: 'x' as never, headerName: 'X', align: 'right', headerAlign: 'center' }],
      data: [],
    });
    grid.mount(host);
    grid.refresh();
    const headerCell = host.querySelector('.bg-header-cell') as HTMLElement;
    expect(headerCell.style.textAlign).toBe('center');
    grid.unmount();
  });
});
