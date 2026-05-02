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
  /**
   * Called on every pointermove with the resolved width and the cursor's
   * client coordinates so a tooltip / readout can follow the cursor. The
   * caller decides whether to render anything.
   */
  onCursorMove?: (width: number, clientX: number, clientY: number) => void;
  /** Called once when the user releases the pointer. */
  onComplete?: (width: number) => void;
}

const DEFAULT_MIN_WIDTH = 50;

export function startColumnResize({
  startEvent,
  startWidth,
  minWidth = DEFAULT_MIN_WIDTH,
  onUpdate,
  onCursorMove,
  onComplete,
}: StartColumnResizeOptions): void {
  const startX = startEvent.clientX;
  let lastWidth = startWidth;
  // Throttle width writes to one per animation frame. setColumnWidth is
  // expensive (invalidates headers, recomputes measurements, schedules a
  // render); firing it on every pointermove caused visible drag lag,
  // especially on grids with many columns. The cursor tooltip update
  // remains synchronous because it's a cheap textContent + style swap.
  let pendingWidth: number | null = null;
  let rafId: number | null = null;
  const flushWidth = () => {
    if (pendingWidth !== null) {
      onUpdate(pendingWidth);
      pendingWidth = null;
    }
    rafId = null;
  };

  const onPointerMove = (e: PointerEvent) => {
    const delta = e.clientX - startX;
    lastWidth = Math.max(minWidth, startWidth + delta);
    pendingWidth = lastWidth;
    onCursorMove?.(lastWidth, e.clientX, e.clientY);
    if (rafId === null) {
      rafId = requestAnimationFrame(flushWidth);
    }
  };

  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      flushWidth();
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('bg-grid-resizing');
    onComplete?.(lastWidth);
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  // Add a body class so a CSS rule can disable user-select on cells / headers
  // that opted into user-select: text via .bg-grid--text-selectable. The
  // body-level inline style alone doesn't override more-specific rules.
  document.body.classList.add('bg-grid-resizing');

  // Emit an initial cursor-move so the readout appears at drag-start without
  // waiting for the first pointermove (matters for trackpads where the user
  // can hold without moving).
  onCursorMove?.(startWidth, startX, startEvent.clientY);
}
