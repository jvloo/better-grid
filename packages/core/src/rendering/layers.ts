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

    // Fill handle at bottom-right corner of last range (or active cell)
    const lastRange = selection.ranges[selection.ranges.length - 1];
    if (lastRange && measurements.rowOffsets && measurements.colOffsets) {
      const bottom = measurements.rowOffsets[lastRange.endRow + 1];
      const right = measurements.colOffsets[lastRange.endCol + 1];
      if (bottom != null && right != null) {
        const handle = document.createElement('div');
        handle.className = 'bg-fill-handle';
        handle.style.position = 'absolute';
        handle.style.width = '7px';
        handle.style.height = '7px';
        handle.style.background = 'var(--bg-active-border, #1a73e8)';
        handle.style.border = '1px solid #fff';
        handle.style.borderRadius = '1px';
        handle.style.transform = `translate3d(${right - 4}px, ${bottom - 4}px, 0)`;
        handle.style.cursor = 'crosshair';
        handle.style.zIndex = '5';
        handle.style.pointerEvents = 'auto';
        this.overlay.appendChild(handle);
        this.rangeBorders.push(handle);
      }
    }
  }

  destroy(): void {
    this.overlay.remove();
  }
}
