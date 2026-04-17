// ============================================================================
// Pinned Row Renderer — renders pinned top / pinned bottom rows
//
// Extracted from grid.ts. Pinned rows are always re-rendered in full (they're
// typically 1-3 rows, virtualization overhead isn't worth it). This renderer
// shares the cellType registry with the main RenderingPipeline so custom cell
// renderers (badge, progress, currency, etc.) work in pinned rows too.
// ============================================================================

import type { CellRenderContext, ColumnDef, RowStylesConfig } from '../types';
import type { LayoutMeasurements } from '../virtualization/engine';
import type { RenderingPipeline } from './pipeline';
import { snapToDevicePixel } from '../utils';

export interface PinnedRowRendererDeps<TData = unknown> {
  /** Shared cell-type registry (for custom cellRenderer lookup) */
  rendering: RenderingPipeline<TData>;
  /** Row height (pixels); defaults to 32 if undefined */
  rowHeight?: number | ((rowIndex: number) => number);
  /** Optional row-level style presets (from GridOptions.rowStyles) */
  rowStyles?: RowStylesConfig<TData>;
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
  function render(
    pinnedContainer: HTMLElement,
    rows: readonly TData[],
    columns: readonly ColumnDef<TData>[],
    measurements: LayoutMeasurements,
    startCol?: number,
    endCol?: number,
  ): void {
    pinnedContainer.innerHTML = '';
    const colStart = startCol ?? 0;
    const colEnd = endCol ?? columns.length;
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
        cell.style.position = 'absolute';
        cell.style.transform = `translate3d(${left}px, ${snapToDevicePixel(top)}px, 0)`;
        cell.style.width = `${width}px`;
        cell.style.height = `${rowH}px`;
        cell.style.lineHeight = `${rowH}px`;
        cell.style.textAlign = column.align ?? '';
        cell.style.verticalAlign = column.verticalAlign ?? '';

        const value = column.accessorFn
          ? column.accessorFn(rowData, rowIdx)
          : column.accessorKey
            ? (rowData as Record<string, unknown>)[column.accessorKey]
            : undefined;

        const context: CellRenderContext<TData> = {
          rowIndex: rowIdx,
          colIndex: col,
          row: rowData,
          column,
          value,
          isSelected: false,
          isActive: false,
          style: { top, left, width, height: rowH },
        };

        // Render priority: column renderer > cell type > valueModifier > default text
        const hidden = column.hideZero && value === 0;
        if (hidden) {
          // skip content
        } else if (column.cellRenderer) {
          column.cellRenderer(cell, context);
        } else if (column.cellType && deps.rendering.getCellType(column.cellType)) {
          deps.rendering.getCellType(column.cellType)!.render(cell, context as CellRenderContext);
        } else if (column.valueModifier?.format) {
          cell.textContent = column.valueModifier.format(value);
        } else {
          cell.textContent = value != null ? String(value) : '';
        }

        // Apply row-level style presets
        if (deps.rowStyles) {
          const fieldVal = String((rowData as Record<string, unknown>)[deps.rowStyles.field] ?? '');
          const rs = deps.rowStyles.styles[fieldVal];
          if (rs) Object.assign(cell.style, rs);
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
