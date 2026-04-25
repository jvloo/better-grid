import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface DataRow {
  id: number;
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  growth: number;
}

const data: DataRow[] = [
  { id: 1, month: 'January', revenue: 100000, cost: 62000, profit: 38000, growth: 0.00 },
  { id: 2, month: 'February', revenue: 110000, cost: 65000, profit: 45000, growth: 0.10 },
  { id: 3, month: 'March', revenue: 120000, cost: 68000, profit: 52000, growth: 0.09 },
  { id: 4, month: 'April', revenue: 130000, cost: 72000, profit: 58000, growth: 0.08 },
  { id: 5, month: 'May', revenue: 140000, cost: 75000, profit: 65000, growth: 0.08 },
  { id: 6, month: 'June', revenue: 150000, cost: 79000, profit: 71000, growth: 0.07 },
  { id: 7, month: 'July', revenue: 160000, cost: 83000, profit: 77000, growth: 0.07 },
  { id: 8, month: 'August', revenue: 170000, cost: 88000, profit: 82000, growth: 0.06 },
  { id: 9, month: 'September', revenue: 180000, cost: 92000, profit: 88000, growth: 0.06 },
  { id: 10, month: 'October', revenue: 190000, cost: 97000, profit: 93000, growth: 0.06 },
  { id: 11, month: 'November', revenue: 200000, cost: 101000, profit: 99000, growth: 0.05 },
  { id: 12, month: 'December', revenue: 215000, cost: 106000, profit: 109000, growth: 0.08 },
  { id: 13, month: 'January Y2', revenue: 195000, cost: 99000, profit: 96000, growth: -0.09 },
  { id: 14, month: 'February Y2', revenue: 205000, cost: 103000, profit: 102000, growth: 0.05 },
  { id: 15, month: 'March Y2', revenue: 220000, cost: 108000, profit: 112000, growth: 0.07 },
  { id: 16, month: 'April Y2', revenue: 230000, cost: 113000, profit: 117000, growth: 0.05 },
  { id: 17, month: 'May Y2', revenue: 240000, cost: 117000, profit: 123000, growth: 0.04 },
  { id: 18, month: 'June Y2', revenue: 255000, cost: 122000, profit: 133000, growth: 0.06 },
  { id: 19, month: 'July Y2', revenue: 265000, cost: 127000, profit: 138000, growth: 0.04 },
  { id: 20, month: 'August Y2', revenue: 275000, cost: 132000, profit: 143000, growth: 0.04 },
];

// All columns hoisted at module scope — no closure-over-component-state.
// `mode="spreadsheet"` brings sort + edit + clipboard + undo (incl. fill handle).
const columns = [
  col.text('month', { header: 'Month', width: 120, editable: true, sortable: true }),
  col.currency('revenue', { header: 'Revenue', width: 130, editable: true }),
  col.currency('cost', { header: 'Cost', width: 130, editable: true }),
  col.currency('profit', { header: 'Profit', width: 130, editable: true }),
  col.percent('growth', { header: 'Growth', width: 110, editable: true }),
] as ColumnDef<DataRow>[];

export function ClipboardFill() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Clipboard & Fill Handle</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Copy, paste, and drag-to-fill. Select cells and use clipboard shortcuts, or drag the
        fill handle to repeat values across rows or columns.
      </p>

      <div style={{
        marginBottom: 16, padding: 12, background: '#f8f9fa', borderRadius: 8,
        border: '1px solid #e0e0e0', fontSize: 13, color: '#555', lineHeight: 1.8,
      }}>
        <strong style={{ color: '#333' }}>Keyboard Shortcuts</strong>
        <br />
        <strong>Clipboard:</strong> Select cells &rarr; <code>Ctrl+C</code> copy, <code>Ctrl+V</code> paste, <code>Ctrl+X</code> cut
        <br />
        <strong>Fill Handle:</strong> Drag the blue square at bottom-right of selection to fill
        <br />
        <span style={{ color: '#999' }}>Fill Down (Ctrl+D), Fill Series (Ctrl+Shift+D) &rarr; Pro</span>
      </div>

      <BetterGrid<DataRow>
        columns={columns}
        data={data}
        mode="spreadsheet"
        features={{
          format: { locale: 'en-US', currencyCode: 'USD' },
          edit: { editTrigger: 'dblclick', editorMode: 'inline' },
          validation: { validateOn: 'commit' },
        }}
        rowHeight={36}
        selection={{ mode: 'range', fillHandle: true }}
        height={420}
        style={{ border: '1px solid #e0e0e0', borderRadius: 8 }}
      />
    </div>
  );
}
