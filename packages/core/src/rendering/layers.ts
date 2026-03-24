// ============================================================================
// Selection Layer — Renders selection overlay without re-rendering cells
// ============================================================================

import type { Selection } from '../types';
import type { LayoutMeasurements } from '../virtualization/engine';

export class SelectionLayer {
  private overlay: HTMLElement;
  private activeIndicator: HTMLElement;
  private rangeBorders: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'bg-selection-overlay';
    this.overlay.style.position = 'absolute';
    this.overlay.style.inset = '0';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.zIndex = '2';
    container.appendChild(this.overlay);

    this.activeIndicator = document.createElement('div');
    this.activeIndicator.className = 'bg-active-cell';
    this.activeIndicator.style.position = 'absolute';
    this.activeIndicator.style.display = 'none';
    this.activeIndicator.style.pointerEvents = 'none';
    this.activeIndicator.style.boxSizing = 'border-box';
    this.overlay.appendChild(this.activeIndicator);
  }

  render(selection: Selection, measurements: LayoutMeasurements): void {
    // Clear range borders
    for (const el of this.rangeBorders) {
      el.remove();
    }
    this.rangeBorders = [];

    // Active cell indicator
    if (selection.active) {
      const { rowIndex, colIndex } = selection.active;
      const top = measurements.rowOffsets[rowIndex]!;
      const left = measurements.colOffsets[colIndex]!;
      const height = measurements.rowOffsets[rowIndex + 1]! - top;
      const width = measurements.colOffsets[colIndex + 1]! - left;

      this.activeIndicator.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      this.activeIndicator.style.width = `${width}px`;
      this.activeIndicator.style.height = `${height}px`;
      this.activeIndicator.style.display = 'block';
    } else {
      this.activeIndicator.style.display = 'none';
    }

    // Range selection highlights
    for (const range of selection.ranges) {
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
