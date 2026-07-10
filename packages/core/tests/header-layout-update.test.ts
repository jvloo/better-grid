import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createGrid } from '../src/grid';
import type { HeaderRow } from '../src/types';

interface Row {
  a: string;
  b: string;
  c?: string;
}

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

describe('runtime header layout updates', () => {
  test('updates native multi-row headers and all dependent vertical geometry', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
    document.body.appendChild(host);

    const initialHeaders: HeaderRow[] = [
      {
        id: 'initial',
        height: 32,
        cells: [
          { id: 'a', columnId: 'a', content: 'A' },
          { id: 'b', columnId: 'b', content: 'B' },
        ],
      },
    ];
    const grid = createGrid<Row>({
      data: [{ a: 'a', b: 'b' }],
      columns: [
        { id: 'a', field: 'a', headerName: 'A', width: 100 },
        { id: 'b', field: 'b', headerName: 'B', width: 100 },
      ],
      headers: initialHeaders,
      headerHeight: 32,
      frozen: { left: 1 },
    });
    grid.mount(host);
    grid.refresh();

    expect(host.querySelector<HTMLElement>('.bg-grid__headers')?.style.height).toBe('32px');

    const nextHeaders: HeaderRow[] = [
      {
        id: 'groups',
        height: 44,
        cells: [
          { id: 'a', columnId: 'a', content: 'A', rowSpan: 2 },
          { id: 'group', content: 'Group', colSpan: 2 },
        ],
      },
      {
        id: 'leaves',
        height: 44,
        cells: [
          { id: 'b', columnId: 'b', content: 'B' },
          { id: 'c', columnId: 'c', content: 'C' },
        ],
      },
    ];
    grid.setColumns([
      { id: 'a', field: 'a', headerName: 'A', width: 100 },
      { id: 'b', field: 'b', headerName: 'B', width: 100 },
      { id: 'c', field: 'c', headerName: 'C', width: 100 },
    ]);
    grid.setHeaderLayout(nextHeaders, 44);
    grid.refresh();

    expect(grid.getHeaderLayout()).toBe(nextHeaders);
    expect(host.querySelector<HTMLElement>('.bg-grid__headers')?.style.height).toBe('88px');
    expect(host.querySelector<HTMLElement>('.bg-grid__frozen-headers')?.style.height).toBe('88px');
    expect(host.querySelector<HTMLElement>('.bg-grid__cells')?.style.top).toBe('88px');
    expect(host.querySelector<HTMLElement>('.bg-grid__frozen-cells')?.style.top).toBe('88px');
    expect(host.textContent).toContain('Group');
    expect(host.textContent).toContain('C');

    grid.destroy();
  });
});
