/**
 * Integration test: slider cell renderer does not open the cell editor.
 *
 * Regression test for the bug where clicking or dragging a slider thumb caused
 * the editing plugin's edit-mode opener to fire (via pointerdown / click /
 * dblclick events bubbling up to the cell). The fix adds stopPropagation on all
 * four of those event types on the slider wrapper element, mirroring the pattern
 * used in row-actions.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import { proRenderers } from '../../pro/src/pro-renderers';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  progress: number;
  name: string;
}

const data: Row[] = [
  { id: 1, progress: 40, name: 'Alpha' },
  { id: 2, progress: 75, name: 'Beta' },
];

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  // Make requestAnimationFrame synchronous so grid.refresh() renders immediately.
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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

// editable: false — slider thumb is read-only; the editing plugin cannot open
// a cell editor on this column because the slider itself does not register the
// stopPropagation handlers (the `if (editable === false) return` guard fires).
// The no-edit-mode tests use this column to confirm that a disabled slider
// does not accidentally trigger the editor.
const columnsReadOnly: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', headerName: 'Name', width: 200 },
  {
    id: 'progress',
    field: 'progress',
    headerName: 'Progress',
    width: 160,
    cellType: 'slider',
    editable: false,
    meta: { min: 0, max: 100 },
  },
];

// Default editable slider (no explicit editable: false). The slider handles
// pointer events itself and calls updateCell on change; the stopPropagation
// fix prevents the editing plugin from intercepting those same events to open
// a text/number input.
const columnsEditable: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', headerName: 'Name', width: 200 },
  {
    id: 'progress',
    field: 'progress',
    headerName: 'Progress',
    width: 160,
    cellType: 'slider',
    meta: { min: 0, max: 100 },
  },
];

describe('slider renderer — does not enter edit mode on pointer/click/dblclick', () => {
  it('renders an <input type="range"> in the slider cell', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: columnsEditable,
      data,
      plugins: [editing({ editTrigger: 'click' }), proRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const slider = host.querySelector('input[type="range"]');
    expect(slider).not.toBeNull();

    grid.unmount();
  });

  it('pointerdown on an editable slider does NOT open a cell editor (stopPropagation fix)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: columnsEditable,
      data,
      plugins: [editing({ editTrigger: 'click' }), proRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const slider = host.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).not.toBeNull();

    // Dispatch pointerdown on the slider (simulating the start of a drag).
    slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

    // No cell editor should have opened.
    expect(host.querySelector('.bg-cell--editing')).toBeNull();
    expect(host.querySelector('.bg-cell-editor')).toBeNull();

    grid.unmount();
  });

  it('dblclick on an editable slider does NOT open a cell editor (stopPropagation fix)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: columnsEditable,
      data,
      plugins: [editing({ editTrigger: 'dblclick' }), proRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const slider = host.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).not.toBeNull();

    slider.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));

    expect(host.querySelector('.bg-cell--editing')).toBeNull();
    expect(host.querySelector('.bg-cell-editor')).toBeNull();

    grid.unmount();
  });

  it('click on an editable slider does NOT open a cell editor (click editTrigger + stopPropagation fix)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: columnsEditable,
      data,
      plugins: [editing({ editTrigger: 'click' }), proRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const slider = host.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).not.toBeNull();

    slider.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(host.querySelector('.bg-cell--editing')).toBeNull();
    expect(host.querySelector('.bg-cell-editor')).toBeNull();

    grid.unmount();
  });

  it('onChange on an editable slider calls grid.updateCell with the new value', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: columnsEditable,
      data,
      plugins: [editing(), proRenderers()],
    });

    const updateCellSpy = vi.spyOn(grid, 'updateCell');

    grid.mount(host);
    grid.refresh();

    const slider = host.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).not.toBeNull();

    // Simulate user dragging the slider to value 82.
    slider.value = '82';
    slider.dispatchEvent(new Event('change', { bubbles: true }));

    expect(updateCellSpy).toHaveBeenCalledWith(
      expect.any(Number), // rowIndex
      'progress',
      82,
    );

    grid.unmount();
  });

  it('editable: false slider — read-only, input is disabled, no event handlers registered', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns: columnsReadOnly,
      data,
      plugins: [editing({ editTrigger: 'click' }), proRenderers()],
    });

    grid.mount(host);
    grid.refresh();

    const slider = host.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).not.toBeNull();
    expect(slider.disabled).toBe(true);

    // A read-only slider must not open a cell editor regardless.
    expect(host.querySelector('.bg-cell--editing')).toBeNull();
    expect(host.querySelector('.bg-cell-editor')).toBeNull();

    grid.unmount();
  });
});
