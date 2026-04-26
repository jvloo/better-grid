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

/**
 * Narrowed column type with `id` guaranteed to be a string.
 * All columns stored internally must satisfy this type.
 */
export type NormalizedColumnDef<TData> = ColumnDef<TData> & { id: string };

/**
 * Resolve a column's stable id from `id` → `field` fallback.
 * Throws at normalization time when neither is provided.
 */
function normalizeColumn<TData>(col: ColumnDef<TData>): NormalizedColumnDef<TData> {
  const id = col.id ?? col.field;
  if (!id) {
    throw new Error('[better-grid] Column must have either id or field.');
  }
  return { ...col, id };
}

export class ColumnManager<TData = unknown> {
  /** All columns (including hidden) in original order. */
  private allColumns: NormalizedColumnDef<TData>[] = [];
  /** Visible-only subset — what renderers see. Index-parallel to widths + readonlyCols. */
  private visibleColumns: NormalizedColumnDef<TData>[] = [];
  private widths: number[] = [];
  private readonlyCols = new Set<number>();

  setColumns(columns: ColumnDef<TData>[]): void {
    // Normalize id: default to field when omitted; throw when both are absent.
    const idResolved = columns.map((col) => normalizeColumn(col));

    // Dev-mode: detect duplicate column ids after normalization
    if (process.env.NODE_ENV !== 'production') {
      const seen = new Set<string>();
      for (const col of idResolved) {
        if (seen.has(col.id)) {
          throw new Error(`[better-grid] Duplicate column id: "${col.id}". Each column must have a unique id.`);
        }
        seen.add(col.id);
      }
    }

    // Normalize columns: default field, validate widths
    this.allColumns = idResolved.map((col) => {
      const withField = !col.field && !col.valueGetter
        ? { ...col, field: col.id as keyof TData & string }
        : col;

      // Validate width constraints
      if (withField.minWidth && withField.maxWidth && withField.minWidth > withField.maxWidth) {
        console.warn(`[better-grid] Column "${withField.id}": minWidth (${withField.minWidth}) > maxWidth (${withField.maxWidth})`);
      }

      return withField;
    });
    this.recomputeVisible();
  }

  private recomputeVisible(): void {
    this.visibleColumns = this.allColumns.filter((c) => c.hide !== true);
    this.widths = this.visibleColumns.map((col) => col.width ?? DEFAULT_WIDTH);
    this.readonlyCols.clear();
    for (let i = 0; i < this.visibleColumns.length; i++) {
      if (this.visibleColumns[i]?.editable === false) this.readonlyCols.add(i);
    }
  }

  setColumnHidden(columnId: string, hide: boolean): void {
    const col = this.allColumns.find((c) => c.id === columnId);
    if (!col) return;
    if (col.hide === hide) return;
    col.hide = hide;
    this.recomputeVisible();
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

  /** Renderer-facing: returns only visible (non-hidden) columns. */
  getColumns(): NormalizedColumnDef<TData>[] {
    return this.visibleColumns;
  }

  /** Returns all columns, including hidden ones, in original order. */
  getAllColumns(): NormalizedColumnDef<TData>[] {
    return this.allColumns;
  }

  /** Index is relative to visible columns. */
  getColumn(index: number): NormalizedColumnDef<TData> | undefined {
    return this.visibleColumns[index];
  }

  /** Searches visible columns only. Hidden columns cannot be looked up by id here. */
  getColumnById(id: string): NormalizedColumnDef<TData> | undefined {
    return this.visibleColumns.find((c) => c.id === id);
  }

  /** Returns the visible-index of a column, or -1 if hidden/not found. */
  getColumnIndex(id: string): number {
    return this.visibleColumns.findIndex((c) => c.id === id);
  }

  /** Count of visible columns. */
  getColumnCount(): number {
    return this.visibleColumns.length;
  }

  getWidth(index: number): number {
    return this.widths[index] ?? DEFAULT_WIDTH;
  }

  getWidths(): number[] {
    return this.widths;
  }

  setWidth(index: number, width: number): void {
    const col = this.visibleColumns[index];
    if (!col) return;
    const min = col.minWidth ?? DEFAULT_MIN_WIDTH;
    const max = col.maxWidth ?? Infinity;
    this.widths[index] = Math.max(min, Math.min(max, width));
  }

  /** Extract a cell value from a row using the column's accessor (colIndex is visible-indexed). */
  getCellValue(row: TData, colIndex: number): unknown {
    const col = this.visibleColumns[colIndex];
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
