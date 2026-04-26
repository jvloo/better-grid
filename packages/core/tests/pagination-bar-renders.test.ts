/**
 * Regression test: pagination plugin renders its bar after the grid mounts
 * AND survives the post-mount setData() that React's useGrid effect performs.
 *
 * Pre-fix bug: the pagination plugin's init() ran during createGrid() — before
 * any container existed — so getContainer() returned null and the bar was
 * never appended. /demo/hr-directory ended up with no pagination controls
 * even though `pagination: { pageSize: 15 }` was in the features.
 *
 * The fix subscribes to the grid's 'mount' event so the bar is created
 * after the container is attached, and to 'data:set' so a post-mount setData
 * (the React adapter calls grid.setData(options.data) in a useEffect after
 * mount) re-captures the full dataset instead of leaving the slice in place.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { pagination } from '../../plugins/src/free/pagination';
import type { ColumnDef } from '../src/types';

interface Row { id: number; name: string; }

const ROWS_TOTAL = 60;
const data: Row[] = Array.from({ length: ROWS_TOTAL }, (_, i) => ({
  id: i + 1,
  name: `Row ${i + 1}`,
}));

const columns: ColumnDef<Row>[] = [
  { id: 'id', field: 'id', headerName: '#' },
  { id: 'name', field: 'name', headerName: 'Name' },
];

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
  // The pagination bar is inserted into the host's parent, so we wrap the host
  // in an outer div (mirroring the React adapter where the grid container has
  // a parent <div> we control).
  const wrapper = document.createElement('div');
  document.body.appendChild(wrapper);
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  wrapper.appendChild(host);
  return host;
}

describe('pagination — renders bar after mount', () => {
  it('appends a .bg-pagination-bar sibling once the grid mounts', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [pagination({ pageSize: 15 })],
    });

    // Pre-mount: init has run but the bar should NOT exist yet (no container).
    expect(document.querySelector('.bg-pagination-bar')).toBeNull();

    grid.mount(host);

    const bar = document.querySelector('.bg-pagination-bar');
    expect(bar).not.toBeNull();
    // Sliced to one page.
    expect(grid.getData().length).toBe(15);
    // Reports the FULL dataset, not the slice.
    expect(bar?.querySelector('.bg-pagination-info')?.textContent).toBe(`1-15 of ${ROWS_TOTAL}`);

    grid.unmount();
    expect(document.querySelector('.bg-pagination-bar')).toBeNull();
  });

  it('post-mount setData (React useEffect pattern) does NOT wipe the page slice', () => {
    // Simulates the React adapter sequence:
    //   1. createGrid() — init runs but no container yet.
    //   2. grid.mount(el) — pagination bar is created, data sliced to first page.
    //   3. useEffect → grid.setData(options.data) — must NOT undo the slice.
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [pagination({ pageSize: 15 })],
    });

    grid.mount(host);
    expect(grid.getData().length).toBe(15);

    // Same identity as createGrid options.data — what useGrid's effect does.
    grid.setData(data);

    // Bug pre-fix: setData would leave 60 rows in state because pagination had
    // no listener to re-slice.
    expect(grid.getData().length).toBe(15);
    expect(document.querySelector('.bg-pagination-info')?.textContent).toBe(`1-15 of ${ROWS_TOTAL}`);

    grid.unmount();
  });

  it('survives unmount → remount (StrictMode pattern) without duplicating bars', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [pagination({ pageSize: 15 })],
    });

    grid.mount(host);
    expect(document.querySelectorAll('.bg-pagination-bar').length).toBe(1);

    grid.unmount();
    expect(document.querySelectorAll('.bg-pagination-bar').length).toBe(0);

    grid.mount(host);
    expect(document.querySelectorAll('.bg-pagination-bar').length).toBe(1);

    grid.unmount();
  });
});
