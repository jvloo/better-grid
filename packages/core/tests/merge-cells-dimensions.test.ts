/**
 * Regression test: merged cells size to the exact sum of spanned cell
 * dimensions, with no per-row/per-col +1 overshoot.
 *
 * The previous implementation added +1 px per spanned cell to "account for
 * borders". Cells use box-sizing:border-box and stack at exact pixel
 * boundaries (no inter-cell gap), so the +1 caused the merged cell — and its
 * own bottom/right border in `.bg-grid--bordered` mode — to overshoot into
 * the next row/column, painting a misaligned border line just outside the
 * intended merged region.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { mergeCells } from '../../pro/src/merge-cells';
import type { ColumnDef } from '../src/types';

interface Row {
  a: string;
  b: string;
  c: string;
}

const data: Row[] = [
  { a: 'A', b: 'B', c: 'C' },
  { a: 'A', b: 'B', c: 'C' },
  { a: 'A', b: 'B', c: 'C' },
  { a: 'X', b: 'Y', c: 'Z' },
];

const columns: ColumnDef<Row>[] = [
  { id: 'a', field: 'a', headerName: 'A', width: 100 },
  { id: 'b', field: 'b', headerName: 'B', width: 120 },
  { id: 'c', field: 'c', headerName: 'C', width: 140 },
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
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('mergeCells — dimensions match the plain sum of spanned cells', () => {
  it('rowSpan: merged height equals sum of spanned row heights (no +1 per row overshoot)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      rowHeight: 30,
      plugins: [mergeCells({ cells: [{ row: 0, col: 0, rowSpan: 3 }] })],
    });
    grid.mount(host);
    grid.refresh();

    const merged = host.querySelector<HTMLElement>('.bg-cell--merged[data-row="0"][data-col="0"]');
    expect(merged).not.toBeNull();
    // 3 rows × 30 px = 90 px exactly. Old buggy code would yield 30+1+30+1+30 = 92.
    expect(parseFloat(merged!.style.height)).toBe(90);
    grid.unmount();
  });

  it('colSpan: merged width equals sum of spanned column widths (no +1 per col overshoot)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      rowHeight: 30,
      plugins: [mergeCells({ cells: [{ row: 0, col: 0, colSpan: 3 }] })],
    });
    grid.mount(host);
    grid.refresh();

    const merged = host.querySelector<HTMLElement>('.bg-cell--merged[data-row="0"][data-col="0"]');
    expect(merged).not.toBeNull();
    // 100 + 120 + 140 = 360 exactly. Old buggy code would yield 100+1+120+1+140 = 362.
    expect(parseFloat(merged!.style.width)).toBe(360);
    grid.unmount();
  });

  it('rowSpan + colSpan combined sum exactly', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      rowHeight: 30,
      plugins: [mergeCells({ cells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }] })],
    });
    grid.mount(host);
    grid.refresh();

    const merged = host.querySelector<HTMLElement>('.bg-cell--merged[data-row="0"][data-col="0"]');
    expect(merged).not.toBeNull();
    expect(parseFloat(merged!.style.width)).toBe(220);  // 100 + 120
    expect(parseFloat(merged!.style.height)).toBe(60);  // 30 + 30
    grid.unmount();
  });
});
