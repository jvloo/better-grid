// ============================================================================
// Virtualization Engine — Prefix sums + binary search for O(log n) lookups
// ============================================================================

import type { VirtualRange } from '../types';

export interface LayoutMeasurements {
  rowOffsets: Float32Array;
  colOffsets: Float32Array;
  totalHeight: number;
  totalWidth: number;
}

export class VirtualizationEngine {
  private measurements: LayoutMeasurements;
  private overscanRows: number;
  private overscanCols: number;

  constructor(overscanRows = 5, overscanCols = 3) {
    this.overscanRows = overscanRows;
    this.overscanCols = overscanCols;
    this.measurements = {
      rowOffsets: new Float32Array(1),
      colOffsets: new Float32Array(1),
      totalHeight: 0,
      totalWidth: 0,
    };
  }

  getMeasurements(): LayoutMeasurements {
    return this.measurements;
  }

  /** Recompute prefix-sum arrays when dimensions change */
  recompute(
    rowCount: number,
    colCount: number,
    getRowHeight: (index: number) => number,
    getColWidth: (index: number) => number,
  ): void {
    // Reuse existing arrays if size matches to reduce GC pressure
    let rowOffsets = this.measurements.rowOffsets;
    if (rowOffsets.length !== rowCount + 1) {
      rowOffsets = new Float32Array(rowCount + 1);
    }
    for (let i = 0; i < rowCount; i++) {
      rowOffsets[i + 1] = rowOffsets[i]! + getRowHeight(i);
    }

    let colOffsets = this.measurements.colOffsets;
    if (colOffsets.length !== colCount + 1) {
      colOffsets = new Float32Array(colCount + 1);
    }
    for (let i = 0; i < colCount; i++) {
      colOffsets[i + 1] = colOffsets[i]! + getColWidth(i);
    }

    this.measurements = {
      rowOffsets,
      colOffsets,
      totalHeight: rowOffsets[rowCount]!,
      totalWidth: colOffsets[colCount]!,
    };
  }

  /** Compute the visible cell range for a given scroll position and viewport size */
  computeVisibleRange(
    scrollTop: number,
    scrollLeft: number,
    viewportWidth: number,
    viewportHeight: number,
    frozenTopHeight: number,
    frozenBottomHeight: number,
    frozenLeftWidth: number,
    frozenRightWidth: number,
  ): VirtualRange {
    const { rowOffsets, colOffsets } = this.measurements;
    const totalRows = rowOffsets.length - 1;
    const totalCols = colOffsets.length - 1;

    const availableHeight = viewportHeight - frozenTopHeight - frozenBottomHeight;
    const availableWidth = viewportWidth - frozenLeftWidth - frozenRightWidth;

    const startRow = this.binarySearch(rowOffsets, scrollTop);
    const endRow = this.binarySearch(rowOffsets, scrollTop + availableHeight);

    const startCol = this.binarySearch(colOffsets, scrollLeft);
    const endCol = this.binarySearch(colOffsets, frozenLeftWidth + scrollLeft + availableWidth);

    return {
      startRow: Math.max(0, startRow - this.overscanRows),
      endRow: Math.min(totalRows, endRow + this.overscanRows + 1),
      startCol: Math.max(0, startCol - this.overscanCols),
      endCol: Math.min(totalCols, endCol + this.overscanCols + 1),
    };
  }

  /** Get the pixel offset and size for a row */
  getRowMetrics(rowIndex: number): { offset: number; size: number } {
    const { rowOffsets } = this.measurements;
    return {
      offset: rowOffsets[rowIndex]!,
      size: rowOffsets[rowIndex + 1]! - rowOffsets[rowIndex]!,
    };
  }

  /** Get the pixel offset and size for a column */
  getColMetrics(colIndex: number): { offset: number; size: number } {
    const { colOffsets } = this.measurements;
    return {
      offset: colOffsets[colIndex]!,
      size: colOffsets[colIndex + 1]! - colOffsets[colIndex]!,
    };
  }

  /** Binary search on prefix-sum array to find the index at a given offset */
  private binarySearch(offsets: Float32Array, target: number): number {
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid]! < target) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return Math.max(0, lo - 1);
  }
}
