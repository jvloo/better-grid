/**
 * Regression: timeline cellType must NOT mutate the cell's box geometry.
 *
 * The pipeline sets the cell to `position: absolute`, sized in pixels to the
 * column width / row height. The previous timeline renderer overrode all three
 * with `position: relative; width: 100%; height: 100%`, sizing the cell to the
 * cells container (whole scroll area). Bars then rendered at the wrong x-offset
 * and stacked off-screen vertically — the entire timeline column appeared
 * empty in the demo even though the bar elements were present in the DOM.
 *
 * This test asserts the cell still has its pixel width/height and stays
 * `position: absolute` after a timeline render.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { cellRenderers } from '../../plugins/src/free/cell-renderers';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  period: { start: string; end: string };
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

describe('timeline cellType cell geometry', () => {
  it('does not mutate cell width/height/position (cell stays pixel-sized + absolute)', () => {
    const columns: ColumnDef<Row>[] = [
      {
        id: 'period',
        field: 'period',
        headerName: 'Timeline',
        cellType: 'timeline',
        width: 160,
        meta: { timelineStart: '2026-01-01', timelineEnd: '2026-12-31' },
      },
    ];
    const data: Row[] = [{ id: 1, period: { start: '2026-01-01', end: '2026-06-30' } }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const cell = host.querySelector('[role="gridcell"][data-col="0"]') as HTMLElement | null;
    expect(cell).not.toBeNull();
    expect(cell!.style.position).toBe('absolute');
    // Width should still be the column's px width (set by the pipeline), not "100%"
    expect(cell!.style.width).toBe('160px');
    expect(cell!.style.width).not.toBe('100%');
    expect(cell!.style.height).not.toBe('100%');

    grid.unmount();
  });

  it('bar element is positioned inside the cell (left + width are %, never wider than the cell)', () => {
    const columns: ColumnDef<Row>[] = [
      {
        id: 'period',
        field: 'period',
        headerName: 'Timeline',
        cellType: 'timeline',
        width: 200,
        meta: { timelineStart: '2026-01-01', timelineEnd: '2026-12-31' },
      },
    ];
    const data: Row[] = [{ id: 1, period: { start: '2026-03-01', end: '2026-09-30' } }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const bar = host.querySelector('[role="gridcell"][data-col="0"] > div') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar!.style.position).toBe('absolute');
    // Bar uses % units so it scales to the (correctly-sized) cell
    expect(bar!.style.left).toMatch(/%$/);
    expect(bar!.style.width).toMatch(/%$/);

    grid.unmount();
  });
});
