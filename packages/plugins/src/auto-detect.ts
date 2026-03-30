// ============================================================================
// Auto-Detect Plugin — Infer cellType, editor, and alignment from data values
// ============================================================================

import type { GridPlugin, PluginContext, ColumnDef } from '@better-grid/core';

export interface AutoDetectOptions {
  /** Number of rows to sample for detection. Default: 50 */
  sampleSize?: number;
  /** Whether to set alignment automatically. Default: true */
  autoAlign?: boolean;
}

interface DetectedType {
  cellType?: string;
  align?: string;
}

export function autoDetect(options?: AutoDetectOptions): GridPlugin<'auto-detect'> {
  const sampleSize = options?.sampleSize ?? 50;
  const autoAlign = options?.autoAlign ?? true;

  return {
    id: 'auto-detect',
    init(ctx: PluginContext) {
      const state = ctx.grid.getState();
      const data = state.data;
      const columns = state.columns;

      if (data.length === 0) return;

      const sample = data.slice(0, Math.min(sampleSize, data.length));
      let changed = false;

      for (const col of columns) {
        // Skip columns that already have explicit cellType
        if (col.cellType) continue;

        // Collect non-null values from the sample
        const values = sample
          .map((row) => {
            if (col.accessorFn) return col.accessorFn(row as never, 0);
            if (col.accessorKey) return (row as Record<string, unknown>)[col.accessorKey];
            return undefined;
          })
          .filter((v) => v != null);

        if (values.length === 0) continue;

        const detected = detectType(values);
        if (detected) {
          if (detected.cellType && !col.cellType) {
            (col as ColumnDef & { cellType: string }).cellType = detected.cellType;
            changed = true;
          }
          if (detected.align && !col.align && autoAlign) {
            (col as ColumnDef & { align: string }).align = detected.align;
            changed = true;
          }
        }
      }

      if (changed) {
        // Force column update to trigger re-render
        ctx.store.update('columns', () => ({ columns: [...columns] }));
      }
    },
  };
}

function detectType(values: unknown[]): DetectedType | null {
  let boolCount = 0;
  let numberCount = 0;
  let dateCount = 0;
  let stringCount = 0;

  for (const v of values) {
    if (typeof v === 'boolean') {
      boolCount++;
    } else if (typeof v === 'number') {
      numberCount++;
    } else if (v instanceof Date) {
      dateCount++;
    } else if (typeof v === 'string') {
      if (isDateString(v)) {
        dateCount++;
      } else {
        stringCount++;
      }
    }
  }

  const total = values.length;
  const threshold = 0.7; // 70% of values must be the same type

  if (boolCount / total >= threshold) {
    return { cellType: 'boolean', align: 'center' };
  }
  if (numberCount / total >= threshold) {
    return { cellType: 'number', align: 'right' };
  }
  if (dateCount / total >= threshold) {
    return { cellType: 'date' };
  }

  // For strings, no special cellType needed (default behavior)
  return null;
}

function isDateString(v: string): boolean {
  // ISO: 2026-01-15 or 2026-01-15T...
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return true;
  // US: 01/15/2026
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return true;
  return false;
}
