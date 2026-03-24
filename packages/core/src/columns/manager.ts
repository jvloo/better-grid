// ============================================================================
// Column Manager — Column definitions, widths, and value access
// ============================================================================

import type { ColumnDef } from '../types';

const DEFAULT_WIDTH = 100;
const DEFAULT_MIN_WIDTH = 50;

export class ColumnManager<TData = unknown> {
  private columns: ColumnDef<TData>[] = [];
  private widths: number[] = [];

  setColumns(columns: ColumnDef<TData>[]): void {
    this.columns = columns;
    this.widths = columns.map((col) => col.width ?? DEFAULT_WIDTH);
  }

  getColumns(): ColumnDef<TData>[] {
    return this.columns;
  }

  getColumn(index: number): ColumnDef<TData> | undefined {
    return this.columns[index];
  }

  getColumnById(id: string): ColumnDef<TData> | undefined {
    return this.columns.find((c) => c.id === id);
  }

  getColumnIndex(id: string): number {
    return this.columns.findIndex((c) => c.id === id);
  }

  getColumnCount(): number {
    return this.columns.length;
  }

  getWidth(index: number): number {
    return this.widths[index] ?? DEFAULT_WIDTH;
  }

  getWidths(): number[] {
    return this.widths;
  }

  setWidth(index: number, width: number): void {
    const col = this.columns[index];
    if (!col) return;
    const min = col.minWidth ?? DEFAULT_MIN_WIDTH;
    const max = col.maxWidth ?? Infinity;
    this.widths[index] = Math.max(min, Math.min(max, width));
  }

  /** Extract a cell value from a row using the column's accessor */
  getCellValue(row: TData, colIndex: number): unknown {
    const col = this.columns[colIndex];
    if (!col) return undefined;

    if (col.accessorFn) {
      return col.accessorFn(row, colIndex);
    }
    if (col.accessorKey) {
      return (row as Record<string, unknown>)[col.accessorKey];
    }
    return undefined;
  }
}
