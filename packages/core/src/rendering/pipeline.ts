// ============================================================================
// Rendering Pipeline — DOM-based cell rendering with pooling
// ============================================================================

import type { CellRenderContext, CellRenderer, CellTypeRenderer, ColumnDef, Selection } from '../types';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCellRenderContext = CellRenderContext<any>;
import type { LayoutMeasurements } from '../virtualization/engine';
import { isCellActive, isCellInSelection } from '../selection/model';
import { snapToDevicePixel } from '../utils';

export class RenderingPipeline<TData = unknown> {
  private cellPool = new Map<string, HTMLElement>();
  private cleanupFns = new Map<string, () => void>();
  private cellTypes = new Map<string, CellTypeRenderer>();
  private globalCellRenderer: CellRenderer<TData> | null = null;
  /** Frozen cells keyed by "row:col" with their base left offset */
  private frozenCells = new Map<string, { element: HTMLElement; baseLeft: number; top: number }>();

  setGlobalCellRenderer(renderer: CellRenderer<TData> | null): void {
    this.globalCellRenderer = renderer;
  }

  registerCellType(type: string, renderer: CellTypeRenderer): () => void {
    this.cellTypes.set(type, renderer);
    return () => {
      this.cellTypes.delete(type);
    };
  }

  getCellType(type: string): CellTypeRenderer | undefined {
    return this.cellTypes.get(type);
  }

  /** Render visible cells into a container element */
  renderCells(
    container: HTMLElement,
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
    data: TData[],
    columns: ColumnDef<TData>[],
    measurements: LayoutMeasurements,
    selection: Selection,
    frozenLeftColumns = 0,
    scrollLeft = 0,
    frozenTopRows = 0,
  ): void {
    const visibleKeys = new Set<string>();

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const key = `${row}:${col}`;
        visibleKeys.add(key);

        let cell = this.cellPool.get(key);
        if (!cell) {
          cell = document.createElement('div');
          cell.className = 'bg-cell';
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          container.appendChild(cell);
          this.cellPool.set(key, cell);
        }

        // Position — snap to device pixel boundaries for crisp rendering at all zoom levels
        const top = snapToDevicePixel(measurements.rowOffsets[row]!);
        const left = snapToDevicePixel(measurements.colOffsets[col]!);
        const height = snapToDevicePixel(measurements.rowOffsets[row + 1]!) - top;
        const width = snapToDevicePixel(measurements.colOffsets[col + 1]!) - left;

        cell.style.position = 'absolute';
        cell.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        cell.style.width = `${width}px`;
        cell.style.height = `${height}px`;
        cell.style.lineHeight = `${height}px`;

        // Frozen left columns: offset by scrollLeft to keep them visible
        if (col < frozenLeftColumns) {
          cell.classList.add('bg-cell--frozen-left');
          cell.style.transform = `translate3d(${snapToDevicePixel(left + scrollLeft)}px, ${top}px, 0)`;
          this.frozenCells.set(key, { element: cell, baseLeft: left, top });
        } else {
          cell.classList.remove('bg-cell--frozen-left');
          this.frozenCells.delete(key);
        }

        // Last frozen column/row border emphasis
        cell.classList.toggle('bg-cell--frozen-col-last', col === frozenLeftColumns - 1);
        cell.classList.toggle('bg-cell--frozen-row-last', frozenTopRows > 0 && row === frozenTopRows - 1);

        // Selection classes
        const selected = isCellInSelection(row, col, selection);
        const active = isCellActive(row, col, selection);
        cell.classList.toggle('bg-cell--selected', selected);
        cell.classList.toggle('bg-cell--active', active);

        // Build context
        const column = columns[col]!;
        const rowData = data[row]!;
        const value = column.accessorFn
          ? column.accessorFn(rowData, row)
          : column.accessorKey
            ? (rowData as Record<string, unknown>)[column.accessorKey]
            : undefined;

        const context: CellRenderContext<TData> = {
          rowIndex: row,
          colIndex: col,
          row: rowData,
          column,
          value,
          isSelected: selected,
          isActive: active,
          style: { top, left, width, height },
        };

        // Cleanup previous render
        this.cleanupFns.get(key)?.();

        // Render priority: column renderer > cell type > global > default text
        let cleanup: void | (() => void) = undefined;
        if (column.cellRenderer) {
          cleanup = column.cellRenderer(cell, context);
        } else if (column.cellType && this.cellTypes.has(column.cellType)) {
          cleanup = this.cellTypes.get(column.cellType)!.render(cell, context as AnyCellRenderContext);
        } else if (this.globalCellRenderer) {
          cleanup = this.globalCellRenderer(cell, context);
        } else {
          cell.textContent = value != null ? String(value) : '';
        }

        if (cleanup) {
          this.cleanupFns.set(key, cleanup);
        }

      }
    }

    // Remove cells no longer visible
    for (const [key, element] of this.cellPool) {
      if (!visibleKeys.has(key)) {
        this.cleanupFns.get(key)?.();
        this.cleanupFns.delete(key);
        element.remove();
        this.cellPool.delete(key);
      }
    }
  }

  /** Synchronously update frozen cell positions — call from scroll handler to avoid lag */
  updateFrozenPositions(scrollLeft: number): void {
    for (const { element, baseLeft, top } of this.frozenCells.values()) {
      element.style.transform = `translate3d(${snapToDevicePixel(baseLeft + scrollLeft)}px, ${top}px, 0)`;
    }
  }

  /** Clear all rendered cells */
  clear(): void {
    for (const [key, element] of this.cellPool) {
      this.cleanupFns.get(key)?.();
      element.remove();
    }
    this.frozenCells.clear();
    this.cellPool.clear();
    this.cleanupFns.clear();
  }
}
