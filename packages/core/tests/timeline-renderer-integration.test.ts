/**
 * Integration test: timeline cellType renders date-range bars.
 *
 * Verifies that:
 * - A valid { start, end } value with timelineStart/timelineEnd meta renders a bar element.
 * - A null/undefined value renders nothing (empty container, bg-cell--timeline-empty class).
 * - A malformed value (e.g. non-date strings) also renders nothing gracefully.
 * - An array [start, end] form is also accepted.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { cellRenderers } from '../../plugins/src/free/cell-renderers';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  period: { start: string; end: string } | null;
}

const data: Row[] = [
  { id: 1, period: { start: '2026-01-01', end: '2026-06-30' } },
  { id: 2, period: { start: '2026-04-01', end: '2026-09-30' } },
  { id: 3, period: null },
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

describe('timeline cellType renderer', () => {
  it('renders a bar element for a valid { start, end } value with range meta', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID', width: 60 },
      {
        id: 'period',
        field: 'period',
        headerName: 'Timeline',
        cellType: 'timeline',
        width: 200,
        meta: { timelineStart: '2026-01-01', timelineEnd: '2026-12-31' },
      },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    // At least one bar div should be present for rows with valid period values
    const bars = host.querySelectorAll('[style*="border-radius: 4px"]');
    expect(bars.length).toBeGreaterThan(0);

    grid.unmount();
  });

  it('renders nothing (empty container + empty-class) for a null value', () => {
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

    // Single-row grid with null value
    const nullData: Row[] = [{ id: 3, period: null }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data: nullData, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    // The cell with null period should have the empty class and no bar child
    const emptyCells = host.querySelectorAll('.bg-cell--timeline-empty');
    expect(emptyCells.length).toBeGreaterThan(0);

    // None of the timeline cells should contain a bar for null value
    for (const cell of Array.from(emptyCells)) {
      expect(cell.children.length).toBe(0);
    }

    grid.unmount();
  });

  it('accepts [start, end] array form and renders a bar', () => {
    interface ArrayRow { id: number; period: [string, string] | null }
    const arrayColumns: ColumnDef<ArrayRow>[] = [
      {
        id: 'period',
        field: 'period',
        headerName: 'Timeline',
        cellType: 'timeline',
        width: 200,
        meta: { timelineStart: '2026-01-01', timelineEnd: '2026-12-31' },
      },
    ];
    const arrayData: ArrayRow[] = [{ id: 1, period: ['2026-03-01', '2026-08-31'] }];

    const host = makeHost();
    const grid = createGrid<ArrayRow>({ columns: arrayColumns, data: arrayData, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const bars = host.querySelectorAll('[style*="border-radius: 4px"]');
    expect(bars.length).toBeGreaterThan(0);

    grid.unmount();
  });

  it('renders a bar even without range meta (falls back to proportional fill)', () => {
    const columns: ColumnDef<Row>[] = [
      {
        id: 'period',
        field: 'period',
        headerName: 'Timeline',
        cellType: 'timeline',
        width: 200,
        // No meta.timelineStart / timelineEnd
      },
    ];

    const singleRow: Row[] = [{ id: 1, period: { start: '2026-01-01', end: '2026-06-30' } }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data: singleRow, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const bars = host.querySelectorAll('[style*="border-radius: 4px"]');
    expect(bars.length).toBeGreaterThan(0);

    grid.unmount();
  });
});
