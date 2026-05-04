import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';

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

describe('frozen.clip.initialVisible', () => {
  it('starts the frozen overlay clipped to the requested visible column count', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', headerName: 'A', width: 100 },
        { id: 'b', headerName: 'B', width: 100 },
        { id: 'c', headerName: 'C', width: 100 },
        { id: 'd', headerName: 'D', width: 100 },
      ],
      data: [{ a: 1, b: 2, c: 3, d: 4 }],
      frozen: { left: 3, clip: { minVisible: 1, initialVisible: 2 } },
    });

    grid.mount(host);

    expect(grid.getFreezeClipWidth()).toBe(200);

    grid.unmount();
  });

  it('clamps initialVisible to minVisible', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', headerName: 'A', width: 100 },
        { id: 'b', headerName: 'B', width: 100 },
        { id: 'c', headerName: 'C', width: 100 },
      ],
      data: [{ a: 1, b: 2, c: 3 }],
      frozen: { left: 3, clip: { minVisible: 2, initialVisible: 1 } },
    });

    grid.mount(host);

    expect(grid.getFreezeClipWidth()).toBe(200);

    grid.unmount();
  });
});
