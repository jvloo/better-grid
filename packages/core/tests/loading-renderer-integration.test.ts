/**
 * Integration test: loading cellType renders skeleton shimmer when value is truthy,
 * and renders nothing when value is falsy (false / null / undefined).
 *
 * Regression coverage:
 * - value === true  → shimmer element with non-zero height is present
 * - value === false → container is empty (no shimmer)
 * - value === null  → container is empty (no shimmer)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { cellRenderers } from '../../plugins/src/free/cell-renderers';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  isLoading: boolean | null;
}

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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

const columns: ColumnDef<Row>[] = [
  { id: 'id', field: 'id', headerName: 'ID', width: 60 },
  { id: 'isLoading', field: 'isLoading', headerName: 'Loading', cellType: 'loading', width: 120 },
];

describe('loading cellType renderer', () => {
  it('renders a skeleton element with non-zero height when value is true', () => {
    const data: Row[] = [{ id: 1, isLoading: true }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const skeletons = host.querySelectorAll('.bg-cell-loading-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);

    // Verify the skeleton has an inline height style (non-zero)
    const skeleton = skeletons[0] as HTMLElement;
    expect(skeleton.style.height).toBe('14px');

    grid.unmount();
  });

  it('renders nothing when value is false', () => {
    const data: Row[] = [{ id: 1, isLoading: false }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const skeletons = host.querySelectorAll('.bg-cell-loading-skeleton');
    expect(skeletons.length).toBe(0);

    grid.unmount();
  });

  it('renders nothing when value is null', () => {
    const data: Row[] = [{ id: 1, isLoading: null }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const skeletons = host.querySelectorAll('.bg-cell-loading-skeleton');
    expect(skeletons.length).toBe(0);

    grid.unmount();
  });

  it('renders skeleton only for rows where value is true in a mixed dataset', () => {
    const data: Row[] = [
      { id: 1, isLoading: true },
      { id: 2, isLoading: false },
      { id: 3, isLoading: true },
      { id: 4, isLoading: null },
    ];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    // Rows 1 and 3 have isLoading: true → expect 2 skeletons
    const skeletons = host.querySelectorAll('.bg-cell-loading-skeleton');
    expect(skeletons.length).toBe(2);

    grid.unmount();
  });
});
