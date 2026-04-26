import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';
import type { CellRenderContext, ColumnDef } from '../src/types';

interface Row { id: number; label: string; amount: number }

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

describe('CellRenderContext.isPinned', () => {
  test('is true for cells in pinned top/bottom rows and false for body cells', () => {
    const host = makeHost();
    const seen: { row: number; col: number; isPinned: boolean | undefined }[] = [];

    const labelCol: ColumnDef<Row> = {
      id: 'label',
      field: 'label' as never,
      headerName: 'Label',
      cellRenderer: (container, ctx: CellRenderContext<Row>) => {
        seen.push({ row: ctx.rowIndex, col: ctx.colIndex, isPinned: ctx.isPinned });
        container.textContent = String(ctx.value ?? '');
      },
    };

    const grid = createGrid<Row>({
      columns: [labelCol],
      data: [
        { id: 1, label: 'body-1', amount: 10 },
        { id: 2, label: 'body-2', amount: 20 },
      ],
      pinned: {
        top: [{ id: -1, label: 'TOP', amount: 0 }],
        bottom: [{ id: -2, label: 'TOTAL', amount: 30 }],
      },
    });
    grid.mount(host);
    grid.refresh();

    const bodyCalls = seen.filter((s) => s.isPinned !== true);
    const pinnedCalls = seen.filter((s) => s.isPinned === true);

    // Two body rows, one cell each
    expect(bodyCalls.length).toBeGreaterThanOrEqual(2);
    for (const c of bodyCalls) {
      expect(c.isPinned).toBe(undefined);
    }

    // Two pinned rows (1 top + 1 bottom), one cell each → at least 2 pinned calls
    expect(pinnedCalls.length).toBeGreaterThanOrEqual(2);
    for (const c of pinnedCalls) {
      expect(c.isPinned).toBe(true);
    }

    grid.unmount();
  });

  test('cellRenderer can branch on isPinned to render totals-row UI differently', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: [
        {
          id: 'amount',
          field: 'amount' as never,
          headerName: 'Amount',
          cellRenderer: (container, ctx: CellRenderContext<Row>) => {
            container.className = ctx.isPinned ? 'totals-cell' : 'body-cell';
            container.textContent = String(ctx.value ?? '');
          },
        },
      ],
      data: [{ id: 1, label: 'a', amount: 10 }],
      pinned: { bottom: [{ id: -1, label: 'TOTAL', amount: 10 }] },
    });
    grid.mount(host);
    grid.refresh();

    expect(host.querySelector('.totals-cell')).not.toBeNull();
    expect(host.querySelector('.body-cell')).not.toBeNull();

    grid.unmount();
  });
});
