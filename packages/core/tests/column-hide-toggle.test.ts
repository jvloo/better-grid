import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';

interface Row { id: number; a: string }

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

describe('column.hide second-toggle regression', () => {
  test('Show → Hide → Show cycle works when column starts hidden', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { id: 'a', field: 'a' as never, headerName: 'A' },
        { id: 'hidden', field: 'id' as never, headerName: 'Hidden', hide: true },
      ],
      data: [{ id: 1, a: 'x' }],
    });
    grid.mount(host);
    grid.refresh();

    // Initial: hidden column excluded
    expect(host.querySelectorAll('.bg-header-cell').length).toBe(1);

    // Show: 1 → 2
    grid.setColumnHidden('hidden', false);
    grid.refresh();
    expect(host.querySelectorAll('.bg-header-cell').length).toBe(2);

    // Hide again: 2 → 1 (this is the regression — was staying at 2)
    grid.setColumnHidden('hidden', true);
    grid.refresh();
    expect(host.querySelectorAll('.bg-header-cell').length).toBe(1);

    // Show again: 1 → 2
    grid.setColumnHidden('hidden', false);
    grid.refresh();
    expect(host.querySelectorAll('.bg-header-cell').length).toBe(2);

    grid.unmount();
  });

  test('setColumnHidden updates aria-colcount', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { id: 'a', field: 'a' as never, headerName: 'A' },
        { id: 'hidden', field: 'id' as never, headerName: 'Hidden', hide: true },
      ],
      data: [{ id: 1, a: 'x' }],
    });
    grid.mount(host);
    grid.refresh();

    // Initial: 1 visible column → aria-colcount = 1
    expect(host.getAttribute('aria-colcount')).toBe('1');

    // Show: aria-colcount → 2
    grid.setColumnHidden('hidden', false);
    expect(host.getAttribute('aria-colcount')).toBe('2');

    // Hide: aria-colcount → 1 (regression: was not updating aria-colcount)
    grid.setColumnHidden('hidden', true);
    expect(host.getAttribute('aria-colcount')).toBe('1');

    grid.unmount();
  });
});
