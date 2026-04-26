/**
 * Regression test: opening the editor on cell A (dblclick) and then clicking
 * a different cell B must commit cell A AND restore cell A's formatted display
 * (currency text, right alignment) — not leave cell A with the empty/raw
 * textContent the editor wrote into it.
 *
 * Reported on /demo/finance: dblclick a currency cell, then click a different
 * cell — cell A loses its $X,XXX,XXX formatted display.
 *
 * Root cause: editing.commitEdit() schedules a render in rAF but skips the
 * render if a *new* edit has started in the same tick (handoff path:
 * outsideClick → commitEdit(A) → startEdit(B)). Cell A therefore never gets
 * re-rendered after its bg-cell--editing class is removed, so the cellType
 * renderer that paints "$2,850,000.00" never runs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { formatting } from '../../plugins/src/free/formatting';
import { editing } from '../../plugins/src/free/editing';
import { createCellSelection } from '../src/selection/model';
import type { ColumnDef } from '../src/types';

interface Row { id: number; revenue: number; expense: number }

const data: Row[] = [
  { id: 1, revenue: 2_850_000, expense: -125_000 },
  { id: 2, revenue: 1_200_000, expense: -42_000 },
];

let originalRaf: typeof requestAnimationFrame;
let originalCancelRaf: typeof cancelAnimationFrame;
let pendingRaf: FrameRequestCallback[] = [];

beforeEach(() => {
  document.body.innerHTML = '';
  pendingRaf = [];
  originalRaf = globalThis.requestAnimationFrame;
  originalCancelRaf = globalThis.cancelAnimationFrame;
  // Manual rAF queue so the test can deterministically flush deferred refreshes.
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    pendingRaf.push(cb);
    return pendingRaf.length;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
  document.body.innerHTML = '';
});

function flushRaf(): void {
  // Drain repeatedly: callbacks may schedule more callbacks (re-render chain).
  for (let safety = 0; safety < 32 && pendingRaf.length > 0; safety++) {
    const queue = pendingRaf;
    pendingRaf = [];
    for (const cb of queue) cb(performance.now());
  }
}

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

function findCell(host: HTMLElement, row: number, col: number): HTMLElement | null {
  return host.querySelector(`.bg-cell[data-row="${row}"][data-col="${col}"]`);
}

describe('currency cell after edit-handoff (regression for /demo/finance)', () => {
  it('restores formatted display on cell A when commit-then-startEdit hands off to cell B', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'revenue', field: 'revenue', cellType: 'currency' },
      { id: 'expense', field: 'expense', cellType: 'currency' },
    ];

    const host = makeHost();
    const editingPlugin = editing({ editTrigger: 'dblclick' });
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [
        formatting({ locale: 'en-US', currencyCode: 'USD', negativeColor: '#dc2626' }),
        editingPlugin,
      ],
      selection: { mode: 'range' },
    });

    grid.mount(host);
    grid.refresh();
    flushRaf();

    const editingApi = grid.plugins.editing;

    // Initial sanity check: cell A renders formatted currency.
    const cellA = findCell(host, 0, 0)!;
    expect(cellA).not.toBeNull();
    expect(cellA.textContent).toBe('$2,850,000.00');

    // Dblclick scenario simulated: select then startEdit on cell A.
    grid.setSelection(createCellSelection({ rowIndex: 0, colIndex: 0 }));
    flushRaf();
    editingApi.startEdit({ rowIndex: 0, colIndex: 0 });
    expect(editingApi.isEditing()).toBe(true);
    expect(cellA.classList.contains('bg-cell--editing')).toBe(true);

    // Now simulate the handoff path: commit cell A, then startEdit on cell B
    // in the same synchronous tick (mirrors handlePointerHandoff).
    editingApi.commitEdit();
    editingApi.startEdit({ rowIndex: 1, colIndex: 0 });
    // Critical: do NOT call setSelection / refresh between the handoff and
    // the rAF flush. In production the next-frame render comes from setSelection
    // triggered by handlePointerDown, but if onOutsideClick runs BEFORE
    // handlePointerDown (or handlePointerDown is suppressed), there's no
    // render scheduled — cleanupEdit's rAF guard then skips its own refresh,
    // leaving cell A blank.
    flushRaf();

    // Cell A must be back to its formatted display — not empty, not raw.
    const cellAAfter = findCell(host, 0, 0)!;
    expect(cellAAfter).not.toBeNull();
    expect(cellAAfter.classList.contains('bg-cell--editing')).toBe(false);
    expect(cellAAfter.textContent).toBe('$2,850,000.00');
    expect(cellAAfter.style.textAlign).toBe('right');

    // Cell B should now be editing.
    const cellB = findCell(host, 1, 0)!;
    expect(cellB.classList.contains('bg-cell--editing')).toBe(true);

    grid.unmount();
  });
});
