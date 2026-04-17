import { afterEach, describe, expect, it, vi } from 'vitest';
import { startFreezeClipDrag } from '../src/ui/freeze-clip-drag';

function pointerEvent(type: string, clientX: number): PointerEvent {
  const ev = new PointerEvent(type, { clientX, bubbles: true, cancelable: true });
  return ev;
}

function makeContainerRect(left = 0): DOMRect {
  return { left, top: 0, right: 1000, bottom: 500, width: 1000, height: 500, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
}

describe('startFreezeClipDrag', () => {
  afterEach(() => {
    document.dispatchEvent(pointerEvent('pointerup', 0));
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('sets clip width to clamped currentX during pointermove', () => {
    const setClipWidth = vi.fn();
    const onComplete = vi.fn();

    // 3 columns at widths 100/100/100 → offsets [0,100,200,300]
    startFreezeClipDrag({
      startEvent: pointerEvent('pointerdown', 300),
      containerRect: makeContainerRect(),
      colOffsets: [0, 100, 200, 300],
      frozenLeftColumns: 3,
      minVisibleColumns: 1,
      setClipWidth,
      onComplete,
    });

    document.dispatchEvent(pointerEvent('pointermove', 150));
    expect(setClipWidth).toHaveBeenLastCalledWith(150);
  });

  it('clamps to minVisibleColumns width when dragged too far left', () => {
    const setClipWidth = vi.fn();
    startFreezeClipDrag({
      startEvent: pointerEvent('pointerdown', 300),
      containerRect: makeContainerRect(),
      colOffsets: [0, 100, 200, 300],
      frozenLeftColumns: 3,
      minVisibleColumns: 2, // at least 2 cols visible = 200px
      setClipWidth,
      onComplete: () => {},
    });

    document.dispatchEvent(pointerEvent('pointermove', 50)); // would be 50, clamps to 200
    expect(setClipWidth).toHaveBeenLastCalledWith(200);
  });

  it('snaps to null (fully restored) when within 8px of full width', () => {
    const setClipWidth = vi.fn();
    startFreezeClipDrag({
      startEvent: pointerEvent('pointerdown', 300),
      containerRect: makeContainerRect(),
      colOffsets: [0, 100, 200, 300],
      frozenLeftColumns: 3,
      minVisibleColumns: 1,
      setClipWidth,
      onComplete: () => {},
    });

    document.dispatchEvent(pointerEvent('pointermove', 295)); // 5px from full
    expect(setClipWidth).toHaveBeenLastCalledWith(null);
  });

  it('passes finalWidth + fullFrozenWidth to onComplete on pointerup', () => {
    const onComplete = vi.fn();
    startFreezeClipDrag({
      startEvent: pointerEvent('pointerdown', 300),
      containerRect: makeContainerRect(),
      colOffsets: [0, 100, 200, 300],
      frozenLeftColumns: 3,
      minVisibleColumns: 1,
      setClipWidth: () => {},
      onComplete,
    });

    document.dispatchEvent(pointerEvent('pointermove', 150));
    document.dispatchEvent(pointerEvent('pointerup', 150));

    expect(onComplete).toHaveBeenCalledWith(150, 300);
  });

  it('reports fullFrozenWidth when pointerup happens with no move', () => {
    const onComplete = vi.fn();
    startFreezeClipDrag({
      startEvent: pointerEvent('pointerdown', 300),
      containerRect: makeContainerRect(),
      colOffsets: [0, 100, 200, 300],
      frozenLeftColumns: 3,
      minVisibleColumns: 1,
      setClipWidth: () => {},
      onComplete,
    });

    document.dispatchEvent(pointerEvent('pointerup', 0));
    expect(onComplete).toHaveBeenCalledWith(300, 300);
  });

  it('cleans up body cursor/userSelect on pointerup', () => {
    startFreezeClipDrag({
      startEvent: pointerEvent('pointerdown', 300),
      containerRect: makeContainerRect(),
      colOffsets: [0, 100, 200, 300],
      frozenLeftColumns: 3,
      minVisibleColumns: 1,
      setClipWidth: () => {},
      onComplete: () => {},
    });

    expect(document.body.style.cursor).toBe('col-resize');
    document.dispatchEvent(pointerEvent('pointerup', 0));
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });
});
