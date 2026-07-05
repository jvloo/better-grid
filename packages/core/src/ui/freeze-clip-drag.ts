// ============================================================================
// Freeze Clip Drag — pointer-drag handler for the frozen-column clip boundary
//
// Extracted from grid.ts. The user drags the right edge of the frozen-column
// zone inward to temporarily hide some frozen columns; releasing within 8px of
// the full width "snaps" back to fully restored (null). The caller owns the
// clip-width state and render scheduling; this module only handles the drag.
// ============================================================================

const SNAP_BACK_THRESHOLD = 8;

export interface StartFreezeClipDragOptions {
  startEvent: PointerEvent;
  containerRect: DOMRect;
  /** Column-offset measurements (cumulative widths). Accepts Float32Array or number[]. */
  colOffsets: ArrayLike<number>;
  /** Number of left-frozen columns in the grid */
  frozenLeftColumns: number;
  /** Minimum number of frozen columns that must remain visible */
  minVisibleColumns: number;
  /**
   * Multiplier from browser client pixels to grid layout pixels. Use values
   * greater than 1 when an ancestor scales the grid down with CSS transforms.
   */
  clientToLayoutScaleX?: number;
  /** Update the clip width (null = no clip / fully restored) */
  setClipWidth: (width: number | null) => void;
  /** Called on pointerup with (finalWidth, fullFrozenWidth) */
  onComplete: (finalWidth: number, fullFrozenWidth: number) => void;
}

export function startFreezeClipDrag({
  startEvent,
  containerRect,
  colOffsets,
  frozenLeftColumns,
  minVisibleColumns,
  clientToLayoutScaleX = 1,
  setClipWidth,
  onComplete,
}: StartFreezeClipDragOptions): void {
  startEvent.preventDefault();
  startEvent.stopPropagation();

  const fullFrozenWidth = colOffsets[frozenLeftColumns] ?? 0;
  const minCols = Math.min(minVisibleColumns, frozenLeftColumns);
  const minWidth = minCols > 0 ? (colOffsets[minCols] ?? 0) : 0;
  const scaleX =
    Number.isFinite(clientToLayoutScaleX) && clientToLayoutScaleX > 0
      ? clientToLayoutScaleX
      : 1;
  let latestWidth: number | null = null;
  let hasLatestWidth = false;
  let rafId: number | null = null;

  const flushClipWidth = () => {
    rafId = null;
    if (!hasLatestWidth) return;
    setClipWidth(latestWidth);
  };

  const scheduleClipWidth = () => {
    if (rafId === null) {
      rafId = requestAnimationFrame(flushClipWidth);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const currentX = (e.clientX - containerRect.left) * scaleX;
    const clampedWidth = Math.max(minWidth, Math.min(fullFrozenWidth, currentX));
    if (clampedWidth >= fullFrozenWidth - SNAP_BACK_THRESHOLD) {
      latestWidth = null;
    } else {
      latestWidth = clampedWidth;
    }
    hasLatestWidth = true;
    scheduleClipWidth();
  };

  const onPointerUp = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      flushClipWidth();
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onComplete(latestWidth ?? fullFrozenWidth, fullFrozenWidth);
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}
