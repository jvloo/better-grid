import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';

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

describe('editor skips complex-value cellTypes by default', () => {
  test('miniChart cell does not open editor on dblclick (no [object Object] in editor)', () => {
    const host = makeHost();
    const grid = createGrid<{ id: number; data: { values: number[] } }>({
      columns: [{ field: 'data' as never, headerName: 'Chart', cellType: 'miniChart' }],
      data: [{ id: 1, data: { values: [1, 2, 3, 4, 5] } }],
      plugins: [editing({ editTrigger: 'dblclick' })],
    });
    grid.mount(host);
    grid.refresh();
    const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
    expect(host.querySelector('.bg-cell-editor')).toBeNull();
    expect(host.querySelector('.bg-cell--editing')).toBeNull();
    grid.unmount();
  });

  test('sparkline cell skipped', () => {
    const host = makeHost();
    const grid = createGrid<{ x: number[] }>({
      columns: [{ field: 'x' as never, headerName: 'Spark', cellType: 'sparkline' }],
      data: [{ x: [1, 2, 3] }],
      plugins: [editing({ editTrigger: 'dblclick' })],
    });
    grid.mount(host);
    grid.refresh();
    const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
    expect(host.querySelector('.bg-cell-editor')).toBeNull();
    grid.unmount();
  });

  test('explicit editable:true overrides the skip (user opt-in)', () => {
    const host = makeHost();
    const grid = createGrid<{ data: { values: number[] } }>({
      columns: [{ field: 'data' as never, headerName: 'Chart', cellType: 'miniChart', editable: true }],
      data: [{ data: { values: [1, 2, 3] } }],
      plugins: [editing({ editTrigger: 'dblclick' })],
    });
    grid.mount(host);
    grid.refresh();
    const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
    // User opted in — editor opens (even though it'll show "[object Object]")
    const editor = host.querySelector('.bg-cell-editor, .bg-cell--editing');
    expect(editor).not.toBeNull();
    grid.unmount();
  });

  test('non-complex cellType (text) still opens editor as expected', () => {
    const host = makeHost();
    const grid = createGrid<{ name: string }>({
      columns: [{ field: 'name' as never, headerName: 'Name', cellType: 'text' }],
      data: [{ name: 'Alice' }],
      plugins: [editing({ editTrigger: 'dblclick' })],
    });
    grid.mount(host);
    grid.refresh();
    const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
    const editor = host.querySelector('.bg-cell-editor, .bg-cell--editing');
    expect(editor).not.toBeNull();
    grid.unmount();
  });
});
