// ============================================================================
// Export Plugin — CSV export + structured data for external pipelines
// ============================================================================

import type { GridPlugin, PluginContext } from '@better-grid/core';
import type { ColumnDef } from '@better-grid/core';

export interface ExportOptions {
  /** Default filename (without extension). Default: 'export' */
  filename?: string;
  /** CSV separator. Default: ',' */
  csvSeparator?: string;
  /** Include column headers. Default: true */
  includeHeaders?: boolean;
}

export interface ExportCell {
  value: unknown;
  formattedValue: string;
  columnId: string;
  colSpan?: number;
  rowSpan?: number;
}

export interface ExportData {
  headers: string[];
  rows: ExportCell[][];
  pinnedTopRows: ExportCell[][];
  pinnedBottomRows: ExportCell[][];
}

export interface ExportApi {
  /** Export to CSV and trigger download */
  exportToCsv(options?: { filename?: string; separator?: string }): void;
  /** Get structured export data for custom pipelines (ExcelJS, jsPDF, etc.) */
  getExportData(options?: { includeHeaders?: boolean; visibleOnly?: boolean }): ExportData;
  /** Export to CSV string (no download) */
  toCsvString(options?: { separator?: string }): string;
}

export function exportPlugin(options?: ExportOptions): GridPlugin<'export'> {
  const config = {
    filename: options?.filename ?? 'export',
    csvSeparator: options?.csvSeparator ?? ',',
    includeHeaders: options?.includeHeaders ?? true,
  };

  return {
    id: 'export',
    init(ctx: PluginContext) {

      function getCellValue(row: unknown, column: ColumnDef): unknown {
        if (column.accessorFn) return column.accessorFn(row as never, 0);
        if (column.accessorKey) return (row as Record<string, unknown>)[column.accessorKey];
        return undefined;
      }

      function formatCell(value: unknown, column: ColumnDef): string {
        if (column.valueModifier?.format) return column.valueModifier.format(value);
        return value != null ? String(value) : '';
      }

      function buildExportCell(row: unknown, column: ColumnDef): ExportCell {
        const value = getCellValue(row, column);
        return {
          value,
          formattedValue: formatCell(value, column),
          columnId: column.id,
        };
      }

      function getExportData(opts?: { includeHeaders?: boolean; visibleOnly?: boolean }): ExportData {
        const state = ctx.grid.getState();
        const columns = state.columns;
        const data = state.data;
        const includeH = opts?.includeHeaders ?? config.includeHeaders;

        const headers = includeH ? columns.map(c => {
          if (typeof c.header === 'function') {
            const result = c.header();
            return typeof result === 'string' ? result : c.id;
          }
          return c.header;
        }) : [];

        const rows = data.map(row =>
          columns.map(col => buildExportCell(row, col))
        );

        const pinnedTopRows = (state.pinnedTopRows ?? []).map(row =>
          columns.map(col => buildExportCell(row, col))
        );

        const pinnedBottomRows = (state.pinnedBottomRows ?? []).map(row =>
          columns.map(col => buildExportCell(row, col))
        );

        return { headers, rows, pinnedTopRows, pinnedBottomRows };
      }

      function escapeCsv(value: string, separator: string): string {
        if (value.includes(separator) || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }

      function toCsvString(opts?: { separator?: string }): string {
        const sep = opts?.separator ?? config.csvSeparator;
        const exportData = getExportData();
        const lines: string[] = [];

        if (exportData.headers.length > 0) {
          lines.push(exportData.headers.map(h => escapeCsv(h, sep)).join(sep));
        }

        for (const row of exportData.pinnedTopRows) {
          lines.push(row.map(c => escapeCsv(c.formattedValue, sep)).join(sep));
        }

        for (const row of exportData.rows) {
          lines.push(row.map(c => escapeCsv(c.formattedValue, sep)).join(sep));
        }

        for (const row of exportData.pinnedBottomRows) {
          lines.push(row.map(c => escapeCsv(c.formattedValue, sep)).join(sep));
        }

        return lines.join('\n');
      }

      function exportToCsv(opts?: { filename?: string; separator?: string }): void {
        const csv = toCsvString({ separator: opts?.separator });
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (opts?.filename ?? config.filename) + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      }

      const api: ExportApi = {
        exportToCsv,
        getExportData,
        toCsvString,
      };

      ctx.expose(api);
    },
  };
}
