import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  value: string;
}

let originalRaf: typeof requestAnimationFrame;
let originalCancelRaf: typeof cancelAnimationFrame;
let rafQueue: FrameRequestCallback[] = [];
let rafCalls = 0;

beforeEach(() => {
  document.body.innerHTML = '';
  rafQueue = [];
  rafCalls = 0;
  originalRaf = globalThis.requestAnimationFrame;
  originalCancelRaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    rafCalls++;
    rafQueue.push(cb);
    return rafCalls;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => {
    rafQueue[id - 1] = () => undefined;
  }) as typeof cancelAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
  document.body.innerHTML = '';
});

function flushAnimationFrames(): void {
  const queue = rafQueue;
  rafQueue = [];
  for (const cb of queue) cb(0);
}

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 240 });
  document.body.appendChild(host);
  return host;
}

function setClientSize(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
}

describe('wheel scroll coalescing', () => {
  it('applies burst wheel deltas once per animation frame', () => {
    const host = makeHost();
    const columns: ColumnDef<Row>[] = [
      { id: 'id', field: 'id', headerName: 'ID', width: 80 },
      { id: 'value', field: 'value', headerName: 'Value', width: 160 },
    ];
    const data = Array.from({ length: 100 }, (_, id) => ({ id, value: `Row ${id}` }));
    const grid = createGrid<Row>({
      columns,
      data,
      rowHeight: 40,
      headerHeight: 40,
    });

    grid.mount(host);

    const viewport = host.querySelector('.bg-grid__viewport') as HTMLElement;
    const scrollbar = host.querySelector('.bg-grid__scroll') as HTMLElement;
    setClientSize(viewport, 400, 240);
    setClientSize(scrollbar, 400, 240);
    flushAnimationFrames();
    grid.refresh();
    flushAnimationFrames();

    rafCalls = 0;
    host.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
    host.dispatchEvent(new WheelEvent('wheel', { deltaY: 20, bubbles: true, cancelable: true }));
    host.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true }));

    expect(scrollbar.scrollTop).toBe(0);
    expect(rafCalls).toBe(1);

    flushAnimationFrames();

    expect(scrollbar.scrollTop).toBe(60);

    grid.unmount();
  });
});
