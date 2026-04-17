import { afterEach, describe, expect, it, vi } from 'vitest';
import { startColumnResize } from '../src/ui/column-resize';

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
  afterEach(() => {
    // Ensure no listeners leak across tests by firing pointerup after each
    firePointerUp();
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
    firePointerMove(150); // delta +50

    expect(onUpdate).toHaveBeenNthCalledWith(1, 230);
    expect(onUpdate).toHaveBeenNthCalledWith(2, 250);
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
    expect(onUpdate).toHaveBeenCalledWith(50);
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
    firePointerUp();
    firePointerMove(200); // should be ignored

    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
