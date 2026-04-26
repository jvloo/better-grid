import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';
import { sorting } from '../../plugins/src/free/sorting';
import { filtering } from '../../plugins/src/free/filtering';

interface Row { id: number; name: string }

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  // Make rAF fire synchronously so render() executes before assertions
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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('setData({ preserveScroll }) — Bug B regression', () => {
  // Bug B: changing sort/filter at the Margin column on /demo/multi-header
  // resets the horizontal scrollbar to position 0 instead of retaining the
  // user's scroll position. Root cause: setData() always reset scroll to (0,0),
  // and sort/filter plugins call setData() to re-publish reordered/filtered
  // data. Fix: setData accepts { preserveScroll: true } so plugins doing an
  // in-place reorder/refinement can keep the user's scroll position.

  test('default setData (data swap) still resets scroll to (0, 0)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { id: 'a', field: 'name' as never, headerName: 'A', width: 200 },
        { id: 'b', field: 'name' as never, headerName: 'B', width: 200 },
        { id: 'c', field: 'name' as never, headerName: 'C', width: 200 },
      ],
      data: [{ id: 1, name: 'X' }],
    });
    grid.mount(host);

    // Simulate the user having scrolled — the fakeScrollbar is the source of
    // truth, so write to its scrollLeft/scrollTop directly.
    const fakeScrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    fakeScrollbar.scrollLeft = 150;
    fakeScrollbar.scrollTop = 80;

    grid.setData([{ id: 2, name: 'Y' }]);

    // Default behavior unchanged: a true data swap resets scroll to (0, 0).
    expect(fakeScrollbar.scrollLeft).toBe(0);
    expect(fakeScrollbar.scrollTop).toBe(0);

    grid.unmount();
  });

  test('setData(data, { preserveScroll: true }) keeps scrollLeft/scrollTop', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { id: 'a', field: 'name' as never, headerName: 'A', width: 200 },
        { id: 'b', field: 'name' as never, headerName: 'B', width: 200 },
        { id: 'c', field: 'name' as never, headerName: 'C', width: 200 },
      ],
      data: [{ id: 1, name: 'X' }, { id: 2, name: 'Y' }],
    });
    grid.mount(host);

    const fakeScrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    fakeScrollbar.scrollLeft = 150;
    fakeScrollbar.scrollTop = 80;

    // In-place reorder (the sort/filter plugin path) — same logical dataset.
    grid.setData([{ id: 2, name: 'Y' }, { id: 1, name: 'X' }], { preserveScroll: true });

    // Scroll position survives — no jump back to 0.
    expect(fakeScrollbar.scrollLeft).toBe(150);
    expect(fakeScrollbar.scrollTop).toBe(80);

    grid.unmount();
  });

  test('sorting plugin: toggleSort keeps scrollLeft (Bug B)', () => {
    const host = makeHost();
    const grid = createGrid<Row, readonly [ReturnType<typeof sorting>]>({
      columns: [
        { id: 'name', field: 'name' as never, headerName: 'Name', width: 200, sortable: true },
        { id: 'extra1', field: 'name' as never, headerName: 'X1', width: 200 },
        { id: 'extra2', field: 'name' as never, headerName: 'X2', width: 200 },
      ],
      data: [
        { id: 1, name: 'Charlie' },
        { id: 2, name: 'Alpha' },
        { id: 3, name: 'Bravo' },
      ],
      plugins: [sorting()] as const,
    });
    grid.mount(host);

    const fakeScrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    fakeScrollbar.scrollLeft = 120;

    grid.plugins.sorting.toggleSort('name');

    // After sort, the user's horizontal scroll position survives.
    expect(fakeScrollbar.scrollLeft).toBe(120);

    grid.unmount();
  });

  test('filtering plugin: setFilter keeps scrollLeft (Bug B)', () => {
    const host = makeHost();
    const grid = createGrid<Row, readonly [ReturnType<typeof filtering>]>({
      columns: [
        { id: 'name', field: 'name' as never, headerName: 'Name', width: 200 },
        { id: 'extra1', field: 'name' as never, headerName: 'X1', width: 200 },
        { id: 'extra2', field: 'name' as never, headerName: 'X2', width: 200 },
      ],
      data: [
        { id: 1, name: 'Charlie' },
        { id: 2, name: 'Alpha' },
        { id: 3, name: 'Bravo' },
      ],
      plugins: [filtering()] as const,
    });
    grid.mount(host);

    const fakeScrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    fakeScrollbar.scrollLeft = 90;

    grid.plugins.filtering.setFilter('name', 'a', 'contains');

    // After filter, the user's horizontal scroll position survives.
    expect(fakeScrollbar.scrollLeft).toBe(90);

    grid.unmount();
  });

  test('store scroll state matches DOM scrollbar after preserveScroll setData', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        { id: 'a', field: 'name' as never, headerName: 'A', width: 200 },
        { id: 'b', field: 'name' as never, headerName: 'B', width: 200 },
      ],
      data: [{ id: 1, name: 'X' }],
    });
    grid.mount(host);

    const fakeScrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    fakeScrollbar.scrollLeft = 75;

    const beforeStore = grid.getState().scrollLeft;
    grid.setData([{ id: 1, name: 'X' }], { preserveScroll: true });

    // Internal scroll state isn't clobbered to 0 either.
    expect(grid.getState().scrollLeft).toBe(beforeStore);

    grid.unmount();
  });
});
