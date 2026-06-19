import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { CellRenderContext, ColumnDef } from '../src/types';

type Row = Record<string, number>;

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 500 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 300 });
  document.body.appendChild(host);
  return host;
}

function setClientSize(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
}

describe('pinned rows on scroll', () => {
  it('keeps pinned rows cached across vertical scroll when frozen pinned rows also exist', () => {
    const host = makeHost();
    let pinnedRenderCalls = 0;

    const columns: ColumnDef<Row>[] = Array.from({ length: 20 }, (_, index) => ({
      id: `c${index}`,
      field: `c${index}`,
      headerName: `C${index}`,
      width: 100,
      cellRenderer: (container: HTMLElement, ctx: CellRenderContext<Row>) => {
        if (ctx.isPinned) pinnedRenderCalls++;
        container.textContent = String(ctx.value ?? '');
      },
    }));
    const data = Array.from({ length: 100 }, (_, row) =>
      Object.fromEntries(columns.map((column, col) => [column.id!, row * 100 + col])),
    ) as Row[];
    const total = Object.fromEntries(columns.map((column, col) => [column.id!, col])) as Row;

    const grid = createGrid<Row>({
      columns,
      data,
      frozen: { left: 2 },
      pinned: { bottom: [total] },
      virtualization: { overscanRows: 1, overscanColumns: 1 },
      rowHeight: 40,
      headerHeight: 40,
    });

    grid.mount(host);

    const viewport = host.querySelector('.bg-grid__viewport') as HTMLElement;
    const scrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    setClientSize(viewport, 500, 300);
    setClientSize(scrollbar, 500, 300);
    grid.refresh();

    const mainPinnedCells = host.querySelectorAll('.bg-grid__pinned-bottom .bg-cell');
    expect(mainPinnedCells.length).toBeGreaterThan(0);
    expect(mainPinnedCells.length).toBeLessThan(columns.length - 2);

    pinnedRenderCalls = 0;
    scrollbar.scrollTop = 120;
    scrollbar.dispatchEvent(new Event('scroll'));

    expect(pinnedRenderCalls).toBe(0);

    grid.unmount();
  });

});
