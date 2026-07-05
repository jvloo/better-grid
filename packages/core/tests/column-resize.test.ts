import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startColumnResize } from '../src/ui/column-resize';

let originalRaf: typeof requestAnimationFrame;
let originalCancelRaf: typeof cancelAnimationFrame;
let rafCallbacks: Array<FrameRequestCallback | null> = [];

function flushRaf(): void {
  const pending = rafCallbacks;
  rafCallbacks = [];
  pending.forEach((cb) => cb?.(0));
}

function pointerEvent(type: string, clientX: number): PointerEvent {
  return new PointerEvent(type, { clientX, bubbles: true });
}

function firePointerMove(clientX: number): void {
  document.dispatchEvent(pointerEvent('pointermove', clientX));
}

function firePointerUp(): void {
  document.dispatchEvent(pointerEvent('pointerup', 0));
}

describe('startColumnResize', () => {
  beforeEach(() => {
    rafCallbacks = [];
    originalRaf = globalThis.requestAnimationFrame;
    originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) => {
      rafCallbacks[id - 1] = null;
    }) as typeof cancelAnimationFrame;
  });

  afterEach(() => {
    // Ensure no listeners leak across tests by firing pointerup after each
    firePointerUp();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('emits new width on pointermove as startWidth + delta', () => {
    const onUpdate = vi.fn();
    startColumnResize({
      startEvent: pointerEvent('pointerdown', 100),
      startWidth: 200,
      onUpdate,
    });

    firePointerMove(130); // delta +30
    flushRaf();
    firePointerMove(150); // delta +50
    flushRaf();

    expect(onUpdate).toHaveBeenNthCalledWith(1, 230);
    expect(onUpdate).toHaveBeenNthCalledWith(2, 250);
  });

  it('converts scaled client deltas back to layout width deltas', () => {
    const onUpdate = vi.fn();
    const onPreview = vi.fn();
    startColumnResize({
      startEvent: pointerEvent('pointerdown', 100),
      startWidth: 200,
      clientToLayoutScaleX: 1.25,
      onUpdate,
      onPreview,
    });

    firePointerMove(140); // client delta +40 -> layout delta +50
    flushRaf();

    expect(onPreview).toHaveBeenLastCalledWith(250, 140, 0);
    expect(onUpdate).toHaveBeenCalledWith(250);
  });

  it('clamps width to minWidth when dragging left past the minimum', () => {
    const onUpdate = vi.fn();
    startColumnResize({
      startEvent: pointerEvent('pointerdown', 100),
      startWidth: 120,
      minWidth: 80,
      onUpdate,
    });

    firePointerMove(10); // delta -90 → would be 30, clamp to 80
    flushRaf();
    expect(onUpdate).toHaveBeenCalledWith(80);
  });

  it('defaults minWidth to 50 when undefined', () => {
    const onUpdate = vi.fn();
    startColumnResize({
      startEvent: pointerEvent('pointerdown', 100),
      startWidth: 100,
      onUpdate,
    });

    firePointerMove(-500); // way past min
    flushRaf();
    expect(onUpdate).toHaveBeenCalledWith(50);
  });

  it('clamps width to maxWidth when dragging right past the maximum', () => {
    const onUpdate = vi.fn();
    const onPreview = vi.fn();
    startColumnResize({
      startEvent: pointerEvent('pointerdown', 100),
      startWidth: 120,
      maxWidth: 180,
      onUpdate,
      onPreview,
    });

    firePointerMove(250); // delta +150 -> would be 270, clamp to 180
    flushRaf();
    expect(onPreview).toHaveBeenLastCalledWith(180, 250, 0);
    expect(onUpdate).toHaveBeenCalledWith(180);
  });

  it('sets and clears body cursor/userSelect across the drag lifecycle', () => {
    expect(document.body.style.cursor).toBe('');

    startColumnResize({
      startEvent: pointerEvent('pointerdown', 0),
      startWidth: 100,
      onUpdate: () => {},
    });

    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    firePointerUp();

    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('stops emitting after pointerup', () => {
    const onUpdate = vi.fn();
    startColumnResize({
      startEvent: pointerEvent('pointerdown', 0),
      startWidth: 100,
      onUpdate,
    });

    firePointerMove(50);
    flushRaf();
    firePointerUp();
    firePointerMove(200); // should be ignored
    flushRaf();

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps cursor readout immediate while throttling width writes', () => {
    const onUpdate = vi.fn();
    const onCursorMove = vi.fn();
    startColumnResize({
      startEvent: pointerEvent('pointerdown', 100),
      startWidth: 200,
      updateEveryFrames: 3,
      onUpdate,
      onCursorMove,
    });

    expect(onCursorMove).toHaveBeenCalledWith(200, 100, 0);

    firePointerMove(130);
    expect(onCursorMove).toHaveBeenLastCalledWith(230, 130, 0);
    flushRaf();
    expect(onUpdate).toHaveBeenCalledWith(230);

    firePointerMove(150);
    expect(onCursorMove).toHaveBeenLastCalledWith(250, 150, 0);
    flushRaf();
    expect(onUpdate).toHaveBeenCalledTimes(1);

    firePointerUp();
    expect(onUpdate).toHaveBeenLastCalledWith(250);
  });

  it('can defer width writes until pointerup while emitting previews', () => {
    const onUpdate = vi.fn();
    const onPreview = vi.fn();
    startColumnResize({
      startEvent: pointerEvent('pointerdown', 100),
      startWidth: 200,
      liveUpdate: false,
      onUpdate,
      onPreview,
    });

    expect(onPreview).toHaveBeenCalledWith(200, 100, 0);

    firePointerMove(130);
    flushRaf();
    firePointerMove(160);
    flushRaf();

    expect(onPreview).toHaveBeenLastCalledWith(260, 160, 0);
    expect(onUpdate).not.toHaveBeenCalled();

    firePointerUp();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(260);
  });
});
