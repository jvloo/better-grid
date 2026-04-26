/**
 * Regression test: dropdown panel stays open after the click that opened it.
 *
 * The race: the same mousedown/click that opens the dropdown could be captured
 * by the closeOnOutside document listener if it was attached synchronously.
 * The listener must be deferred via setTimeout(0) AND must include a defensive
 * guard so that clicks inside the editing cell or its trigger don't close the
 * panel prematurely.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';

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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('dropdown stays open after click-to-open', () => {
  test('select cell click opens dropdown that stays open across the same tick', async () => {
    const host = makeHost();
    const grid = createGrid<{ x: string }>({
      columns: [{ field: 'x' as never, headerName: 'X', cellEditor: 'select', options: ['A', 'B', 'C'] }],
      data: [{ x: 'A' }],
      plugins: [editing({ editTrigger: 'click' })],
    });
    grid.mount(host);
    grid.refresh();

    const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
    // Dispatch pointerdown to trigger handlePointerDown → cell:click → rAF → startEdit
    cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

    // Wait for setTimeout(0) deferred close-on-outside handler and any pending timers
    await new Promise((r) => setTimeout(r, 50));

    // Dropdown panel should still be open (not closed by the outside-click race)
    const panel = document.querySelector('[role="listbox"]');
    expect(panel).not.toBeNull();

    grid.unmount();
  });

  test('mousedown outside the panel closes it but mousedown inside does not', async () => {
    const host = makeHost();
    const grid = createGrid<{ x: string }>({
      columns: [{ field: 'x' as never, headerName: 'X', cellEditor: 'select', options: ['A', 'B', 'C'] }],
      data: [{ x: 'A' }],
      plugins: [editing()],
    });
    grid.mount(host);
    grid.refresh();

    // Open the dropdown via the editing API directly
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 0 });

    const panelBefore = document.querySelector('[role="listbox"]');
    expect(panelBefore).not.toBeNull();

    // Mousedown inside the panel should NOT close it
    panelBefore!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    grid.unmount();
  });
});
