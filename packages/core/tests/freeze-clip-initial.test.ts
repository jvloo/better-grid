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

function setClientSize(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
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

  it('pans clipped frozen columns on horizontal wheel over the frozen area', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, headerName: 'A', width: 100 },
        { id: 'b', field: 'b' as never, headerName: 'B', width: 100 },
        { id: 'c', field: 'c' as never, headerName: 'C', width: 100 },
        { id: 'd', field: 'd' as never, headerName: 'D', width: 300 },
      ],
      data: [{ a: 1, b: 2, c: 3, d: 4 }],
      frozen: { left: 3, clip: { minVisible: 1, initialVisible: 1 } },
    });

    grid.mount(host);
    const viewport = host.querySelector<HTMLElement>('.bg-grid__viewport')!;
    const scrollbar = host.querySelector<HTMLElement>('.bg-grid__scroll')!;
    setClientSize(viewport, 300, 240);
    setClientSize(scrollbar, 300, 240);
    grid.refresh();

    const frozenCell = host.querySelector<HTMLElement>('.bg-grid__frozen-cells .bg-cell[data-col="0"]')!;
    const frozenCells = host.querySelector<HTMLElement>('.bg-grid__frozen-cells')!;
    frozenCell.dispatchEvent(new WheelEvent('wheel', { deltaX: 80, bubbles: true, cancelable: true }));

    expect(frozenCells.style.transform).toBe('translate3d(-80px, 0px, 0)');
    expect(scrollbar.scrollLeft).toBe(0);

    grid.unmount();
  });

  it('passes leftover frozen-area horizontal wheel delta to normal horizontal scroll', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, headerName: 'A', width: 100 },
        { id: 'b', field: 'b' as never, headerName: 'B', width: 100 },
        { id: 'c', field: 'c' as never, headerName: 'C', width: 100 },
        { id: 'd', field: 'd' as never, headerName: 'D', width: 500 },
      ],
      data: [{ a: 1, b: 2, c: 3, d: 4 }],
      frozen: { left: 3, clip: { minVisible: 1, initialVisible: 1 } },
    });

    grid.mount(host);
    const viewport = host.querySelector<HTMLElement>('.bg-grid__viewport')!;
    const scrollbar = host.querySelector<HTMLElement>('.bg-grid__scroll')!;
    setClientSize(viewport, 300, 240);
    setClientSize(scrollbar, 300, 240);
    grid.refresh();

    const frozenCell = host.querySelector<HTMLElement>('.bg-grid__frozen-cells .bg-cell[data-col="0"]')!;
    const frozenCells = host.querySelector<HTMLElement>('.bg-grid__frozen-cells')!;
    frozenCell.dispatchEvent(new WheelEvent('wheel', { deltaX: 250, bubbles: true, cancelable: true }));

    expect(frozenCells.style.transform).toBe('translate3d(-200px, 0px, 0)');
    expect(scrollbar.scrollLeft).toBe(50);

    grid.unmount();
  });

  it('renders a floating scrollbar for clipped frozen columns and moves its thumb', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, headerName: 'A', width: 100 },
        { id: 'b', field: 'b' as never, headerName: 'B', width: 100 },
        { id: 'c', field: 'c' as never, headerName: 'C', width: 100 },
        { id: 'd', field: 'd' as never, headerName: 'D', width: 300 },
      ],
      data: [{ a: 1, b: 2, c: 3, d: 4 }],
      frozen: { left: 3, clip: { minVisible: 1, initialVisible: 1 } },
      scrollbar: { mode: 'floating', horizontalOffsetLeft: 'after-frozen-left' },
    });

    grid.mount(host);
    const viewport = host.querySelector<HTMLElement>('.bg-grid__viewport')!;
    const scrollbar = host.querySelector<HTMLElement>('.bg-grid__scroll')!;
    const frozenTrack = host.querySelector<HTMLElement>('.bg-grid__freeze-clip-h-track')!;
    const frozenThumb = host.querySelector<HTMLElement>('.bg-grid__freeze-clip-h-thumb')!;
    setClientSize(viewport, 300, 240);
    setClientSize(scrollbar, 300, 240);
    setClientSize(frozenTrack, 100, 8);
    grid.refresh();

    expect(frozenTrack.style.visibility).toBe('visible');
    expect(frozenTrack.style.width).toBe('100px');
    expect(frozenThumb.style.width).toBe('33px');

    const frozenCell = host.querySelector<HTMLElement>('.bg-grid__frozen-cells .bg-cell[data-col="0"]')!;
    frozenCell.dispatchEvent(new WheelEvent('wheel', { deltaX: 100, bubbles: true, cancelable: true }));

    const match = frozenThumb.style.transform.match(/translate3d\(([-\d.]+)px/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(30);
    expect(Number(match![1])).toBeLessThan(40);

    grid.unmount();
  });

  it('keeps floating scrollbars aligned with freeze clip width changes', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, headerName: 'A', width: 100 },
        { id: 'b', field: 'b' as never, headerName: 'B', width: 100 },
        { id: 'c', field: 'c' as never, headerName: 'C', width: 100 },
        { id: 'd', field: 'd' as never, headerName: 'D', width: 300 },
      ],
      data: [{ a: 1, b: 2, c: 3, d: 4 }],
      frozen: { left: 3, clip: { minVisible: 1 } },
      scrollbar: { mode: 'floating', horizontalOffsetLeft: 'after-frozen-left' },
    });

    grid.mount(host);
    const viewport = host.querySelector<HTMLElement>('.bg-grid__viewport')!;
    const scrollbar = host.querySelector<HTMLElement>('.bg-grid__scroll')!;
    const mainTrack = host.querySelector<HTMLElement>('.bg-grid__float-h-track')!;
    const frozenTrack = host.querySelector<HTMLElement>('.bg-grid__freeze-clip-h-track')!;
    setClientSize(viewport, 300, 240);
    setClientSize(scrollbar, 300, 240);
    grid.refresh();

    expect(mainTrack.style.left).toBe('300px');
    expect(frozenTrack.style.visibility).toBe('hidden');

    grid.setFreezeClipWidth(160);

    expect(mainTrack.style.left).toBe('160px');
    expect(frozenTrack.style.width).toBe('160px');
    expect(frozenTrack.style.visibility).toBe('visible');

    grid.setFreezeClipWidth(null);

    expect(mainTrack.style.left).toBe('300px');
    expect(frozenTrack.style.visibility).toBe('hidden');

    grid.unmount();
  });

  it('updates the frozen-left boundary at runtime', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, headerName: 'A', width: 100 },
        { id: 'b', field: 'b' as never, headerName: 'B', width: 100 },
        { id: 'c', field: 'c' as never, headerName: 'C', width: 100 },
        { id: 'd', field: 'd' as never, headerName: 'D', width: 100 },
      ],
      data: [{ a: 1, b: 2, c: 3, d: 4 }],
      frozen: { left: 4, clip: { minVisible: 1 } },
    });

    grid.mount(host);

    expect(grid.getState().frozen.left).toBe(4);
    expect(host.querySelectorAll('.bg-header-cell--frozen-left')).toHaveLength(4);

    grid.setFrozenLeftColumns(2);

    expect(grid.getState().frozen.left).toBe(2);
    expect(host.querySelectorAll('.bg-header-cell--frozen-left')).toHaveLength(2);

    grid.unmount();
  });
});
