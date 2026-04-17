// ============================================================================
// Column Resize — pointer-drag handler for the column-header resize grip
//
// Extracted from grid.ts. Pure DOM utility: attaches move/up listeners on the
// document, updates body cursor, and emits width updates via onUpdate. The
// caller decides how to apply the width (typically instance.setColumnWidth).
// ============================================================================

export interface StartColumnResizeOptions {
  /** The initial pointerdown event (for clientX baseline) */
  startEvent: PointerEvent;
  /** Width of the column at drag start, in pixels */
  startWidth: number;
  /** Minimum allowed width, in pixels (defaults to 50 if undefined) */
  minWidth?: number;
  /** Called with the new width on each pointermove */
  onUpdate: (width: number) => void;
}

const DEFAULT_MIN_WIDTH = 50;

export function startColumnResize({
  startEvent,
  startWidth,
  minWidth = DEFAULT_MIN_WIDTH,
  onUpdate,
}: StartColumnResizeOptions): void {
  const startX = startEvent.clientX;

  const onPointerMove = (e: PointerEvent) => {
    const delta = e.clientX - startX;
    onUpdate(Math.max(minWidth, startWidth + delta));
  };

  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}
