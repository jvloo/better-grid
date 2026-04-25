// ============================================================================
// Clipboard Plugin — Copy, paste, cut + Pro fill-down/right/series & rich paste
// ============================================================================

import type { GridPlugin, PluginContext, ColumnDef, CellRange } from '@better-grid/core';
import { escapeXml, getCellValue } from '@better-grid/core';

export interface ClipboardOptions {
  /** Include column headers when copying. Default: false */
  includeHeaders?: boolean;
  /** Column separator for TSV. Default: '\t' */
  separator?: string;
  /** Enable Ctrl+D fill-down. Default: true */
  fillDown?: boolean;
  /** Enable Ctrl+R fill-right. Default: true */
  fillRight?: boolean;
  /** Enable smart fill-series on drag handle. Default: true */
  fillHandle?: boolean;
  /** Enable rich HTML paste from Excel. Default: true */
  richPaste?: boolean;
  /** Callback after copy */
  onCopy?: (data: string) => void;
  /** Callback after paste */
  onPaste?: (changes: Array<{ rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }>) => void;
  /** Callback after fill operation */
  onFill?: (changes: Array<{ rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }>) => void;
}

export interface ClipboardApi {
  copy(): void;
  paste(): Promise<void>;
  cut(): void;
  fillDown(): void;
  fillRight(): void;
}

// ============================================================================
// Series Detection Engine
// ============================================================================

type SeriesType = 'constant' | 'linear' | 'date' | 'textNumber' | 'repeat';

interface SeriesPattern {
  type: SeriesType;
  /** Generate the next value at the given absolute index (0-based from source start) */
  generate(index: number): unknown;
}

/** Detect a pattern from an array of source values */
function detectSeries(values: unknown[]): SeriesPattern {
  if (values.length === 0) {
    return { type: 'constant', generate: () => undefined };
  }

  if (values.length === 1) {
    // Single value — constant fill (same as copy)
    const v = values[0];
    return { type: 'constant', generate: () => v };
  }

  // Try numeric linear series (e.g. 1,2,3 or 10,20,30)
  const numericPattern = detectNumericSeries(values);
  if (numericPattern) return numericPattern;

  // Try date series (e.g. 2024-01-01, 2024-01-02, ...)
  const datePattern = detectDateSeries(values);
  if (datePattern) return datePattern;

  // Try text-with-number series (e.g. "Item 1", "Item 2", ...)
  const textNumPattern = detectTextNumberSeries(values);
  if (textNumPattern) return textNumPattern;

  // Fallback: repeat pattern (cycle through values)
  return {
    type: 'repeat',
    generate: (index: number) => values[index % values.length],
  };
}

function detectNumericSeries(values: unknown[]): SeriesPattern | null {
  // All values must be numbers
  const nums: number[] = [];
  for (const v of values) {
    if (typeof v !== 'number' || isNaN(v)) return null;
    nums.push(v);
  }

  // Check constant difference (linear series)
  const diff = nums[1]! - nums[0]!;
  let isLinear = true;
  for (let i = 2; i < nums.length; i++) {
    if (Math.abs((nums[i]! - nums[i - 1]!) - diff) > 1e-10) {
      isLinear = false;
      break;
    }
  }

  if (isLinear) {
    const start = nums[0]!;
    return {
      type: 'linear',
      generate: (index: number) => start + diff * index,
    };
  }

  return null;
}

function detectDateSeries(values: unknown[]): SeriesPattern | null {
  const dates: Date[] = [];
  const origStrings: string[] = [];
  for (const v of values) {
    if (typeof v !== 'string') return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    dates.push(d);
    origStrings.push(v);
  }

  if (dates.length < 2) return null;

  // Detect interval in milliseconds
  const interval = dates[1]!.getTime() - dates[0]!.getTime();
  if (interval === 0) return null;

  let isConstantInterval = true;
  for (let i = 2; i < dates.length; i++) {
    const diff = dates[i]!.getTime() - dates[i - 1]!.getTime();
    // Allow 1 hour tolerance for DST transitions
    if (Math.abs(diff - interval) > 3600000) {
      isConstantInterval = false;
      break;
    }
  }

  if (!isConstantInterval) return null;

  // Detect format from first value
  const isIso = /^\d{4}-\d{2}-\d{2}/.test(origStrings[0]!);
  const startTime = dates[0]!.getTime();

  return {
    type: 'date',
    generate: (index: number) => {
      const d = new Date(startTime + interval * index);
      if (isIso) {
        return d.toISOString().slice(0, 10);
      }
      return d.toLocaleDateString();
    },
  };
}

function detectTextNumberSeries(values: unknown[]): SeriesPattern | null {
  // Match patterns like "Item 1", "Row 2", "Q3", "Step 10"
  const textNumRegex = /^(.*?)(\d+)(\D*)$/;
  const parts: Array<{ prefix: string; num: number; suffix: string }> = [];

  for (const v of values) {
    if (typeof v !== 'string') return null;
    const match = v.match(textNumRegex);
    if (!match) return null;
    parts.push({ prefix: match[1]!, num: parseInt(match[2]!, 10), suffix: match[3]! });
  }

  // All prefixes and suffixes must match
  const prefix = parts[0]!.prefix;
  const suffix = parts[0]!.suffix;
  for (let i = 1; i < parts.length; i++) {
    if (parts[i]!.prefix !== prefix || parts[i]!.suffix !== suffix) return null;
  }

  // Check for linear increment in the number part
  const nums = parts.map((p) => p.num);
  const diff = nums[1]! - nums[0]!;
  if (diff === 0) return null;

  let isLinear = true;
  for (let i = 2; i < nums.length; i++) {
    if (nums[i]! - nums[i - 1]! !== diff) {
      isLinear = false;
      break;
    }
  }

  if (!isLinear) return null;

  const startNum = nums[0]!;
  return {
    type: 'textNumber',
    generate: (index: number) => `${prefix}${startNum + diff * index}${suffix}`,
  };
}

// ============================================================================
// HTML Table Parser (for Excel rich paste)
// ============================================================================

function parseHtmlTable(html: string): string[][] | null {
  // Try to extract table content from HTML
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;

  const tableHtml = tableMatch[1]!;
  const rows: string[][] = [];

  // Match all rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1]!;
    const cells: string[] = [];

    // Match all cells (td or th)
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      let cellContent = cellMatch[1]!;
      // Strip nested HTML tags
      cellContent = cellContent.replace(/<[^>]*>/g, '');
      // Decode HTML entities
      cellContent = decodeHtmlEntities(cellContent);
      // Trim whitespace
      cellContent = cellContent.trim();
      cells.push(cellContent);
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows.length > 0 ? rows : null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

// ============================================================================
// Plugin
// ============================================================================

export const CLIPBOARD_ERROR_CODES = {
  READ_ONLY_COLUMN: 'READ_ONLY_COLUMN',
  PASTE_SHAPE_MISMATCH: 'PASTE_SHAPE_MISMATCH',
  CLIPBOARD_UNAVAILABLE: 'CLIPBOARD_UNAVAILABLE',
} as const;

export function clipboard(options?: ClipboardOptions): GridPlugin<'clipboard', ClipboardApi> {
  const config = {
    includeHeaders: options?.includeHeaders ?? false,
    separator: options?.separator ?? '\t',
    fillDown: options?.fillDown ?? true,
    fillRight: options?.fillRight ?? true,
    fillHandle: options?.fillHandle ?? true,
    richPaste: options?.richPaste ?? true,
    onCopy: options?.onCopy,
    onPaste: options?.onPaste,
    onFill: options?.onFill,
  };

  return {
    id: 'clipboard',
    $errorCodes: CLIPBOARD_ERROR_CODES,

    init(ctx: PluginContext) {
      // -------------------------------------------------------------------
      // Helpers
      // -------------------------------------------------------------------

      /** Parse a pasted string value into the column's expected data type */
      function parsePasteValue(raw: string, column: ColumnDef, oldValue: unknown): unknown {
        // Custom valueParser takes priority
        if (column.valueParser) {
          try {
            const parsed = column.valueParser(raw);
            if (parsed !== undefined) return parsed;
          } catch { /* fall through */ }
        }

        const ct = column.cellType;

        // Number types: strip formatting characters, parse to number
        if (ct === 'number' || ct === 'currency') {
          const cleaned = raw.replace(/[^0-9.\-]/g, '');
          if (cleaned === '' || cleaned === '-') return oldValue;
          const num = Number(cleaned);
          return isNaN(num) ? oldValue : num;
        }

        if (ct === 'percent') {
          const cleaned = raw.replace(/[^0-9.\-]/g, '');
          if (cleaned === '' || cleaned === '-') return oldValue;
          const num = Number(cleaned);
          if (isNaN(num)) return oldValue;
          // If pasted value looks like "5%" or "5", convert to decimal (0.05)
          return num > 1 ? num / 100 : num;
        }

        if (ct === 'bigint') {
          const cleaned = raw.replace(/[^0-9\-]/g, '');
          if (cleaned === '' || cleaned === '-') return oldValue;
          try { return BigInt(cleaned); } catch { return oldValue; }
        }

        if (ct === 'date') {
          if (raw.trim() === '') return oldValue;
          const d = new Date(raw);
          return isNaN(d.getTime()) ? oldValue : raw;
        }

        if (ct === 'boolean' || typeof oldValue === 'boolean') {
          const lower = raw.toLowerCase().trim();
          if (['yes', 'y', 'true', '1'].includes(lower)) return true;
          if (['no', 'n', 'false', '0'].includes(lower)) return false;
          return oldValue;
        }

        // Infer from existing value type
        if (typeof oldValue === 'number') {
          const num = Number(raw.replace(/[^0-9.\-]/g, ''));
          return isNaN(num) ? raw : num;
        }

        return raw;
      }

      /** Escape a cell value for TSV: if it contains tab, newline, or quote, wrap in quotes */
      function escapeTsv(value: string): string {
        if (value.includes(config.separator) || value.includes('\n') || value.includes('\r') || value.includes('"')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }

      /** Get the effective selection ranges */
      function getSelectionRanges(): CellRange[] {
        const state = ctx.grid.getState();
        const { selection } = state;
        if (selection.ranges.length > 0) return selection.ranges;
        if (selection.active) {
          return [{
            startRow: selection.active.rowIndex,
            endRow: selection.active.rowIndex,
            startCol: selection.active.colIndex,
            endCol: selection.active.colIndex,
          }];
        }
        return [];
      }

      /** Get the bounding rect of all selection ranges */
      function getSelectionBounds(): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
        const ranges = getSelectionRanges();
        if (ranges.length === 0) return null;

        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        for (const range of ranges) {
          const r1 = Math.min(range.startRow, range.endRow);
          const r2 = Math.max(range.startRow, range.endRow);
          const c1 = Math.min(range.startCol, range.endCol);
          const c2 = Math.max(range.startCol, range.endCol);
          minRow = Math.min(minRow, r1);
          maxRow = Math.max(maxRow, r2);
          minCol = Math.min(minCol, c1);
          maxCol = Math.max(maxCol, c2);
        }
        return { minRow, maxRow, minCol, maxCol };
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

        const bounds = getSelectionBounds();
        if (!bounds) return null;
        const { minRow, maxRow, minCol, maxCol } = bounds;

        // Build a set of selected cells for multi-range support
        const selectedCells = new Set<string>();
        const ranges = getSelectionRanges();
        for (const range of ranges) {
          const r1 = Math.min(range.startRow, range.endRow);
          const r2 = Math.max(range.startRow, range.endRow);
          const c1 = Math.min(range.startCol, range.endCol);
          const c2 = Math.max(range.startCol, range.endCol);
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
          htmlLines.push('<tr>' + headerValues.map((v) => `<th>${escapeXml(v)}</th>`).join('') + '</tr>');
        }

        // Data rows
        for (const row of rows) {
          const values = row.cells.map((cell) => {
            const v = cell.value;
            if (v == null) return '';
            return String(v);
          });
          tsvLines.push(values.map(escapeTsv).join(config.separator));
          htmlLines.push('<tr>' + values.map((v) => `<td>${escapeXml(v)}</td>`).join('') + '</tr>');
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
      // Paste (with rich HTML support)
      // -------------------------------------------------------------------

      async function paste(): Promise<void> {
        const state = ctx.grid.getState();
        const { selection } = state;
        const active = selection.active;
        if (!active) return;

        let parsedRows: string[][] | null = null;

        // Try rich paste from HTML first (Excel/Sheets)
        if (config.richPaste) {
          try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              if (item.types.includes('text/html')) {
                const htmlBlob = await item.getType('text/html');
                const html = await htmlBlob.text();
                parsedRows = parseHtmlTable(html);
                if (parsedRows) break;
              }
            }
          } catch {
            // Clipboard.read() not available or permission denied — fall through to text
          }
        }

        // Fallback to plain text TSV
        if (!parsedRows) {
          let text: string;
          try {
            text = await navigator.clipboard.readText();
          } catch {
            return; // Clipboard not available or permission denied
          }
          if (!text) return;

          const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          if (lines.length > 1 && lines[lines.length - 1] === '') {
            lines.pop();
          }
          parsedRows = lines.map((line) => parseTsvLine(line, config.separator));
        }

        if (!parsedRows || parsedRows.length === 0) return;

        const changes: Array<{ rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }> = [];

        for (let r = 0; r < parsedRows.length; r++) {
          const rowIndex = active.rowIndex + r;
          if (rowIndex >= state.data.length) break;

          const row = state.data[rowIndex];
          if (!row) continue;

          const cells = parsedRows[r]!;
          for (let c = 0; c < cells.length; c++) {
            const colIndex = active.colIndex + c;
            if (colIndex >= state.columns.length) break;

            const column = state.columns[colIndex]!;
            if (column.editable === false) continue;

            const rawValue = cells[c]!;
            const oldValue = getCellValue(row, column);
            const newValue = parsePasteValue(rawValue, column, oldValue);

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
        copy();

        const state = ctx.grid.getState();
        const ranges = getSelectionRanges();

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
              ctx.grid.updateCell(r, column.id, null);
            }
          }
        }
      }

      // -------------------------------------------------------------------
      // Fill Down (Ctrl+D)
      // -------------------------------------------------------------------

      function fillDown(): void {
        const bounds = getSelectionBounds();
        if (!bounds) return;
        const { minRow, maxRow, minCol, maxCol } = bounds;
        if (minRow === maxRow) return; // Need at least 2 rows

        const state = ctx.grid.getState();
        const changes: Array<{ rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }> = [];

        for (let c = minCol; c <= maxCol; c++) {
          const column = state.columns[c];
          if (!column || column.editable === false) continue;

          // Get the value from the top row
          const sourceRow = state.data[minRow];
          if (!sourceRow) continue;
          const sourceValue = getCellValue(sourceRow, column);

          // Fill down to all rows below
          for (let r = minRow + 1; r <= maxRow; r++) {
            const row = state.data[r];
            if (!row) continue;
            const oldValue = getCellValue(row, column);
            ctx.grid.updateCell(r, column.id, sourceValue);
            changes.push({ rowIndex: r, columnId: column.id, oldValue, newValue: sourceValue });
          }
        }

        if (changes.length > 0) {
          config.onFill?.(changes);
          config.onPaste?.(changes);
        }
      }

      // -------------------------------------------------------------------
      // Fill Right (Ctrl+R)
      // -------------------------------------------------------------------

      function fillRight(): void {
        const bounds = getSelectionBounds();
        if (!bounds) return;
        const { minRow, maxRow, minCol, maxCol } = bounds;
        if (minCol === maxCol) return; // Need at least 2 columns

        const state = ctx.grid.getState();
        const changes: Array<{ rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }> = [];

        for (let r = minRow; r <= maxRow; r++) {
          const row = state.data[r];
          if (!row) continue;

          // Get the value from the leftmost column
          const sourceColumn = state.columns[minCol];
          if (!sourceColumn) continue;
          const sourceValue = getCellValue(row, sourceColumn);

          // Fill right to all columns
          for (let c = minCol + 1; c <= maxCol; c++) {
            const column = state.columns[c];
            if (!column || column.editable === false) continue;
            const oldValue = getCellValue(row, column);
            ctx.grid.updateCell(r, column.id, sourceValue);
            changes.push({ rowIndex: r, columnId: column.id, oldValue, newValue: sourceValue });
          }
        }

        if (changes.length > 0) {
          config.onFill?.(changes);
          config.onPaste?.(changes);
        }
      }

      // -------------------------------------------------------------------
      // Fill Series (drag handle) — intercepts core fill:execute event
      // -------------------------------------------------------------------

      let unbindFillExecute: (() => void) | undefined;

      if (config.fillHandle) {
        unbindFillExecute = ctx.on('fill:execute' as 'mount', ((event: { sourceRange: CellRange; targetRange: CellRange; handled: boolean }) => {
          event.handled = true; // Prevent core default fill

          const state = ctx.grid.getState();
          const columns = state.columns;
          const { sourceRange, targetRange } = event;
          const isVertical = targetRange.startCol === sourceRange.startCol && targetRange.endCol === sourceRange.endCol;
          const isHorizontal = targetRange.startRow === sourceRange.startRow && targetRange.endRow === sourceRange.endRow;

          const changes: Array<{ rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }> = [];

          if (isVertical) {
            // For each column, detect series pattern and generate values
            for (let col = sourceRange.startCol; col <= sourceRange.endCol; col++) {
              const column = columns[col];
              if (!column || column.editable === false) continue;

              // Collect source values
              const sourceValues: unknown[] = [];
              for (let r = sourceRange.startRow; r <= sourceRange.endRow; r++) {
                const row = state.data[r];
                if (!row) { sourceValues.push(undefined); continue; }
                sourceValues.push(getCellValue(row, column));
              }

              const pattern = detectSeries(sourceValues);
              const sourceCount = sourceRange.endRow - sourceRange.startRow + 1;

              // Determine if filling down or up
              const fillingDown = targetRange.startRow > sourceRange.endRow;

              for (let r = targetRange.startRow; r <= targetRange.endRow; r++) {
                const row = state.data[r];
                if (!row) continue;

                let index: number;
                if (fillingDown) {
                  // Continue from end of source
                  index = sourceCount + (r - targetRange.startRow);
                } else {
                  // Filling up — go backwards from source start
                  index = -(sourceRange.startRow - r);
                }

                const newValue = pattern.generate(index);
                const oldValue = getCellValue(row, column);
                ctx.grid.updateCell(r, column.id, newValue);
                changes.push({ rowIndex: r, columnId: column.id, oldValue, newValue });
              }
            }
          } else if (isHorizontal) {
            // For each row, detect series pattern across columns and generate
            for (let r = sourceRange.startRow; r <= sourceRange.endRow; r++) {
              const row = state.data[r];
              if (!row) continue;

              // Collect source values across columns
              const sourceValues: unknown[] = [];
              for (let c = sourceRange.startCol; c <= sourceRange.endCol; c++) {
                const col = columns[c];
                if (!col) { sourceValues.push(undefined); continue; }
                sourceValues.push(getCellValue(row, col));
              }

              const pattern = detectSeries(sourceValues);
              const sourceCount = sourceRange.endCol - sourceRange.startCol + 1;

              const fillingRight = targetRange.startCol > sourceRange.endCol;

              for (let c = targetRange.startCol; c <= targetRange.endCol; c++) {
                const column = columns[c];
                if (!column || column.editable === false) continue;

                let index: number;
                if (fillingRight) {
                  index = sourceCount + (c - targetRange.startCol);
                } else {
                  index = -(sourceRange.startCol - c);
                }

                const newValue = pattern.generate(index);
                const oldValue = getCellValue(row, column);
                ctx.grid.updateCell(r, column.id, newValue);
                changes.push({ rowIndex: r, columnId: column.id, oldValue, newValue });
              }
            }
          }

          if (changes.length > 0) {
            config.onFill?.(changes);
          }
        }) as () => void);
      }

      // -------------------------------------------------------------------
      // TSV line parser (handles quoted fields)
      // -------------------------------------------------------------------

      function parseTsvLine(line: string, separator: string): string[] {
        const cells: string[] = [];
        let i = 0;

        while (i <= line.length) {
          if (i === line.length) {
            break;
          }

          if (line[i] === '"') {
            // Quoted field
            let value = '';
            i++; // skip opening quote
            while (i < line.length) {
              if (line[i] === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                  value += '"';
                  i += 2;
                } else {
                  i++;
                  break;
                }
              } else {
                value += line[i];
                i++;
              }
            }
            cells.push(value);
            if (i < line.length && line[i] === separator) {
              i++;
            }
          } else {
            const nextSep = line.indexOf(separator, i);
            if (nextSep === -1) {
              cells.push(line.substring(i));
              i = line.length;
            } else {
              cells.push(line.substring(i, nextSep));
              i = nextSep + separator.length;
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

      // Fill Down — Ctrl+D
      let unbindFillDown: (() => void) | undefined;
      if (config.fillDown) {
        unbindFillDown = ctx.registerKeyBinding({
          key: '*',
          priority: 6,
          handler: (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
              event.preventDefault();
              fillDown();
              return true;
            }
            return false;
          },
        });
      }

      // Fill Right — Ctrl+R
      let unbindFillRight: (() => void) | undefined;
      if (config.fillRight) {
        unbindFillRight = ctx.registerKeyBinding({
          key: '*',
          priority: 6,
          handler: (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
              event.preventDefault();
              fillRight();
              return true;
            }
            return false;
          },
        });
      }

      // -------------------------------------------------------------------
      // API
      // -------------------------------------------------------------------

      const api: ClipboardApi = {
        copy,
        paste,
        cut,
        fillDown,
        fillRight,
      };

      ctx.expose(api);

      return () => {
        unbindCopy();
        unbindPaste();
        unbindCut();
        unbindFillDown?.();
        unbindFillRight?.();
        unbindFillExecute?.();
      };
    },
  };
}
