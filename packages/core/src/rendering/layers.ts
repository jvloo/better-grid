// ============================================================================
// Selection Layer — Renders range selection overlay
// Active cell indicator is handled by CSS (.bg-cell--active outline).
// This layer only renders the range highlight rectangles.
// ============================================================================

import type { Selection, CellRange } from '../types';
import type { LayoutMeasurements } from '../virtualization/engine';

export interface FillDragResult {
  sourceRange: CellRange;
  targetRange: CellRange;
}

export interface SelectionLayerViewState {
  bodyBottom: number;
  bodyLeft: number;
  clipOffset: number;
  containerTop: number;
  pinnedBottomHeight: number;
  scrollLeft: number;
  scrollTop: number;
  viewportHeight: number;
  viewportWidth: number;
}

export class SelectionLayer {
  private container: HTMLElement;
  private overlay: HTMLElement;
  private rangeLayer: HTMLElement;
  private handleLayer: HTMLElement;
  private rangeBorders: HTMLElement[] = [];
  private fillHandle: HTMLElement | null = null;
  private onFillDrag: ((result: FillDragResult) => void) | null = null;
  private isEditing = false;
  private fillHandleEnabled = true;
  /**
   * Hash of the inputs to the previous render() call. When unchanged we skip
   * the rebuild — render() previously tore down and recreated every range
   * border + the fill handle on each frame, even when nothing changed.
   */
  private lastRenderHash: string | null = null;

  constructor(container: HTMLElement, rangeRoot?: HTMLElement, handleRoot?: HTMLElement) {
    this.container = container;
    this.overlay = document.createElement('div');
    this.overlay.className = 'bg-selection-overlay';
    this.overlay.style.position = 'absolute';
    this.overlay.style.inset = '0';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.zIndex = '6';
    container.appendChild(this.overlay);

    this.rangeLayer = document.createElement('div');
    this.rangeLayer.className = 'bg-selection-range-layer';
    this.rangeLayer.style.position = 'absolute';
    this.rangeLayer.style.inset = '0';
    this.rangeLayer.style.pointerEvents = 'none';
    this.rangeLayer.style.zIndex = '5';

    this.handleLayer = document.createElement('div');
    this.handleLayer.className = 'bg-fill-handle-layer';
    this.handleLayer.style.position = 'absolute';
    this.handleLayer.style.inset = '0';
    this.handleLayer.style.pointerEvents = 'none';
    this.handleLayer.style.zIndex = '12';
    (rangeRoot ?? container).appendChild(this.rangeLayer);
    (handleRoot ?? rangeRoot ?? container).appendChild(this.handleLayer);
  }

  setFillHandleEnabled(enabled: boolean): void {
    this.fillHandleEnabled = enabled;
    this.lastRenderHash = null;
  }

  setEditing(editing: boolean): void {
    this.isEditing = editing;
    if (this.fillHandle) {
      this.fillHandle.style.display = editing ? 'none' : 'block';
    }
    // editing toggles fill-handle visibility; invalidate the dedupe hash so the
    // next render() doesn't short-circuit while the handle is in the wrong state
    this.lastRenderHash = null;
  }

  setFillDragHandler(handler: (result: FillDragResult) => void): void {
    this.onFillDrag = handler;
  }

  /** Invalidate cached render geometry when the container moves/resizes. */
  invalidateLayout(): void {
    this.lastRenderHash = null;
  }

  render(
    selection: Selection,
    measurements: LayoutMeasurements,
    readonlyColumns?: Set<number>,
    fillHandleAllowed = true,
    viewState?: SelectionLayerViewState,
  ): void {
    // Change-detection: hash everything that affects output. If unchanged, skip.
    // Render previously tore down + recreated all range borders + the fill
    // handle on every frame, even when nothing changed (e.g. scroll-driven
    // re-renders that don't touch selection).
    let hash = '';
    if (selection.active) hash += `${selection.active.rowIndex}:${selection.active.colIndex}`;
    hash += '|';
    for (const r of selection.ranges) {
      hash += `${r.startRow},${r.endRow},${r.startCol},${r.endCol};`;
    }
    // Last range's end-row/col offsets drive fill-handle position; row/col offset
    // arrays are typically retained-by-identity by the layout engine, so length
    // + last value is a cheap proxy for "did the layout change?".
    const ro = measurements.rowOffsets;
    const co = measurements.colOffsets;
    hash += `|${ro.length}:${ro[ro.length - 1] ?? 0}|${co.length}:${co[co.length - 1] ?? 0}`;
    hash += `|fh=${this.fillHandleEnabled ? 1 : 0}|fha=${fillHandleAllowed ? 1 : 0}|ed=${this.isEditing ? 1 : 0}`;
    if (viewState) {
      hash += `|vs=${Math.round(viewState.scrollLeft)}:${Math.round(viewState.scrollTop)}:${Math.round(viewState.clipOffset)}:${Math.round(viewState.containerTop)}:${Math.round(viewState.bodyLeft)}:${Math.round(viewState.bodyBottom)}:${Math.round(viewState.pinnedBottomHeight)}:${Math.round(viewState.viewportWidth)}:${Math.round(viewState.viewportHeight)}`;
    }
    if (readonlyColumns && readonlyColumns.size > 0) {
      // Order-independent: cheap sum over a typically-small set.
      let ros = 0;
      for (const c of readonlyColumns) ros += c;
      hash += `|ro=${readonlyColumns.size}:${ros}`;
    }
    if (hash === this.lastRenderHash) return;
    this.lastRenderHash = hash;

    // Clear previous range borders + fill handle
    for (const el of this.rangeBorders) {
      el.remove();
    }
    this.rangeBorders = [];
    if (this.fillHandle) {
      this.fillHandle.remove();
      this.fillHandle = null;
    }

    // Range selection highlights
    for (const range of selection.ranges) {
      const border = document.createElement('div');
      border.className = 'bg-selection-range';
      let top = measurements.rowOffsets[range.startRow]!;
      let left = measurements.colOffsets[range.startCol]!;
      let bottom = measurements.rowOffsets[range.endRow + 1]!;
      let right = measurements.colOffsets[range.endCol + 1]!;
      let clippedTopEdge = false;
      let clippedBottomEdge = false;
      let clippedLeftEdge = false;
      let clippedRightEdge = false;

      const parent = viewState ? this.rangeLayer : this.overlay;
      if (viewState) {
        top = viewState.containerTop + top - viewState.scrollTop;
        bottom = viewState.containerTop + bottom - viewState.scrollTop;
        left = left - viewState.scrollLeft - viewState.clipOffset;
        right = right - viewState.scrollLeft - viewState.clipOffset;

        const hasViewportBounds = viewState.viewportWidth > 0 && viewState.viewportHeight > viewState.containerTop;
        if (hasViewportBounds) {
          const clippedTop = Math.max(viewState.containerTop, top);
          const clippedLeft = Math.max(0, left);
          const clippedBottom = Math.min(viewState.viewportHeight, bottom);
          const clippedRight = Math.min(viewState.viewportWidth, right);

          if (clippedBottom <= clippedTop || clippedRight <= clippedLeft) {
            continue;
          }

          clippedTopEdge = clippedTop > top;
          clippedBottomEdge = clippedBottom < bottom;
          clippedLeftEdge = clippedLeft > left;
          clippedRightEdge = clippedRight < right;
          top = clippedTop;
          left = clippedLeft;
          bottom = clippedBottom;
          right = clippedRight;
        }
      }

      border.style.position = 'absolute';
      border.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      border.style.width = `${right - left}px`;
      border.style.height = `${bottom - top}px`;
      border.style.pointerEvents = 'none';
      border.style.boxSizing = 'border-box';
      if (clippedTopEdge) border.style.borderTopColor = 'transparent';
      if (clippedBottomEdge) border.style.borderBottomColor = 'transparent';
      if (clippedLeftEdge) border.style.borderLeftColor = 'transparent';
      if (clippedRightEdge) border.style.borderRightColor = 'transparent';

      parent.appendChild(border);
      this.rangeBorders.push(border);
    }

    // Fill handle at bottom-right corner of last range (or active cell)
    // Skip if all columns in the range are readonly
    if (!this.fillHandleEnabled || !fillHandleAllowed) return;
    const lastRange = selection.ranges[selection.ranges.length - 1];
    if (lastRange && readonlyColumns && readonlyColumns.size > 0) {
      let allReadonly = true;
      for (let c = lastRange.startCol; c <= lastRange.endCol; c++) {
        if (!readonlyColumns.has(c)) { allReadonly = false; break; }
      }
      if (allReadonly) return;
    }
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
        handle.style.cursor = 'crosshair';
        handle.style.zIndex = '20';
        handle.style.pointerEvents = 'auto';

        const x = viewState ? right - viewState.scrollLeft - viewState.clipOffset - 4 : right - 4;
        const y = viewState ? viewState.containerTop + bottom - viewState.scrollTop - 4 : bottom - 4;
        if (viewState && x < viewState.bodyLeft) {
          return;
        }
        if (
          viewState &&
          viewState.pinnedBottomHeight > 0 &&
          viewState.bodyBottom > viewState.containerTop &&
          y + 7 > viewState.bodyBottom
        ) {
          return;
        }
        handle.style.transform = `translate3d(${x}px, ${y}px, 0)`;

        // Hide when editing
        if (this.isEditing) handle.style.display = 'none';

        // Drag-to-fill
        handle.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.startFillDrag(e, lastRange, measurements);
        });

        this.handleLayer.appendChild(handle);
        this.fillHandle = handle;
      }
    }
  }

  private startFillDrag(
    startEvent: PointerEvent,
    sourceRange: CellRange,
    measurements: LayoutMeasurements,
  ): void {
    const rowOffsets = measurements.rowOffsets;
    const colOffsets = measurements.colOffsets;
    const rowCount = rowOffsets.length - 1;
    const colCount = colOffsets.length - 1;
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;

    let direction: 'none' | 'down' | 'up' | 'right' | 'left' = 'none';
    let targetRow = sourceRange.endRow;
    let targetCol = sourceRange.endCol;

    const preview = document.createElement('div');
    preview.className = 'bg-fill-preview';
    preview.style.position = 'absolute';
    preview.style.pointerEvents = 'none';
    preview.style.boxSizing = 'border-box';
    preview.style.border = '2px dashed var(--bg-active-border, #1a73e8)';
    preview.style.background = 'rgba(33, 133, 208, 0.05)';
    preview.style.zIndex = '4';
    preview.style.display = 'none';
    this.overlay.appendChild(preview);

    const overlayRect = this.overlay.getBoundingClientRect();

    const findRow = (clientY: number): number => {
      const y = clientY - overlayRect.top;
      for (let r = 0; r < rowCount; r++) {
        if (rowOffsets[r]! <= y && y < rowOffsets[r + 1]!) return r;
      }
      return y < rowOffsets[0]! ? 0 : rowCount - 1;
    };

    const findCol = (clientX: number): number => {
      const x = clientX - overlayRect.left;
      for (let c = 0; c < colCount; c++) {
        if (colOffsets[c]! <= x && x < colOffsets[c + 1]!) return c;
      }
      return x < colOffsets[0]! ? 0 : colCount - 1;
    };

    const updatePreview = () => {
      let top: number, left: number, bottom: number, right: number;

      if (direction === 'down' && targetRow > sourceRange.endRow) {
        top = rowOffsets[sourceRange.endRow + 1]!;
        left = colOffsets[sourceRange.startCol]!;
        bottom = rowOffsets[targetRow + 1]!;
        right = colOffsets[sourceRange.endCol + 1]!;
      } else if (direction === 'up' && targetRow < sourceRange.startRow) {
        top = rowOffsets[targetRow]!;
        left = colOffsets[sourceRange.startCol]!;
        bottom = rowOffsets[sourceRange.startRow]!;
        right = colOffsets[sourceRange.endCol + 1]!;
      } else if (direction === 'right' && targetCol > sourceRange.endCol) {
        top = rowOffsets[sourceRange.startRow]!;
        left = colOffsets[sourceRange.endCol + 1]!;
        bottom = rowOffsets[sourceRange.endRow + 1]!;
        right = colOffsets[targetCol + 1]!;
      } else if (direction === 'left' && targetCol < sourceRange.startCol) {
        top = rowOffsets[sourceRange.startRow]!;
        left = colOffsets[targetCol]!;
        bottom = rowOffsets[sourceRange.endRow + 1]!;
        right = colOffsets[sourceRange.startCol]!;
      } else {
        preview.style.display = 'none';
        return;
      }

      preview.style.display = 'block';
      preview.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      preview.style.width = `${right - left}px`;
      preview.style.height = `${bottom - top}px`;
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Lock direction based on dominant axis (once threshold reached)
      if (direction === 'none' && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        if (Math.abs(dy) >= Math.abs(dx)) {
          direction = dy > 0 ? 'down' : 'up';
        } else {
          direction = dx > 0 ? 'right' : 'left';
        }
      }

      if (direction === 'down' || direction === 'up') {
        targetRow = findRow(e.clientY);
        if (direction === 'down') targetRow = Math.max(targetRow, sourceRange.endRow);
        if (direction === 'up') targetRow = Math.min(targetRow, sourceRange.startRow);
      } else if (direction === 'right' || direction === 'left') {
        targetCol = findCol(e.clientX);
        if (direction === 'right') targetCol = Math.max(targetCol, sourceRange.endCol);
        if (direction === 'left') targetCol = Math.min(targetCol, sourceRange.startCol);
      }

      updatePreview();
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      preview.remove();

      if (!this.onFillDrag) return;

      let target: CellRange | null = null;

      if (direction === 'down' && targetRow > sourceRange.endRow) {
        target = { startRow: sourceRange.endRow + 1, endRow: targetRow, startCol: sourceRange.startCol, endCol: sourceRange.endCol };
      } else if (direction === 'up' && targetRow < sourceRange.startRow) {
        target = { startRow: targetRow, endRow: sourceRange.startRow - 1, startCol: sourceRange.startCol, endCol: sourceRange.endCol };
      } else if (direction === 'right' && targetCol > sourceRange.endCol) {
        target = { startRow: sourceRange.startRow, endRow: sourceRange.endRow, startCol: sourceRange.endCol + 1, endCol: targetCol };
      } else if (direction === 'left' && targetCol < sourceRange.startCol) {
        target = { startRow: sourceRange.startRow, endRow: sourceRange.endRow, startCol: targetCol, endCol: sourceRange.startCol - 1 };
      }

      if (target) {
        this.onFillDrag({ sourceRange, targetRange: target });
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  destroy(): void {
    this.overlay.remove();
    this.fillHandle?.remove();
    this.rangeLayer.remove();
    this.handleLayer.remove();
  }
}
