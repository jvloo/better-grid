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
  /** Maximum allowed width, in pixels (defaults to no maximum if undefined) */
  maxWidth?: number;
  /**
   * Multiplier from browser client pixels to grid layout pixels. Use values
   * greater than 1 when an ancestor scales the grid down with CSS transforms.
   */
  clientToLayoutScaleX?: number;
  /** Called with the new width on each pointermove */
  onUpdate: (width: number) => void;
  /**
   * When false, defer the expensive onUpdate call until pointerup. Use this
   * for very wide grids where live re-layout allocates too much memory during
   * drag; pair with onPreview for a cheap visual guide.
   */
  liveUpdate?: boolean;
  /**
   * Cheap visual-preview hook called at drag start and on every pointermove.
   * Unlike onUpdate, this should not mutate grid state.
   */
  onPreview?: (width: number, clientX: number, clientY: number) => void;
  /**
   * Called on every pointermove with the resolved width and the cursor's
   * client coordinates so a tooltip / readout can follow the cursor. The
   * caller decides whether to render anything.
   */
  onCursorMove?: (width: number, clientX: number, clientY: number) => void;
  /**
   * Apply expensive width mutations at most once per N animation frames during
   * drag. The cursor readout still updates for every pointermove, and the final
   * width is always committed on pointerup.
   */
  updateEveryFrames?: number;
  /** Called once when the user releases the pointer. */
  onComplete?: (width: number) => void;
}

const DEFAULT_MIN_WIDTH = 50;
const DEFAULT_MAX_WIDTH = Number.POSITIVE_INFINITY;

export function startColumnResize({
  startEvent,
  startWidth,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  clientToLayoutScaleX = 1,
  onUpdate,
  liveUpdate = true,
  onPreview,
  onCursorMove,
  updateEveryFrames = 1,
  onComplete,
}: StartColumnResizeOptions): void {
  const startX = startEvent.clientX;
  const scaleX =
    Number.isFinite(clientToLayoutScaleX) && clientToLayoutScaleX > 0
      ? clientToLayoutScaleX
      : 1;
  const lowerBound = Math.max(0, minWidth);
  const upperBound = Math.max(lowerBound, maxWidth);
  const clampWidth = (width: number) => Math.max(lowerBound, Math.min(upperBound, width));
  let lastWidth = clampWidth(startWidth);
  let lastClientX = startX;
  let lastClientY = startEvent.clientY;
  let lastAppliedWidth = lastWidth;
  const frameInterval = Math.max(1, Math.floor(updateEveryFrames));
  let framesSinceUpdate = frameInterval;
  // Throttle width writes to one per animation frame. setColumnWidth is
  // expensive (invalidates headers, recomputes measurements, schedules a
  // render); firing it on every pointermove caused visible drag lag,
  // especially on grids with many columns.
  let pendingWidth: number | null = null;
  let rafId: number | null = null;
  const scheduleFlush = () => {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => flushWidth());
    }
  };
  const applyWidth = (width: number) => {
    if (width === lastAppliedWidth) return;
    onUpdate(width);
    lastAppliedWidth = width;
  };
  const flushWidth = (force = false) => {
    rafId = null;
    if (pendingWidth === null) return;

    framesSinceUpdate += 1;
    if (force || framesSinceUpdate >= frameInterval) {
      applyWidth(pendingWidth);
      pendingWidth = null;
      framesSinceUpdate = 0;
      return;
    }

    scheduleFlush();
  };

  const onPointerMove = (e: PointerEvent) => {
    const delta = (e.clientX - startX) * scaleX;
    lastWidth = clampWidth(startWidth + delta);
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    onPreview?.(lastWidth, lastClientX, lastClientY);
    // Keep the tooltip/readout tied to the physical cursor. It is cheap and
    // should not wait behind the heavier grid re-layout.
    onCursorMove?.(lastWidth, lastClientX, lastClientY);
    if (liveUpdate) {
      pendingWidth = lastWidth;
      scheduleFlush();
    }
  };

  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    if (liveUpdate) {
      pendingWidth = lastWidth;
      flushWidth(true);
    } else {
      applyWidth(lastWidth);
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
  onPreview?.(lastWidth, startX, startEvent.clientY);
  onCursorMove?.(lastWidth, startX, startEvent.clientY);
}
