/**
 * Regression test: bool and badge cell dropdowns must not flash-and-close.
 *
 * Root cause: createDropdown() appends a hidden input trigger *inside* the cell
 * element. A selection-change render (scheduled by handlePointerDown immediately
 * after cell:click) ran in the next rAF and re-rendered the cell, destroying the
 * input. That triggered an input blur → 100ms → commitDropdown(), closing the
 * panel before the user could interact with it.
 *
 * Fix: RenderingPipeline.renderCells() now skips content re-render for any cell
 * that carries the bg-cell--editing class, preserving the live editor DOM.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface BoolRow {
  id: number;
  active: boolean;
}

interface BadgeRow {
  id: number;
  status: string;
}

// ── rAF helpers ──────────────────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = [];
let originalRaf: typeof requestAnimationFrame;
let originalCancelRaf: typeof cancelAnimationFrame;

function flushRafs(): void {
  // Drain the entire rAF queue (including newly enqueued callbacks).
  while (rafQueue.length > 0) {
    const batch = rafQueue.splice(0);
    for (const cb of batch) cb(0);
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  rafQueue = [];
  originalRaf = globalThis.requestAnimationFrame;
  originalCancelRaf = globalThis.cancelAnimationFrame;
  let rafId = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return ++rafId;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => {
    // Simple no-op: tests don't rely on cancellation correctness here.
    void id;
  }) as typeof cancelAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
  document.body.innerHTML = '';
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── bool cell ─────────────────────────────────────────────────────────────────

describe('bool cell dropdown stays open after click', () => {
  it('dropdown panel remains in DOM 200ms after startEdit', async () => {
    const columns: ColumnDef<BoolRow>[] = [
      { id: 'id', field: 'id', headerName: 'ID' },
      { id: 'active', field: 'active', headerName: 'Active', editable: true },
    ];
    const data: BoolRow[] = [{ id: 1, active: true }];

    const host = makeHost();
    const grid = createGrid<BoolRow>({
      columns,
      data,
      plugins: [editing({ editTrigger: 'click' })],
    });
    grid.mount(host);

    // Initial render
    flushRafs();

    // Open dropdown via the API (mirrors what cell:click → startEdit does)
    grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 1 });

    // Simulate a concurrent selection-change render (the exact scenario that caused
    // the flash-close: handlePointerDown schedules a render in the same tick as
    // cell:click schedules startEdit).
    flushRafs();

    // The panel is appended to document.body by createDropdown.
    expect(document.querySelector('.bg-dropdown-panel')).not.toBeNull();

    // After 200ms the blur-based timeout (100ms) would have fired if the input
    // was destroyed by the re-render. Assert the panel is still present.
    await wait(200);
    flushRafs();

    expect(
      document.querySelector('.bg-dropdown-panel'),
      'bool dropdown must still be in DOM after 200ms',
    ).not.toBeNull();

    grid.unmount();
  });
});

// ── badge cell ────────────────────────────────────────────────────────────────

describe('badge cell dropdown stays open after click', () => {
  it('dropdown panel remains in DOM 200ms after startEdit', async () => {
    const columns: ColumnDef<BadgeRow>[] = [
      { id: 'id', field: 'id', headerName: 'ID' },
      {
        id: 'status',
        field: 'status',
        headerName: 'Status',
        cellType: 'badge',
        editable: true,
        options: [
          { label: 'Active', value: 'active', color: '#166534', bg: '#dcfce7' },
          { label: 'Inactive', value: 'inactive', color: '#991b1b', bg: '#fee2e2' },
        ],
      },
    ];
    const data: BadgeRow[] = [{ id: 1, status: 'active' }];

    const host = makeHost();
    const grid = createGrid<BadgeRow>({
      columns,
      data,
      plugins: [editing({ editTrigger: 'click' })],
    });
    grid.mount(host);

    flushRafs();

    grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 1 });

    // Flush concurrent render (selection change from the originating click)
    flushRafs();

    expect(document.querySelector('.bg-dropdown-panel')).not.toBeNull();

    await wait(200);
    flushRafs();

    expect(
      document.querySelector('.bg-dropdown-panel'),
      'badge dropdown must still be in DOM after 200ms',
    ).not.toBeNull();

    grid.unmount();
  });
});
