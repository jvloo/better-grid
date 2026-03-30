// ============================================================================
// Clipboard Plugin — Copy, paste, and cut with TSV + HTML support
// ============================================================================

import type { GridPlugin, PluginContext, ColumnDef } from '@better-grid/core';

export interface ClipboardOptions {
  /** Include column headers when copying. Default: false */
  includeHeaders?: boolean;
  /** Column separator for TSV. Default: '\t' */
  separator?: string;
  /** Callback after copy */
  onCopy?: (data: string) => void;
  /** Callback after paste */
  onPaste?: (changes: Array<{ rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }>) => void;
}

export interface ClipboardApi {
  copy(): void;
  paste(): Promise<void>;
  cut(): void;
}

export function clipboard(options?: ClipboardOptions): GridPlugin<'clipboard'> {
  const config = {
    includeHeaders: options?.includeHeaders ?? false,
    separator: options?.separator ?? '\t',
    onCopy: options?.onCopy,
    onPaste: options?.onPaste,
  };

  return {
    id: 'clipboard',

    init(ctx: PluginContext) {
      // -------------------------------------------------------------------
      // Helpers
      // -------------------------------------------------------------------

      function getCellValue(row: unknown, column: ColumnDef): unknown {
        if (column.accessorFn) {
          return column.accessorFn(row as never, 0);
        }
        if (column.accessorKey) {
          return (row as Record<string, unknown>)[column.accessorKey];
        }
        return undefined;
      }

      function escapeHtml(str: string): string {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      /** Escape a cell value for TSV: if it contains tab, newline, or quote, wrap in quotes */
      function escapeTsv(value: string): string {
        if (value.includes(config.separator) || value.includes('\n') || value.includes('\r') || value.includes('"')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }

      /**
       * Collect the selected cell data as a 2D array of { rowIndex, colIndex, value }.
       * Normalizes all ranges so iteration is top-left to bottom-right.
       */
      function getSelectedData(): {
        rows: { rowIndex: number; cells: { colIndex: number; value: unknown }[] }[];
        columns: ColumnDef[];
      } | null {
        const state = ctx.grid.getState();
        const { selection } = state;

        if (!selection.ranges.length && !selection.active) return null;

        // Determine the bounding rectangle of all selected ranges
        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;

        const ranges = selection.ranges.length > 0
          ? selection.ranges
          : selection.active
            ? [{ startRow: selection.active.rowIndex, endRow: selection.active.rowIndex, startCol: selection.active.colIndex, endCol: selection.active.colIndex }]
            : [];

        if (ranges.length === 0) return null;

        // Build a set of selected cells for multi-range support
        const selectedCells = new Set<string>();
        for (const range of ranges) {
          const r1 = Math.min(range.startRow, range.endRow);
          const r2 = Math.max(range.startRow, range.endRow);
          const c1 = Math.min(range.startCol, range.endCol);
          const c2 = Math.max(range.startCol, range.endCol);
          minRow = Math.min(minRow, r1);
          maxRow = Math.max(maxRow, r2);
          minCol = Math.min(minCol, c1);
          maxCol = Math.max(maxCol, c2);
          for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
              selectedCells.add(`${r},${c}`);
            }
          }
        }

        const columns = state.columns.slice(minCol, maxCol + 1);
        const rows: { rowIndex: number; cells: { colIndex: number; value: unknown }[] }[] = [];

        for (let r = minRow; r <= maxRow; r++) {
          const row = state.data[r];
          if (!row) continue;
          const cells: { colIndex: number; value: unknown }[] = [];
          for (let c = minCol; c <= maxCol; c++) {
            if (selectedCells.has(`${r},${c}`)) {
              const col = state.columns[c];
              cells.push({ colIndex: c, value: col ? getCellValue(row, col) : undefined });
            } else {
              // Gap cell in multi-range — use empty string
              cells.push({ colIndex: c, value: '' });
            }
          }
          rows.push({ rowIndex: r, cells });
        }

        return { rows, columns };
      }

      // -------------------------------------------------------------------
      // Copy
      // -------------------------------------------------------------------

      function copy(): void {
        const selected = getSelectedData();
        if (!selected) return;

        const { rows, columns } = selected;
        const tsvLines: string[] = [];
        const htmlLines: string[] = [];

        // Header row
        if (config.includeHeaders) {
          const headerValues = columns.map((col) => {
            const h = col.header;
            return typeof h === 'function' ? '' : String(h ?? '');
          });
          tsvLines.push(headerValues.map(escapeTsv).join(config.separator));
          htmlLines.push('<tr>' + headerValues.map((v) => `<th>${escapeHtml(v)}</th>`).join('') + '</tr>');
        }

        // Data rows
        for (const row of rows) {
          const values = row.cells.map((cell) => {
            const v = cell.value;
            if (v == null) return '';
            return String(v);
          });
          tsvLines.push(values.map(escapeTsv).join(config.separator));
          htmlLines.push('<tr>' + values.map((v) => `<td>${escapeHtml(v)}</td>`).join('') + '</tr>');
        }

        const tsv = tsvLines.join('\n');
        const html = '<table>' + htmlLines.join('') + '</table>';

        // Write to clipboard with both text/plain and text/html
        try {
          const tsvBlob = new Blob([tsv], { type: 'text/plain' });
          const htmlBlob = new Blob([html], { type: 'text/html' });
          navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': tsvBlob,
              'text/html': htmlBlob,
            }),
          ]).catch(() => {
            // Fallback to writeText
            navigator.clipboard.writeText(tsv).catch(() => {
              // Silently fail if clipboard is not available
            });
          });
        } catch {
          // ClipboardItem not supported — fallback
          navigator.clipboard.writeText(tsv).catch(() => {
            // Silently fail
          });
        }

        config.onCopy?.(tsv);
      }

      // -------------------------------------------------------------------
      // Paste
      // -------------------------------------------------------------------

      async function paste(): Promise<void> {
        let text: string;
        try {
          text = await navigator.clipboard.readText();
        } catch {
          return; // Clipboard not available or permission denied
        }

        if (!text) return;

        const state = ctx.grid.getState();
        const { selection } = state;
        const active = selection.active;
        if (!active) return;

        // Parse TSV
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        // Remove trailing empty line (common when copying from spreadsheets)
        if (lines.length > 1 && lines[lines.length - 1] === '') {
          lines.pop();
        }

        const parsedRows = lines.map((line) => parseTsvLine(line, config.separator));

        const changes: Array<{ rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }> = [];

        for (let r = 0; r < parsedRows.length; r++) {
          const rowIndex = active.rowIndex + r;
          if (rowIndex >= state.data.length) break; // Don't exceed grid bounds

          const row = state.data[rowIndex];
          if (!row) continue;

          const cells = parsedRows[r]!;
          for (let c = 0; c < cells.length; c++) {
            const colIndex = active.colIndex + c;
            if (colIndex >= state.columns.length) break; // Don't exceed grid bounds

            const column = state.columns[colIndex]!;

            // Skip readonly columns
            if (column.editable === false) continue;

            const rawValue = cells[c]!;
            const oldValue = getCellValue(row, column);

            // Parse value using column's valueModifier if available
            let newValue: unknown;
            if (column.valueModifier?.parse) {
              try {
                const parsed = column.valueModifier.parse(rawValue);
                newValue = parsed !== undefined ? parsed : rawValue;
              } catch {
                newValue = rawValue;
              }
            } else {
              newValue = rawValue;
            }

            ctx.grid.updateCell(rowIndex, column.id, newValue);
            changes.push({ rowIndex, columnId: column.id, oldValue, newValue });
          }
        }

        if (changes.length > 0) {
          config.onPaste?.(changes);
        }
      }

      // -------------------------------------------------------------------
      // Cut
      // -------------------------------------------------------------------

      function cut(): void {
        // Copy first
        copy();

        // Then clear selected cells
        const state = ctx.grid.getState();
        const { selection } = state;

        const ranges = selection.ranges.length > 0
          ? selection.ranges
          : selection.active
            ? [{ startRow: selection.active.rowIndex, endRow: selection.active.rowIndex, startCol: selection.active.colIndex, endCol: selection.active.colIndex }]
            : [];

        for (const range of ranges) {
          const r1 = Math.min(range.startRow, range.endRow);
          const r2 = Math.max(range.startRow, range.endRow);
          const c1 = Math.min(range.startCol, range.endCol);
          const c2 = Math.max(range.startCol, range.endCol);

          for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
              const column = state.columns[c];
              if (!column) continue;
              if (column.editable === false) continue;

              // Clear to null — formatting plugins will handle display
              ctx.grid.updateCell(r, column.id, null);
            }
          }
        }
      }

      // -------------------------------------------------------------------
      // TSV line parser (handles quoted fields)
      // -------------------------------------------------------------------

      function parseTsvLine(line: string, separator: string): string[] {
        const cells: string[] = [];
        let i = 0;

        while (i <= line.length) {
          if (i === line.length) {
            // End of line after a separator — empty trailing cell
            // Only add if we've already started parsing (i.e., there was a separator before)
            break;
          }

          if (line[i] === '"') {
            // Quoted field
            let value = '';
            i++; // skip opening quote
            while (i < line.length) {
              if (line[i] === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                  // Escaped quote
                  value += '"';
                  i += 2;
                } else {
                  // End of quoted field
                  i++; // skip closing quote
                  break;
                }
              } else {
                value += line[i];
                i++;
              }
            }
            cells.push(value);
            // Skip separator after quoted field
            if (i < line.length && line[i] === separator) {
              i++;
            }
          } else {
            // Unquoted field
            const nextSep = line.indexOf(separator, i);
            if (nextSep === -1) {
              cells.push(line.substring(i));
              i = line.length;
            } else {
              cells.push(line.substring(i, nextSep));
              i = nextSep + separator.length;
              // If separator was the last thing, add empty cell
              if (i === line.length) {
                cells.push('');
              }
            }
          }
        }

        return cells;
      }

      // -------------------------------------------------------------------
      // Key bindings
      // -------------------------------------------------------------------

      const unbindCopy = ctx.registerKeyBinding({
        key: '*',
        priority: 5,
        handler: (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            event.preventDefault();
            copy();
            return true;
          }
          return false;
        },
      });

      const unbindPaste = ctx.registerKeyBinding({
        key: '*',
        priority: 5,
        handler: (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            event.preventDefault();
            paste();
            return true;
          }
          return false;
        },
      });

      const unbindCut = ctx.registerKeyBinding({
        key: '*',
        priority: 5,
        handler: (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
            event.preventDefault();
            cut();
            return true;
          }
          return false;
        },
      });

      // -------------------------------------------------------------------
      // API
      // -------------------------------------------------------------------

      const api: ClipboardApi = {
        copy,
        paste,
        cut,
      };

      ctx.expose(api);

      return () => {
        unbindCopy();
        unbindPaste();
        unbindCut();
      };
    },
  };
}
