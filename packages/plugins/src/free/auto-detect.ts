// ============================================================================
// Auto-Detect Plugin — Infer cellType, editor, and alignment from data values
// ============================================================================

import type { GridPlugin, PluginContext, ColumnDef } from '@better-grid/core';
import { getCellValue } from '@better-grid/core';

export interface AutoDetectOptions {
  /** Number of rows to sample for detection. Default: 50 */
  sampleSize?: number;
  /** Whether to set alignment automatically. Default: true */
  autoAlign?: boolean;
}

interface DetectedType {
  cellType?: string;
  align?: 'left' | 'center' | 'right';
}

export function autoDetect(options?: AutoDetectOptions): GridPlugin<'auto-detect'> {
  const sampleSize = options?.sampleSize ?? 50;
  const autoAlign = options?.autoAlign ?? true;

  return {
    id: 'auto-detect',
    init(ctx: PluginContext) {
      const state = ctx.grid.getState();
      const data = state.data;

      if (data.length === 0) return;

      const sample = data.slice(0, Math.min(sampleSize, data.length));

      // applyAutoDetect() is called once at init time and again from the
      // 'columns:set' subscriber below, which re-applies detection whenever
      // grid.setColumns() is called (e.g. the React adapter's useEffect on first
      // render). setColumns() creates fresh spread-copies of every ColumnDef via
      // normalizeColumn(), discarding the mutations applied here — the subscriber
      // ensures they are re-applied to the new column references.
      //
      // The __autoDetected sentinel prevents double-applying on the same reference.
      const applyAutoDetect = (cols: (ColumnDef & { id: string })[]): void => {
        let changed = false;

        for (const col of cols) {
          // Skip columns already processed (sentinel guards against double-apply)
          if ((col as { __autoDetected?: boolean }).__autoDetected) continue;

          // Skip columns that already have an explicit cellType
          if (col.cellType) continue;

          // Collect non-null values from the sample
          const values = sample
            .map((row) => getCellValue(row, col))
            .filter((v) => v != null);

          if (values.length === 0) continue;

          const detected = detectType(values);
          if (detected) {
            if (detected.cellType && !col.cellType) {
              (col as ColumnDef & { cellType: string }).cellType = detected.cellType;
              changed = true;
            }
            if (detected.align && !col.align && autoAlign) {
              (col as ColumnDef & { align: 'left' | 'center' | 'right' }).align = detected.align;
              changed = true;
            }
            // Mark this column as processed so subsequent setColumns() calls
            // that pass the same object reference skip it.
            (col as { __autoDetected?: boolean }).__autoDetected = true;
          }
        }

        if (changed) {
          // Force column update to trigger re-render
          ctx.store.update('columns', () => ({ columns: [...cols] }));
        }
      };

      applyAutoDetect(ctx.store.getState().columns);

      // Re-apply detection whenever grid.setColumns() is called. The React
      // adapter (and any other caller) calls setColumns() after createGrid —
      // normalizeColumn() creates fresh ColumnDef spread-copies for every column,
      // discarding the cellType/align mutations applied above. Subscribing here
      // re-applies them to the new column references so inferred types survive
      // the React useEffect mount call.
      ctx.on('columns:set', applyAutoDetect);
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
