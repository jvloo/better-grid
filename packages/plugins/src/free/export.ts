// ============================================================================
// Export Plugin — CSV & Excel export with full grid feature support
//
// Soft dependencies (detected at runtime via ctx.getPluginApi, falls back if absent):
//   - 'formatting': if present, uses formatValue() for cell text; otherwise raw values
//   - 'mergeCells':  if present, preserves merged ranges in Excel output
// ============================================================================

import type { GridPlugin, PluginContext, ColumnDef } from '@better-grid/core';

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
  /** Column type hint for downstream processors (ExcelJS, etc.) */
  type?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean' | 'change';
  /** Column alignment */
  align?: 'left' | 'center' | 'right';
  /** Inline styles from cellStyle function (if any) */
  style?: Record<string, string>;
  /** Whether this is a pinned/summary row */
  pinned?: boolean;
  /** Whether this column is frozen */
  frozen?: boolean;
}

export interface ExportHeaderCell {
  value: string;
  colSpan?: number;
  rowSpan?: number;
}

export interface ExportMerge {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface ExportData {
  /** Multi-level header rows (with colSpan/rowSpan). Falls back to single row from column headers. */
  headerRows: ExportHeaderCell[][];
  /** Main data rows */
  rows: ExportCell[][];
  /** Pinned top rows */
  pinnedTopRows: ExportCell[][];
  /** Pinned bottom rows */
  pinnedBottomRows: ExportCell[][];
  /** Column metadata for downstream formatting */
  columns: {
    id: string;
    header: string;
    type?: string;
    align?: string;
    width?: number;
    frozen?: boolean;
  }[];
  /** Body cell merges from mergeCells plugin (if active) */
  merges: ExportMerge[];
}

export interface ExportApi {
  /** Export to CSV and trigger download */
  exportToCsv(options?: { filename?: string; separator?: string }): void;
  /** Export to Excel (.xlsx) and trigger download. Requires no external deps — uses OOXML directly. */
  exportToExcel(options?: { filename?: string }): void;
  /** Get structured export data for custom pipelines (ExcelJS, jsPDF, etc.) */
  getExportData(options?: { includeHeaders?: boolean; visibleOnly?: boolean }): ExportData;
  /** Export to CSV string (no download) */
  toCsvString(options?: { separator?: string }): string;
}

export function exportPlugin(options?: ExportOptions): GridPlugin<'export', ExportApi> {
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

      function resolveType(column: ColumnDef, value: unknown): ExportCell['type'] {
        const ct = column.cellType;
        if (ct === 'currency') return 'currency';
        if (ct === 'change' || ct === 'changeIndicator') return 'change';
        if (ct === 'number' || ct === 'bigint') return 'number';
        if (ct === 'percent') return 'percent';
        if (ct === 'date') return 'date';
        if (ct === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        return 'text';
      }

      function formatCell(value: unknown, column: ColumnDef): string {
        // Use formatting plugin if available
        const fmtApi = ctx.getPluginApi<{ formatValue: (v: unknown, t: string, c: ColumnDef) => string }>('formatting');
        if (fmtApi && column.cellType) {
          return fmtApi.formatValue(value, column.cellType, column as never);
        }
        if (column.valueFormatter) return column.valueFormatter(value);
        if (column.hideZero && value === 0) return '';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        return value != null ? String(value) : '';
      }

      function resolveOptionLabel(value: unknown, column: ColumnDef): string | null {
        if (!column.options) return null;
        for (const opt of column.options) {
          if (typeof opt === 'object' && opt !== null && 'value' in opt) {
            if (opt.value === value) return opt.label;
          }
        }
        return null;
      }

      function buildExportCell(row: unknown, column: ColumnDef, colIdx: number, isPinned: boolean): ExportCell {
        const value = getCellValue(row, column);
        const state = ctx.grid.getState();
        const frozenCols = state.frozenLeftColumns;

        // For badge/select types, use the option label as formatted value
        const optLabel = resolveOptionLabel(value, column);

        const cell: ExportCell = {
          value,
          formattedValue: optLabel ?? formatCell(value, column),
          columnId: column.id,
          type: resolveType(column, value),
          align: column.align,
          frozen: colIdx < frozenCols,
          pinned: isPinned,
        };

        // Compute conditional styles
        if (column.cellStyle) {
          const s = column.cellStyle(value, row);
          if (s) cell.style = s;
        }

        return cell;
      }

      function resolveHeaderText(content: string | (() => HTMLElement | string)): string {
        if (typeof content === 'function') {
          const result = content();
          return typeof result === 'string' ? result : '';
        }
        return content;
      }

      function getExportData(opts?: { includeHeaders?: boolean }): ExportData {
        const state = ctx.grid.getState();
        const columns = state.columns;
        const data = state.data;
        const includeH = opts?.includeHeaders ?? config.includeHeaders;
        const frozenCols = state.frozenLeftColumns;

        // Build header rows
        const headerRows: ExportHeaderCell[][] = [];
        if (includeH) {
          // Use multi-level headerRows if available
          const multiHeaders = ctx.grid.getHeaderLayout();

          if (multiHeaders && multiHeaders.length > 0) {
            for (const hr of multiHeaders) {
              const row: ExportHeaderCell[] = [];
              for (const cell of hr.cells) {
                row.push({
                  value: resolveHeaderText(cell.content),
                  colSpan: cell.colSpan,
                  rowSpan: cell.rowSpan,
                });
              }
              headerRows.push(row);
            }
          } else {
            // Single header row from column definitions
            headerRows.push(columns.map(c => ({
              value: typeof c.header === 'function' ? resolveHeaderText(c.header) : c.header,
            })));
          }
        }

        // Build column metadata
        const columnMeta = columns.map((c, i) => ({
          id: c.id,
          header: typeof c.header === 'function' ? resolveHeaderText(c.header) : c.header,
          type: c.cellType,
          align: c.align,
          width: c.width,
          frozen: i < frozenCols,
        }));

        // Build data rows
        const rows = data.map(row =>
          columns.map((col, ci) => buildExportCell(row, col, ci, false))
        );

        const pinnedTopRows = (state.pinnedTopRows ?? []).map(row =>
          columns.map((col, ci) => buildExportCell(row, col, ci, true))
        );

        const pinnedBottomRows = (state.pinnedBottomRows ?? []).map(row =>
          columns.map((col, ci) => buildExportCell(row, col, ci, true))
        );

        // Read merges from mergeCells plugin if active
        const mergeApi = ctx.getPluginApi<{ getMerges: () => Array<{ row: number; col: number; rowSpan?: number; colSpan?: number }> }>('mergeCells');
        const merges: ExportMerge[] = mergeApi
          ? mergeApi.getMerges().map(m => ({ row: m.row, col: m.col, rowSpan: m.rowSpan ?? 1, colSpan: m.colSpan ?? 1 }))
          : [];

        return { headerRows, rows, pinnedTopRows, pinnedBottomRows, columns: columnMeta, merges };
      }

      // ─── CSV ───────────────────────────────────────────────────────────

      function escapeCsv(value: string, separator: string): string {
        if (value.includes(separator) || value.includes('"') || value.includes('\n')) {
          return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }

      function headerRowToCsv(headerCells: ExportHeaderCell[], colCount: number, sep: string): string {
        // Expand colSpan into repeated cells for flat CSV
        const flat: string[] = [];
        for (const cell of headerCells) {
          flat.push(escapeCsv(cell.value, sep));
          const span = (cell.colSpan ?? 1) - 1;
          for (let i = 0; i < span; i++) flat.push('');
        }
        // Pad to column count
        while (flat.length < colCount) flat.push('');
        return flat.join(sep);
      }

      function toCsvString(opts?: { separator?: string }): string {
        const sep = opts?.separator ?? config.csvSeparator;
        const exportData = getExportData();
        const colCount = exportData.columns.length;
        const lines: string[] = [];

        for (const hr of exportData.headerRows) {
          lines.push(headerRowToCsv(hr, colCount, sep));
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
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        download(blob, (opts?.filename ?? config.filename) + '.csv');
      }

      // ─── Excel (OOXML) ────────────────────────────────────────────────

      function exportToExcel(opts?: { filename?: string }): void {
        const exportData = getExportData();
        const xlsx = buildXlsx(exportData);
        const blob = new Blob([xlsx as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        download(blob, (opts?.filename ?? config.filename) + '.xlsx');
      }

      function download(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      // ─── OOXML builder (zero-dependency .xlsx generation) ─────────────

      function buildXlsx(data: ExportData): Uint8Array {
        const colCount = data.columns.length;

        // ── Dynamic style registry ──
        // Each unique combo of (numFmtId, fontId, fillId, hAlign, vAlign) gets an xf entry.
        // Font 0 = normal, 1 = bold. Fill 0 = none, 1 = gray125, 2 = light gray.
        const NUM_FMT_GENERAL = 0;
        const NUM_FMT_NUMBER = 164;  // #,##0
        const NUM_FMT_CURRENCY = 165; // $#,##0.00
        const NUM_FMT_PERCENT = 10;   // 0.00% (built-in)
        const NUM_FMT_DATE = 166;     // yyyy-mm-dd
        const NUM_FMT_CHANGE = 167;   // [Green]+#,##0;[Red]-#,##0;0

        type StyleKey = string;
        const styleMap = new Map<StyleKey, number>();
        const styleEntries: { numFmtId: number; fontId: number; fillId: number; hAlign: string; vAlign: string }[] = [];

        function getStyleId(numFmtId: number, fontId: number, fillId: number, hAlign?: string, vAlign?: string): number {
          const ha = hAlign ?? '';
          const va = vAlign ?? '';
          const key = `${numFmtId}:${fontId}:${fillId}:${ha}:${va}`;
          const existing = styleMap.get(key);
          if (existing !== undefined) return existing;
          const id = styleEntries.length;
          styleEntries.push({ numFmtId, fontId, fillId, hAlign: ha, vAlign: va });
          styleMap.set(key, id);
          return id;
        }

        // Pre-register base style (index 0 = default)
        getStyleId(NUM_FMT_GENERAL, 0, 0);

        function cellStyleId(cell: ExportCell, colIdx: number): number {
          const col = data.columns[colIdx];
          const hAlign = cell.align ?? col?.align ?? '';
          // Map CSS vertical-align to Excel: top→top, middle→center, bottom→bottom
          const rawVa: string = ''; // vertical align from column not commonly used
          const vAlign = rawVa === 'middle' ? 'center' : rawVa;

          let numFmt = NUM_FMT_GENERAL;
          switch (cell.type) {
            case 'currency': numFmt = NUM_FMT_CURRENCY; break;
            case 'percent': numFmt = NUM_FMT_PERCENT; break;
            case 'date': numFmt = NUM_FMT_DATE; break;
            case 'number': numFmt = NUM_FMT_NUMBER; break;
            case 'change': numFmt = NUM_FMT_CHANGE; break;
          }

          const fontId = cell.pinned ? 1 : 0;
          const fillId = cell.pinned ? 2 : 0;
          return getStyleId(numFmt, fontId, fillId, hAlign, vAlign);
        }

        function headerStyleId(hAlign?: string): number {
          return getStyleId(NUM_FMT_GENERAL, 1, 2, hAlign ?? 'center');
        }

        // ── Shared strings ──
        const strings: string[] = [];
        const stringMap = new Map<string, number>();
        function addString(s: string): number {
          const existing = stringMap.get(s);
          if (existing !== undefined) return existing;
          const idx = strings.length;
          strings.push(s);
          stringMap.set(s, idx);
          return idx;
        }

        // ── Data validations (dropdown columns) ──
        const validations: { col: number; options: string[] }[] = [];
        for (let i = 0; i < data.columns.length; i++) {
          // Check if the source column has options (for dropdown)
          const state = ctx.grid.getState();
          const colDef = state.columns[i];
          if (colDef?.options && Array.isArray(colDef.options) && colDef.options.length > 0) {
            const opts = colDef.options.map(o =>
              typeof o === 'object' && o !== null && 'label' in o ? o.label : String(o)
            );
            validations.push({ col: i, options: opts });
          }
        }

        // ── Build sheet XML ──
        let sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
        sheetXml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';

        // Freeze pane
        const freezeRow = data.headerRows.length;
        const freezeCol = data.columns.filter(c => c.frozen).length;
        if (freezeRow > 0 || freezeCol > 0) {
          const topLeft = colRef(freezeCol) + (freezeRow + 1);
          sheetXml += '<sheetViews><sheetView tabSelected="1" workbookViewId="0">';
          sheetXml += `<pane xSplit="${freezeCol}" ySplit="${freezeRow}" topLeftCell="${topLeft}" state="frozen"/>`;
          sheetXml += '</sheetView></sheetViews>';
        }

        // Column widths
        sheetXml += '<cols>';
        for (let i = 0; i < colCount; i++) {
          const w = Math.round((data.columns[i]?.width ?? 100) / 7);
          sheetXml += `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
        }
        sheetXml += '</cols>';

        sheetXml += '<sheetData>';

        let rowNum = 1;
        const mergeCellRefs: string[] = [];

        // Header rows
        for (const hr of data.headerRows) {
          sheetXml += `<row r="${rowNum}">`;
          let colNum = 1;
          for (const cell of hr) {
            const ref = colRef(colNum - 1) + rowNum;
            const si = addString(cell.value);
            const sid = headerStyleId();
            sheetXml += `<c r="${ref}" t="s" s="${sid}"><v>${si}</v></c>`;
            const cs = cell.colSpan ?? 1;
            const rs = cell.rowSpan ?? 1;
            if (cs > 1 || rs > 1) {
              mergeCellRefs.push(`${ref}:${colRef(colNum + cs - 2)}${rowNum + rs - 1}`);
            }
            colNum += cs;
          }
          sheetXml += '</row>';
          rowNum++;
        }

        // Data row writer
        function writeRow(cells: ExportCell[]): void {
          sheetXml += `<row r="${rowNum}">`;
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c]!;
            const ref = colRef(c) + rowNum;
            const sid = cellStyleId(cell, c);
            const val = cell.value;

            if (typeof val === 'number' && !isNaN(val)) {
              sheetXml += `<c r="${ref}" s="${sid}"><v>${val}</v></c>`;
            } else if (typeof val === 'boolean') {
              sheetXml += `<c r="${ref}" t="b" s="${sid}"><v>${val ? 1 : 0}</v></c>`;
            } else if (cell.type === 'date' && typeof val === 'string' && val) {
              const serial = dateToExcelSerial(val);
              if (serial) {
                sheetXml += `<c r="${ref}" s="${sid}"><v>${serial}</v></c>`;
              } else {
                const si = addString(cell.formattedValue);
                sheetXml += `<c r="${ref}" t="s" s="${sid}"><v>${si}</v></c>`;
              }
            } else {
              const si = addString(cell.formattedValue);
              sheetXml += `<c r="${ref}" t="s" s="${sid}"><v>${si}</v></c>`;
            }
          }
          sheetXml += '</row>';
          rowNum++;
        }

        for (const row of data.pinnedTopRows) writeRow(row);
        for (const row of data.rows) writeRow(row);
        for (const row of data.pinnedBottomRows) writeRow(row);

        sheetXml += '</sheetData>';

        // Add body merges from mergeCells plugin (offset by header + pinned top rows)
        const bodyRowOffset = data.headerRows.length + data.pinnedTopRows.length;
        for (const m of data.merges) {
          const startRef = colRef(m.col) + (m.row + bodyRowOffset + 1);
          const endRef = colRef(m.col + m.colSpan - 1) + (m.row + m.rowSpan + bodyRowOffset);
          mergeCellRefs.push(`${startRef}:${endRef}`);
        }

        // Merge cells (headers + body)
        if (mergeCellRefs.length > 0) {
          sheetXml += `<mergeCells count="${mergeCellRefs.length}">`;
          for (const mc of mergeCellRefs) sheetXml += `<mergeCell ref="${mc}"/>`;
          sheetXml += '</mergeCells>';
        }

        // Data validations (dropdown lists)
        if (validations.length > 0) {
          const dataRowStart = freezeRow + 1;
          const dataRowEnd = rowNum - 1;
          sheetXml += `<dataValidations count="${validations.length}">`;
          for (const v of validations) {
            const colLetter = colRef(v.col);
            const sqref = `${colLetter}${dataRowStart}:${colLetter}${dataRowEnd}`;
            const formula = escapeXml('"' + v.options.join(',') + '"');
            sheetXml += `<dataValidation type="list" allowBlank="1" showDropDown="0" sqref="${sqref}"><formula1>${formula}</formula1></dataValidation>`;
          }
          sheetXml += '</dataValidations>';
        }

        sheetXml += '</worksheet>';

        // Build shared strings XML
        let ssXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
        ssXml += `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">`;
        for (const s of strings) {
          ssXml += `<si><t>${escapeXml(s)}</t></si>`;
        }
        ssXml += '</sst>';

        // Build dynamic styles XML
        const stylesXml = buildDynamicStyles(styleEntries);

        // Package into ZIP (minimal .xlsx)
        return createZip({
          '[Content_Types].xml': contentTypesXml(),
          '_rels/.rels': relsXml(),
          'xl/_rels/workbook.xml.rels': wbRelsXml(),
          'xl/workbook.xml': workbookXml(),
          'xl/styles.xml': stylesXml,
          'xl/sharedStrings.xml': ssXml,
          'xl/worksheets/sheet1.xml': sheetXml,
        });
      }

      function colRef(idx: number): string {
        let s = '';
        let n = idx;
        do {
          s = String.fromCharCode(65 + (n % 26)) + s;
          n = Math.floor(n / 26) - 1;
        } while (n >= 0);
        return s;
      }

      function dateToExcelSerial(iso: string): number | null {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        // Excel epoch: 1900-01-01 = 1 (with the intentional 1900 leap year bug)
        const epoch = new Date(1899, 11, 30);
        return Math.round((d.getTime() - epoch.getTime()) / 86400000);
      }

      function escapeXml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }

      // ─── OOXML boilerplate ────────────────────────────────────────────

      function contentTypesXml(): string {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
      }

      function relsXml(): string {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
      }

      function wbRelsXml(): string {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
      }

      function workbookXml(): string {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
      }

      function buildDynamicStyles(entries: { numFmtId: number; fontId: number; fillId: number; hAlign: string; vAlign: string }[]): string {
        let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
        xml += '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

        // Custom number formats (164+)
        xml += '<numFmts count="4">';
        xml += '<numFmt numFmtId="164" formatCode="#,##0"/>';
        xml += '<numFmt numFmtId="165" formatCode="$#,##0.00"/>';
        xml += '<numFmt numFmtId="166" formatCode="yyyy-mm-dd"/>';
        xml += '<numFmt numFmtId="167" formatCode="[Green]+#,##0;[Red]-#,##0;0"/>';
        xml += '</numFmts>';

        // Fonts: 0=normal, 1=bold
        xml += '<fonts count="2">';
        xml += '<font><sz val="11"/><name val="Calibri"/></font>';
        xml += '<font><b/><sz val="11"/><name val="Calibri"/></font>';
        xml += '</fonts>';

        // Fills: 0=none, 1=gray125(required), 2=light gray solid
        xml += '<fills count="3">';
        xml += '<fill><patternFill patternType="none"/></fill>';
        xml += '<fill><patternFill patternType="gray125"/></fill>';
        xml += '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill>';
        xml += '</fills>';

        xml += '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>';
        xml += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';

        // Dynamic cellXfs — one entry per unique style combo
        xml += `<cellXfs count="${entries.length}">`;
        for (const e of entries) {
          const applyNum = e.numFmtId !== 0 ? ' applyNumberFormat="1"' : '';
          const applyFont = e.fontId !== 0 ? ' applyFont="1"' : '';
          const applyFill = e.fillId !== 0 ? ' applyFill="1"' : '';
          const hasAlign = e.hAlign || e.vAlign;

          if (hasAlign) {
            xml += `<xf numFmtId="${e.numFmtId}" fontId="${e.fontId}" fillId="${e.fillId}" borderId="0"${applyNum}${applyFont}${applyFill} applyAlignment="1">`;
            xml += '<alignment';
            if (e.hAlign) xml += ` horizontal="${e.hAlign}"`;
            if (e.vAlign) xml += ` vertical="${e.vAlign}"`;
            xml += '/>';
            xml += '</xf>';
          } else {
            xml += `<xf numFmtId="${e.numFmtId}" fontId="${e.fontId}" fillId="${e.fillId}" borderId="0"${applyNum}${applyFont}${applyFill}/>`;
          }
        }
        xml += '</cellXfs>';

        xml += '</styleSheet>';
        return xml;
      }

      // ─── Minimal ZIP implementation ───────────────────────────────────

      function createZip(files: Record<string, string>): Uint8Array {
        const encoder = new TextEncoder();
        const entries: { name: Uint8Array; data: Uint8Array; offset: number }[] = [];
        const parts: Uint8Array[] = [];
        let offset = 0;

        for (const [name, content] of Object.entries(files)) {
          const nameBytes = encoder.encode(name);
          const dataBytes = encoder.encode(content);
          const entry = { name: nameBytes, data: dataBytes, offset };

          // Local file header
          const header = new Uint8Array(30 + nameBytes.length);
          const hv = new DataView(header.buffer);
          hv.setUint32(0, 0x04034b50, true); // signature
          hv.setUint16(4, 20, true); // version needed
          hv.setUint16(6, 0, true); // flags
          hv.setUint16(8, 0, true); // compression (store)
          hv.setUint16(10, 0, true); // mod time
          hv.setUint16(12, 0, true); // mod date
          hv.setUint32(14, crc32(dataBytes), true);
          hv.setUint32(18, dataBytes.length, true); // compressed size
          hv.setUint32(22, dataBytes.length, true); // uncompressed size
          hv.setUint16(26, nameBytes.length, true);
          hv.setUint16(28, 0, true); // extra field length
          header.set(nameBytes, 30);

          parts.push(header, dataBytes);
          offset += header.length + dataBytes.length;
          entries.push(entry);
        }

        // Central directory
        const cdStart = offset;
        for (const entry of entries) {
          const cd = new Uint8Array(46 + entry.name.length);
          const cv = new DataView(cd.buffer);
          cv.setUint32(0, 0x02014b50, true);
          cv.setUint16(4, 20, true);
          cv.setUint16(6, 20, true);
          cv.setUint16(8, 0, true);
          cv.setUint16(10, 0, true);
          cv.setUint16(12, 0, true);
          cv.setUint16(14, 0, true);
          cv.setUint32(16, crc32(entry.data), true);
          cv.setUint32(20, entry.data.length, true);
          cv.setUint32(24, entry.data.length, true);
          cv.setUint16(28, entry.name.length, true);
          cv.setUint16(30, 0, true);
          cv.setUint16(32, 0, true);
          cv.setUint16(34, 0, true);
          cv.setUint16(36, 0, true);
          cv.setUint32(38, 0, true);
          cv.setUint32(42, entry.offset, true);
          cd.set(entry.name, 46);
          parts.push(cd);
          offset += cd.length;
        }

        // End of central directory
        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, entries.length, true);
        ev.setUint16(10, entries.length, true);
        ev.setUint32(12, offset - cdStart, true);
        ev.setUint32(16, cdStart, true);
        ev.setUint16(20, 0, true);
        parts.push(eocd);

        // Concatenate all parts
        const totalSize = parts.reduce((s, p) => s + p.length, 0);
        const result = new Uint8Array(totalSize);
        let pos = 0;
        for (const part of parts) {
          result.set(part, pos);
          pos += part.length;
        }
        return result;
      }

      function crc32(data: Uint8Array): number {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
          crc ^= data[i]!;
          for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
          }
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
      }

      // ─── Expose API ───────────────────────────────────────────────────

      const api: ExportApi = {
        exportToCsv,
        exportToExcel,
        getExportData,
        toCsvString,
      };

      ctx.expose(api);
    },
  };
}
