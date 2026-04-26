import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';

interface Row { id: number; a: string; b: string }

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

describe('column.hide', () => {
  test('hidden columns are excluded from the rendered layout', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { field: 'a' as never, headerName: 'A' },
        { field: 'b' as never, headerName: 'B', hide: true },
      ],
      data: [{ id: 1, a: 'x', b: 'y' }],
    });
    grid.mount(host);
    grid.refresh();

    const headerCells = host.querySelectorAll('.bg-header-cell');
    expect(headerCells.length).toBe(1);
    expect(headerCells[0].textContent).toContain('A');

    grid.unmount();
  });

  test('setColumnHidden toggles visibility at runtime', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { field: 'a' as never, headerName: 'A' },
        { field: 'b' as never, headerName: 'B' },
      ],
      data: [{ id: 1, a: 'x', b: 'y' }],
    });
    grid.mount(host);
    grid.refresh();

    expect(host.querySelectorAll('.bg-header-cell').length).toBe(2);

    grid.setColumnHidden('b', true);
    grid.refresh();
    expect(host.querySelectorAll('.bg-header-cell').length).toBe(1);

    grid.setColumnHidden('b', false);
    grid.refresh();
    expect(host.querySelectorAll('.bg-header-cell').length).toBe(2);

    grid.unmount();
  });
});
