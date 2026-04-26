// ============================================================================
// Column Manager — Column definitions, widths, and value access
// ============================================================================

import type { ColumnDef } from '../types';

// Minimal ambient `process` declaration so bundlers can statically dead-code
// eliminate dev-mode warnings when consumers build with NODE_ENV=production.
// Avoids pulling in @types/node for a library target.
declare const process: { env: { NODE_ENV?: string } };

const DEFAULT_WIDTH = 100;
const DEFAULT_MIN_WIDTH = 50;

export class ColumnManager<TData = unknown> {
  private columns: ColumnDef<TData>[] = [];
  private widths: number[] = [];
  private readonlyCols = new Set<number>();

  setColumns(columns: ColumnDef<TData>[]): void {
    // Dev-mode: detect duplicate column ids before normalization
    if (process.env.NODE_ENV !== 'production') {
      const seen = new Set<string>();
      for (const col of columns) {
        if (seen.has(col.id)) {
          throw new Error(`[better-grid] Duplicate column id: "${col.id}". Each column must have a unique id.`);
        }
        seen.add(col.id);
      }
    }

    // Normalize columns: default field, validate widths
    this.columns = columns.map((col) => {
      const normalized = !col.field && !col.valueGetter
        ? { ...col, field: col.id as keyof TData & string }
        : col;

      // Validate width constraints
      if (normalized.minWidth && normalized.maxWidth && normalized.minWidth > normalized.maxWidth) {
        console.warn(`[better-grid] Column "${col.id}": minWidth (${normalized.minWidth}) > maxWidth (${normalized.maxWidth})`);
      }

      return normalized;
    });
    this.widths = this.columns.map((col) => col.width ?? DEFAULT_WIDTH);
    this.readonlyCols.clear();
    for (let i = 0; i < this.columns.length; i++) {
      if (this.columns[i]?.editable === false) this.readonlyCols.add(i);
    }
  }

  /**
   * Dev-mode validation: warn when a column's `field` doesn't exist on a sample row.
   * Skips columns that use `valueGetter` (explicit opt-out) and columns where field
   * matches the column id (auto-fill in setColumns — user didn't pick it explicitly).
   *
   * Pass the user's original column defs so we can tell which fields were user-provided
   * vs auto-filled. The sample row is typically `options.data[0]`.
   */
  validateAgainstSample(
    originalColumns: ColumnDef<TData>[],
    sampleRow: TData,
  ): void {
    if (process.env.NODE_ENV === 'production') return;
    if (sampleRow == null || typeof sampleRow !== 'object') return;

    const rowKeys = new Set(Object.keys(sampleRow as Record<string, unknown>));
    for (const col of originalColumns) {
      if (col.valueGetter) continue; // Opting out of key-based access
      if (!col.field) continue; // No key provided, will auto-fill from id
      // Auto-fill fallthrough: skip when field === id (user didn't pick it explicitly)
      if (col.field === col.id) continue;
      if (!rowKeys.has(col.field)) {
        console.warn(
          `[better-grid] Column "${col.id}": field "${col.field}" not found on the first data row.`,
        );
      }
    }
  }

  getReadonlyColumns(): Set<number> {
    return this.readonlyCols;
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

    if (col.valueGetter) {
      return col.valueGetter(row, colIndex);
    }
    if (col.field) {
      return (row as Record<string, unknown>)[col.field];
    }
    return undefined;
  }
}
