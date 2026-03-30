// ============================================================================
// Selection Layer — Renders range selection overlay
// Active cell indicator is handled by CSS (.bg-cell--active outline).
// This layer only renders the range highlight rectangles.
// ============================================================================

import type { Selection } from '../types';
import type { LayoutMeasurements } from '../virtualization/engine';

export class SelectionLayer {
  private overlay: HTMLElement;
  private rangeBorders: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'bg-selection-overlay';
    this.overlay.style.position = 'absolute';
    this.overlay.style.inset = '0';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.zIndex = '2';
    container.appendChild(this.overlay);
  }

  render(selection: Selection, measurements: LayoutMeasurements): void {
    // Clear previous range borders
    for (const el of this.rangeBorders) {
      el.remove();
    }
    this.rangeBorders = [];

    const hasMultipleRanges = selection.ranges.length > 1;

    // Range selection highlights
    for (const range of selection.ranges) {
      const isSingleCell = range.startRow === range.endRow && range.startCol === range.endCol;

      // Skip single-cell ranges ONLY when there's just one range
      // (handled by .bg-cell--active CSS). With multi-range (Ctrl+click),
      // non-active single-cell ranges need visible highlights.
      if (isSingleCell && !hasMultipleRanges) {
        continue;
      }

      // Skip the active cell's range in multi-range — it already has .bg-cell--active outline
      const isActiveRange = isSingleCell && selection.active &&
        range.startRow === selection.active.rowIndex &&
        range.startCol === selection.active.colIndex;
      if (isActiveRange) continue;

      const border = document.createElement('div');
      border.className = 'bg-selection-range';
      const top = measurements.rowOffsets[range.startRow]!;
      const left = measurements.colOffsets[range.startCol]!;
      const bottom = measurements.rowOffsets[range.endRow + 1]!;
      const right = measurements.colOffsets[range.endCol + 1]!;

      border.style.position = 'absolute';
      border.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      border.style.width = `${right - left}px`;
      border.style.height = `${bottom - top}px`;
      border.style.pointerEvents = 'none';
      border.style.boxSizing = 'border-box';

      this.overlay.appendChild(border);
      this.rangeBorders.push(border);
    }
  }

  destroy(): void {
    this.overlay.remove();
  }
}
