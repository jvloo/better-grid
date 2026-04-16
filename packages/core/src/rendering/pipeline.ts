// ============================================================================
// Rendering Pipeline — DOM-based cell rendering with pooling
// ============================================================================

import type { CellRenderContext, CellRenderer, CellTypeRenderer, ColumnDef, Selection } from '../types';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCellRenderContext = CellRenderContext<any>;
import type { LayoutMeasurements } from '../virtualization/engine';
import { isCellActive, isCellInSelection } from '../selection/model';
import { snapToDevicePixel } from '../utils';

// Encode row:col into a single number to avoid string allocation per cell
const MAX_COLS = 16384; // 2^14 — supports up to 16K columns
function cellKey(row: number, col: number): number {
  return row * MAX_COLS + col;
}

export class RenderingPipeline<TData = unknown> {
  private cellPool = new Map<number, HTMLElement>();
  private cleanupFns = new Map<number, () => void>();
  private cellTypes = new Map<string, CellTypeRenderer>();
  private globalCellRenderer: CellRenderer<TData> | null = null;
  /** Frozen cells keyed by numeric key with their base left offset */
  private frozenCells = new Map<number, { element: HTMLElement; baseLeft: number; top: number }>();
  /** Recycled DOM elements ready for reuse — avoids remove()/appendChild() churn */
  private recyclePool: HTMLElement[] = [];
  /** Row style presets from GridOptions.rowStyles */
  rowStyles: { field: string; styles: Record<string, Record<string, string>> } | undefined;

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
    const visibleKeys = new Set<number>();

    // Phase 1: Collect cells to visible set, identify which are new
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        visibleKeys.add(cellKey(row, col));
      }
    }

    // Phase 2: Recycle cells no longer visible (keep in DOM, move to recycle pool)
    for (const [key, element] of this.cellPool) {
      if (!visibleKeys.has(key)) {
        this.cleanupFns.get(key)?.();
        this.cleanupFns.delete(key);
        this.frozenCells.delete(key);
        this.recyclePool.push(element);
        this.cellPool.delete(key);
      }
    }

    // Phase 3: Render visible cells, reusing recycled elements
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const key = cellKey(row, col);

        let cell = this.cellPool.get(key);
        if (!cell) {
          // Reuse a recycled element (already in DOM) or create new
          cell = this.recyclePool.pop() ?? null;
          if (cell) {
            // Reset recycled element — clear stale inline styles from plugins
            cell.className = 'bg-cell';
            cell.style.cssText = 'position: absolute';
          } else {
            cell = document.createElement('div');
            cell.className = 'bg-cell';
            cell.style.position = 'absolute';
            container.appendChild(cell);
          }
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.dataset.rowEven = row % 2 === 0 ? '1' : '0';
          this.cellPool.set(key, cell);
        }

        // Position — snap to device pixel boundaries for crisp rendering at all zoom levels
        const top = snapToDevicePixel(measurements.rowOffsets[row]!);
        const left = snapToDevicePixel(measurements.colOffsets[col]!);
        const height = snapToDevicePixel(measurements.rowOffsets[row + 1]!) - top;
        const width = snapToDevicePixel(measurements.colOffsets[col + 1]!) - left;

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

        // Apply column-level alignment before render (renderer can override)
        cell.style.textAlign = column.align ?? '';
        cell.style.verticalAlign = column.verticalAlign ?? '';
        // Flex-compatible alignment (for themes that set display:flex on cells)
        if (column.align === 'center') cell.style.justifyContent = 'center';
        else if (column.align === 'right') cell.style.justifyContent = 'flex-end';
        else cell.style.justifyContent = '';

        // Render priority: column renderer > cell type > global > default text
        let cleanup: void | (() => void) = undefined;
        if (column.cellRenderer) {
          cleanup = column.cellRenderer(cell, context);
        } else if (column.cellType && this.cellTypes.has(column.cellType)) {
          cleanup = this.cellTypes.get(column.cellType)!.render(cell, context as AnyCellRenderContext);
        } else if (this.globalCellRenderer) {
          cleanup = this.globalCellRenderer(cell, context);
        } else if (column.valueModifier?.format) {
          cell.textContent = column.valueModifier.format(value);
        } else {
          cell.textContent = value != null ? String(value) : '';
        }

        if (cleanup) {
          this.cleanupFns.set(key, cleanup);
        }

        // Apply row-level style presets (rowStyles) before column cellStyle
        if (this.rowStyles) {
          const fieldVal = String((rowData as Record<string, unknown>)[this.rowStyles.field] ?? '');
          const rs = this.rowStyles.styles[fieldVal];
          if (rs) Object.assign(cell.style, rs);
        }

        // Apply conditional cellStyle / cellClass after rendering
        if (column.cellStyle) {
          const styles = column.cellStyle(value, rowData);
          if (styles) Object.assign(cell.style, styles);
        }
        if (column.cellClass) {
          const cls = column.cellClass(value, rowData);
          if (cls) cell.className += ' ' + cls;
        }

      }
    }

    // Phase 4: Remove excess recycled elements from DOM (only if pool is oversized)
    while (this.recyclePool.length > 0) {
      this.recyclePool.pop()!.remove();
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
    for (const el of this.recyclePool) el.remove();
    this.recyclePool.length = 0;
    this.frozenCells.clear();
    this.cellPool.clear();
    this.cleanupFns.clear();
  }
}
