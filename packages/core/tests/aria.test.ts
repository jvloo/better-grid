import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef } from '../src/types';

interface Row { id: number; name: string; age: number; }

let container: HTMLElement;
let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(container);
  // Make rAF fire synchronously so render() runs before our assertions
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function makeGrid(overrides: {
  data?: Row[];
  columns?: ColumnDef<Row>[];
} = {}) {
  const grid = createGrid<Row>({
    data: overrides.data ?? [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ],
    columns: overrides.columns ?? [
      { id: 'name', field: 'name', header: 'Name' },
      { id: 'age', field: 'age', header: 'Age' },
    ],
  });
  grid.mount(container);
  grid.refresh();
  return grid;
}

describe('ARIA', () => {
  it('container has role="grid" with aria-rowcount and aria-colcount after mount', () => {
    const grid = makeGrid();
    expect(container.getAttribute('role')).toBe('grid');
    expect(container.getAttribute('aria-rowcount')).toBe('2');
    expect(container.getAttribute('aria-colcount')).toBe('2');
    grid.destroy();
  });

  it('strips role and aria-* attributes on unmount', () => {
    const grid = makeGrid();
    grid.unmount();
    expect(container.hasAttribute('role')).toBe(false);
    expect(container.hasAttribute('aria-rowcount')).toBe(false);
    expect(container.hasAttribute('aria-colcount')).toBe(false);
  });

  it('aria-rowcount refreshes when data changes', () => {
    const grid = makeGrid();
    grid.setData([
      { id: 1, name: 'a', age: 1 },
      { id: 2, name: 'b', age: 2 },
      { id: 3, name: 'c', age: 3 },
    ]);
    expect(container.getAttribute('aria-rowcount')).toBe('3');
    grid.destroy();
  });

  it('header cells have role="columnheader" and 1-based aria-colindex', () => {
    const grid = makeGrid();
    const headers = container.querySelectorAll('.bg-header-cell');
    expect(headers.length).toBeGreaterThan(0);
    for (const h of headers) {
      expect(h.getAttribute('role')).toBe('columnheader');
    }
    const first = headers[0] as HTMLElement;
    expect(first.getAttribute('aria-colindex')).toBe('1');
    grid.destroy();
  });

  it('aria-sort starts at "none" when a sorting plugin is active', async () => {
    const { sorting } = await import('../../plugins/src/free/sorting');
    const grid = createGrid<Row>({
      data: [{ id: 1, name: 'a', age: 1 }],
      columns: [
        { id: 'name', field: 'name', header: 'Name', sortable: true },
      ],
      plugins: [sorting()],
    });
    grid.mount(container);
    grid.refresh();
    const header = container.querySelector('.bg-header-cell') as HTMLElement;
    expect(header.getAttribute('aria-sort')).toBe('none');
    grid.destroy();
  });
});
