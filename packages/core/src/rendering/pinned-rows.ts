// ============================================================================
// Pinned Row Renderer — renders pinned top / pinned bottom rows
//
// Extracted from grid.ts. Pinned rows are always re-rendered in full (they're
// typically 1-3 rows, virtualization overhead isn't worth it). This renderer
// shares the cellType registry with the main RenderingPipeline so custom cell
// renderers (badge, progress, currency, etc.) work in pinned rows too.
// ============================================================================

import type { CellRenderContext, ColumnDef } from '../types';
import type { LayoutMeasurements } from '../virtualization/engine';
import type { RenderingPipeline } from './pipeline';
import { getCellValue, snapToDevicePixel } from '../utils';

export interface PinnedRowRendererDeps<TData = unknown> {
  /** Shared cell-type registry (for custom cellRenderer lookup) */
  rendering: RenderingPipeline<TData>;
  /** Row height (pixels); defaults to 32 if undefined */
  rowHeight?: number | ((rowIndex: number) => number);
  /** Live context ref — read every render so handler swaps don't require re-init. */
  contextRef?: { current: unknown };
}

export interface PinnedRowRenderer<TData = unknown> {
  /**
   * Render the given pinned rows into the container.
   * @param pinnedContainer  DOM host element (innerHTML is cleared first)
   * @param rows             Data rows to render
   * @param columns          Column definitions for positioning and rendering
   * @param measurements     Layout measurements (col offsets)
   * @param startCol         Inclusive start column (default: 0)
   * @param endCol           Exclusive end column (default: columns.length)
   */
  render(
    pinnedContainer: HTMLElement,
    rows: readonly TData[],
    columns: readonly ColumnDef<TData>[],
    measurements: LayoutMeasurements,
    startCol?: number,
    endCol?: number,
  ): void;
}

const DEFAULT_ROW_HEIGHT = 40;

export function getPinnedRowsHeight(
  rowCount: number,
  rowHeight: number | ((rowIndex: number) => number) | undefined,
): number {
  const h = typeof rowHeight === 'number' ? rowHeight : DEFAULT_ROW_HEIGHT;
  return rowCount * h;
}

export function createPinnedRowRenderer<TData = unknown>(
  deps: PinnedRowRendererDeps<TData>,
): PinnedRowRenderer<TData> {
  // Change-detection cache: skip the full innerHTML='' + rebuild when none of
  // the inputs that affect output have changed. With ~3 pinned rows × 60 cols,
  // each call previously created ~180 fresh DOM nodes — re-rendering on every
  // scroll tick is wasteful when only the main pipeline actually moved.
  let lastContainer: HTMLElement | null = null;
  let lastRows: readonly TData[] | null = null;
  let lastColumns: readonly ColumnDef<TData>[] | null = null;
  let lastMeasurements: LayoutMeasurements | null = null;
  let lastTotalWidth = -1;
  let lastColStart = -1;
  let lastColEnd = -1;

  function render(
    pinnedContainer: HTMLElement,
    rows: readonly TData[],
    columns: readonly ColumnDef<TData>[],
    measurements: LayoutMeasurements,
    startCol?: number,
    endCol?: number,
  ): void {
    const colStart = startCol ?? 0;
    const colEnd = endCol ?? columns.length;

    // Identity-compare upstream inputs (the grid retains these across frames
    // and only swaps the references when they actually change). totalWidth +
    // colOffsets length cover the column-resize case where the array identity
    // is reused but cell widths shift.
    const totalWidth = measurements.colOffsets[measurements.colOffsets.length - 1] ?? 0;
    if (
      lastContainer === pinnedContainer &&
      lastRows === rows &&
      lastColumns === columns &&
      lastMeasurements === measurements &&
      lastTotalWidth === totalWidth &&
      lastColStart === colStart &&
      lastColEnd === colEnd
    ) {
      return;
    }
    lastContainer = pinnedContainer;
    lastRows = rows;
    lastColumns = columns;
    lastMeasurements = measurements;
    lastTotalWidth = totalWidth;
    lastColStart = colStart;
    lastColEnd = colEnd;

    pinnedContainer.innerHTML = '';
    if (rows.length === 0) return;

    const rowH = typeof deps.rowHeight === 'number' ? deps.rowHeight : DEFAULT_ROW_HEIGHT;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const rowData = rows[rowIdx]!;
      const top = rowIdx * rowH;

      for (let col = colStart; col < colEnd; col++) {
        const column = columns[col]!;
        const left = snapToDevicePixel(measurements.colOffsets[col]!);
        const width = snapToDevicePixel(measurements.colOffsets[col + 1]!) - left;

        const cell = document.createElement('div');
        cell.className = 'bg-cell bg-cell--pinned';
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-colindex', String(col + 1));
        cell.style.position = 'absolute';
        cell.style.transform = `translate3d(${left}px, ${snapToDevicePixel(top)}px, 0)`;
        cell.style.width = `${width}px`;
        cell.style.height = `${rowH}px`;
        cell.style.lineHeight = `${rowH}px`;
        cell.style.textAlign = column.align ?? '';
        cell.style.verticalAlign = column.verticalAlign ?? '';

        const value = getCellValue(rowData, column, rowIdx);

        const context: CellRenderContext<TData> = {
          rowIndex: rowIdx,
          colIndex: col,
          row: rowData,
          column,
          value,
          isSelected: false,
          isActive: false,
          style: { top, left, width, height: rowH },
          context: deps.contextRef?.current,
        };

        // Render priority: column renderer > cell type > valueFormatter > default text
        const hidden = column.hideZero && value === 0;
        if (hidden) {
          // skip content
        } else if (column.cellRenderer) {
          column.cellRenderer(cell, context);
        } else if (column.cellType && deps.rendering.getCellType(column.cellType)) {
          deps.rendering.getCellType(column.cellType)!.render(cell, context as CellRenderContext);
        } else if (column.valueFormatter) {
          cell.textContent = column.valueFormatter(value);
        } else {
          cell.textContent = value != null ? String(value) : '';
        }

        // Apply conditional cellStyle / cellClass
        if (column.cellStyle) {
          const styles = column.cellStyle(value, rowData);
          if (styles) Object.assign(cell.style, styles);
        }
        if (column.cellClass) {
          const cls = column.cellClass(value, rowData);
          if (cls) cell.className += ' ' + cls;
        }

        pinnedContainer.appendChild(cell);
      }
    }
  }

  return { render };
}
