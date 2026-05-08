import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { CellRenderContext, ColumnDef } from '../src/types';

interface Row {
  id: number;
  value: string;
}

let originalRaf: typeof requestAnimationFrame;
let rafCalls = 0;

beforeEach(() => {
  document.body.innerHTML = '';
  rafCalls = 0;
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    rafCalls++;
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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 250 });
  document.body.appendChild(host);
  return host;
}

function setClientSize(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
}

describe('scroll render throttling', () => {
  it('does not re-run cell renderers while scroll stays inside the rendered virtual range', () => {
    const host = makeHost();
    let renderCalls = 0;

    const columns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID', width: 80 },
      {
        id: 'value',
        field: 'value',
        headerName: 'Value',
        width: 160,
        cellRenderer: (container: HTMLElement, ctx: CellRenderContext<Row>) => {
          renderCalls++;
          container.textContent = String(ctx.value ?? '');
        },
      },
    ];
    const data = Array.from({ length: 100 }, (_, id) => ({ id, value: `Row ${id}` }));
    const grid = createGrid<Row>({
      columns,
      data,
      virtualization: { overscanRows: 1, overscanColumns: 1 },
      rowHeight: 40,
      headerHeight: 40,
    });

    grid.mount(host);

    const viewport = host.querySelector('.bg-grid__viewport') as HTMLElement;
    const scrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    setClientSize(viewport, 400, 250);
    setClientSize(scrollbar, 400, 250);
    grid.refresh();

    renderCalls = 0;
    rafCalls = 0;
    scrollbar.scrollTop = 1;
    scrollbar.dispatchEvent(new Event('scroll'));

    expect(renderCalls).toBe(0);
    expect(rafCalls).toBe(0);

    scrollbar.scrollTop = 120;
    scrollbar.dispatchEvent(new Event('scroll'));

    expect(renderCalls).toBeGreaterThan(0);
    expect(rafCalls).toBeGreaterThan(0);

    grid.unmount();
  });

  it('only renders cells entering the virtual range on scroll-window changes', () => {
    const host = makeHost();
    let renderCalls = 0;

    const columns: ColumnDef<Row>[] = [
      {
        id: 'value',
        field: 'value',
        headerName: 'Value',
        width: 160,
        cellRenderer: (container: HTMLElement, ctx: CellRenderContext<Row>) => {
          renderCalls++;
          container.textContent = String(ctx.value ?? '');
          container.classList.add('custom-rendered-cell');
        },
      },
    ];
    const data = Array.from({ length: 100 }, (_, id) => ({ id, value: `Row ${id}` }));
    const grid = createGrid<Row>({
      columns,
      data,
      virtualization: { overscanRows: 0, overscanColumns: 0 },
      rowHeight: 40,
      headerHeight: 40,
    });

    grid.mount(host);

    const viewport = host.querySelector('.bg-grid__viewport') as HTMLElement;
    const scrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    setClientSize(viewport, 400, 250);
    setClientSize(scrollbar, 400, 250);
    grid.refresh();

    renderCalls = 0;
    scrollbar.scrollTop = 41;
    scrollbar.dispatchEvent(new Event('scroll'));

    expect(renderCalls).toBe(1);
    expect(host.querySelector('.bg-cell[data-row="1"]')?.classList.contains('custom-rendered-cell')).toBe(true);

    grid.unmount();
  });
});
