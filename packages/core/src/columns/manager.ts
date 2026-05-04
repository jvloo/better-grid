// ============================================================================
// Column Manager — Column definitions, widths, and value access
// ============================================================================

import type { ColumnDef } from '../types';
import { computeColumnWidths } from '../virtualization/layout';

// Minimal ambient `process` declaration so bundlers can statically dead-code
// eliminate dev-mode warnings when consumers build with NODE_ENV=production.
// Avoids pulling in @types/node for a library target.
declare const process: { env: { NODE_ENV?: string } };

const DEFAULT_WIDTH = 100;
const DEFAULT_MIN_WIDTH = 50;
const DEFAULT_MAX_WIDTH = 300;

export interface ColumnManagerOptions {
  defaultMinWidth?: number;
  defaultMaxWidth?: number;
}

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

  constructor(private readonly options: ColumnManagerOptions = {}) {}

  private getDefaultMinWidth(): number {
    return this.options.defaultMinWidth ?? DEFAULT_MIN_WIDTH;
  }

  private getDefaultMaxWidth(): number {
    return this.options.defaultMaxWidth ?? DEFAULT_MAX_WIDTH;
  }

  private getMinWidth(col: NormalizedColumnDef<TData>): number {
    if (col.minWidth != null) return col.minWidth;
    if (col.resizable === false && col.width != null) return col.width;
    return this.getDefaultMinWidth();
  }

  private getMaxWidth(col: NormalizedColumnDef<TData>): number {
    return col.maxWidth ?? this.getDefaultMaxWidth();
  }

  private clampWidth(col: NormalizedColumnDef<TData>, width: number): number {
    const min = Math.max(0, this.getMinWidth(col));
    const max = Math.max(min, this.getMaxWidth(col));
    return Math.max(min, Math.min(max, width));
  }

  setColumns(columns: ColumnDef<TData>[]): void {
    // Normalize id: default to field when omitted; throw when both are absent.
    const idResolved = columns.map((col) => normalizeColumn(col));

    // Dev-mode: detect duplicate column ids after normalization
    if (process.env.NODE_ENV !== 'production') {
      const seen = new Set<string>();
      for (const col of idResolved) {
        if (seen.has(col.id)) {
          throw new Error(
            `[better-grid] Duplicate column id: "${col.id}". Each column must have a unique id.`,
          );
        }
        seen.add(col.id);
      }
    }

    // Normalize columns: default field, validate widths
    this.allColumns = idResolved.map((col) => {
      const withField =
        !col.field && !col.valueGetter ? { ...col, field: col.id as keyof TData & string } : col;

      // Validate width constraints
      const min = withField.minWidth ?? this.getDefaultMinWidth();
      const max = withField.maxWidth ?? this.getDefaultMaxWidth();
      if (Number.isFinite(max) && min > max) {
        console.warn(
          `[better-grid] Column "${withField.id}": minWidth (${min}) > maxWidth (${max})`,
        );
      }

      return withField;
    });
    this.recomputeVisible();
  }

  private recomputeVisible(): void {
    this.visibleColumns = this.allColumns.filter((c) => c.hide !== true);
    this.widths = this.visibleColumns.map((col) =>
      this.clampWidth(col, col.width ?? DEFAULT_WIDTH),
    );
    this.readonlyCols.clear();
    for (let i = 0; i < this.visibleColumns.length; i++) {
      if (this.visibleColumns[i]?.editable === false) this.readonlyCols.add(i);
    }
  }

  /**
   * Recompute widths using flex distribution.
   * Call this whenever the viewport width is known (after mount, on resize, on
   * setColumns / setColumnHidden). No-op when no column has a flex value set.
   */
  recomputeFlexWidths(viewportWidth: number): void {
    const hasFlex = this.visibleColumns.some((c) => (c.flex ?? 0) > 0);
    if (!hasFlex) return;
    this.widths = computeColumnWidths({
      columns: this.visibleColumns.map((col) => ({
        ...col,
        minWidth: this.getMinWidth(col),
        maxWidth: this.getMaxWidth(col),
      })),
      viewportWidth,
    });
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
  validateAgainstSample(originalColumns: ColumnDef<TData>[], sampleRow: TData): void {
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

  /**
   * Initial width as declared in the original `ColumnDef.width`. Used by
   * the resize-handle dblclick reset path so the column can revert to the
   * value the consumer asked for, rather than to DEFAULT_WIDTH or the
   * flex-distributed value computed at mount.
   */
  getInitialWidth(index: number): number {
    const col = this.visibleColumns[index];
    if (!col) return DEFAULT_WIDTH;
    const declared = col.width ?? DEFAULT_WIDTH;
    return this.clampWidth(col, declared);
  }

  getWidths(): number[] {
    return this.widths;
  }

  setWidth(index: number, width: number): void {
    const col = this.visibleColumns[index];
    if (!col) return;
    this.widths[index] = this.clampWidth(col, width);
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
