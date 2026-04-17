// ============================================================================
// Scroll Cell Into View — computes and applies scroll deltas so a given cell
// is visible in the viewport.
//
// Extracted from grid.ts. Skips horizontal scrolling for frozen columns
// (they're always visible in the left overlay anyway).
// ============================================================================

import type { CellPosition } from '../types';

export interface ScrollCellIntoViewOptions {
  cell: CellPosition;
  /** Scroll host (fake scrollbar). null/undefined → no-op. */
  fakeScrollbar: HTMLElement | null;
  /** Viewport host used to measure the visible width for horizontal scrolling. */
  viewport: HTMLElement | null;
  /** Cumulative column x-offsets (Float32Array or number[]). */
  colOffsets: ArrayLike<number>;
  /** Cumulative row y-offsets. */
  rowOffsets: ArrayLike<number>;
  /** Header height (deducted from the usable vertical space). */
  headerHeight: number;
  /** Number of left-frozen columns; cells in this range don't trigger horizontal scroll. */
  frozenLeftColumns: number;
}

export function scrollCellIntoView({
  cell,
  fakeScrollbar,
  viewport,
  colOffsets,
  rowOffsets,
  headerHeight,
  frozenLeftColumns,
}: ScrollCellIntoViewOptions): void {
  if (!fakeScrollbar) return;

  const rowTop = rowOffsets[cell.rowIndex] ?? 0;
  const rowBottom = rowOffsets[cell.rowIndex + 1] ?? 0;
  const colLeft = colOffsets[cell.colIndex] ?? 0;
  const colRight = colOffsets[cell.colIndex + 1] ?? 0;

  const viewTop = fakeScrollbar.scrollTop;
  const viewBottom = viewTop + fakeScrollbar.clientHeight - headerHeight;
  const viewLeft = fakeScrollbar.scrollLeft;
  const viewRight = viewLeft + (viewport?.clientWidth ?? 0);

  // Vertical scroll
  if (rowTop < viewTop) {
    fakeScrollbar.scrollTop = rowTop;
  } else if (rowBottom > viewBottom) {
    fakeScrollbar.scrollTop = rowBottom - fakeScrollbar.clientHeight + headerHeight;
  }

  // Horizontal scroll (skip if frozen column)
  if (cell.colIndex >= frozenLeftColumns) {
    if (colLeft < viewLeft) {
      fakeScrollbar.scrollLeft = colLeft;
    } else if (colRight > viewRight) {
      fakeScrollbar.scrollLeft = colRight - (viewport?.clientWidth ?? 0);
    }
  }
}
