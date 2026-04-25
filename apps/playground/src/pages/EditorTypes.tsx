import { useState } from 'react';
import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface EditorRow {
  id: number;
  name: string;
  price: number;
  quantity: number;
  rate: number;
  startDate: string;
  category: string;
  assignee: string;
  weight: number;
  active: boolean;
  notes: string;
}

const initialData: EditorRow[] = [
  { id: 1, name: 'Widget A', price: 29999, quantity: 100, rate: 0.05, startDate: '2026-01-15', category: 'Electronics', assignee: 'Alice', weight: 2.5, active: true, notes: 'First batch' },
  { id: 2, name: 'Sensor B', price: 4500, quantity: 250, rate: 0.12, startDate: '2026-02-20', category: 'Hardware', assignee: 'Bob', weight: 0.75, active: false, notes: 'Bulk order' },
  { id: 3, name: 'License C', price: 99900, quantity: 10, rate: 0.03, startDate: '2026-03-10', category: 'Software', assignee: 'Charlie', weight: 0.0, active: true, notes: '' },
  { id: 4, name: 'Cable Kit D', price: 1250, quantity: 500, rate: 0.08, startDate: '2026-04-05', category: 'Electronics', assignee: 'Diana', weight: 0.35, active: false, notes: 'Rush order' },
  { id: 5, name: 'Motor E', price: 18500, quantity: 75, rate: 0.15, startDate: '2026-05-18', category: 'Hardware', assignee: 'Eve', weight: 8.5, active: true, notes: 'Discount applied' },
  { id: 6, name: 'Cloud Plan F', price: 49900, quantity: 1, rate: 0.20, startDate: '2026-06-01', category: 'Services', assignee: 'Alice', weight: 0.0, active: true, notes: 'Annual' },
  { id: 7, name: 'Relay G', price: 3200, quantity: 320, rate: 0.07, startDate: '2026-07-12', category: 'Electronics', assignee: 'Bob', weight: 0.12, active: false, notes: '' },
  { id: 8, name: 'Dev Board H', price: 5495, quantity: 60, rate: 0.10, startDate: '2026-08-22', category: 'Hardware', assignee: 'Charlie', weight: 0.22, active: true, notes: 'Rev 3.1' },
  { id: 9, name: 'Analytics I', price: 19900, quantity: 5, rate: 0.04, startDate: '2026-09-03', category: 'Software', assignee: 'Diana', weight: 0.0, active: false, notes: 'Trial' },
  { id: 10, name: 'Support J', price: 7500, quantity: 12, rate: 0.09, startDate: '2026-10-15', category: 'Services', assignee: 'Eve', weight: 0.0, active: true, notes: 'Quarterly' },
  { id: 11, name: 'Adapter K', price: 2250, quantity: 200, rate: 0.06, startDate: '2026-11-01', category: 'Electronics', assignee: 'Alice', weight: 0.15, active: true, notes: 'New supplier' },
  { id: 12, name: 'Firmware L', price: 34900, quantity: 3, rate: 0.02, startDate: '2026-11-20', category: 'Software', assignee: 'Bob', weight: 0.0, active: false, notes: 'Beta' },
  { id: 13, name: 'Enclosure M', price: 8900, quantity: 45, rate: 0.11, startDate: '2026-12-05', category: 'Hardware', assignee: 'Charlie', weight: 3.2, active: true, notes: '' },
  { id: 14, name: 'Hosting N', price: 12000, quantity: 1, rate: 0.18, startDate: '2027-01-10', category: 'Services', assignee: 'Diana', weight: 0.0, active: true, notes: 'Monthly' },
  { id: 15, name: 'Antenna O', price: 4100, quantity: 150, rate: 0.07, startDate: '2027-01-25', category: 'Electronics', assignee: 'Eve', weight: 0.45, active: false, notes: 'Outdoor' },
  { id: 16, name: 'API Suite P', price: 59900, quantity: 2, rate: 0.05, startDate: '2027-02-14', category: 'Software', assignee: 'Alice', weight: 0.0, active: true, notes: 'Enterprise' },
  { id: 17, name: 'Heat Sink Q', price: 1850, quantity: 400, rate: 0.13, startDate: '2027-03-01', category: 'Hardware', assignee: 'Bob', weight: 0.08, active: true, notes: '' },
  { id: 18, name: 'Training R', price: 15000, quantity: 8, rate: 0.16, startDate: '2027-03-18', category: 'Services', assignee: 'Charlie', weight: 0.0, active: false, notes: 'On-site' },
  { id: 19, name: 'Fuse Pack S', price: 950, quantity: 1000, rate: 0.03, startDate: '2027-04-05', category: 'Electronics', assignee: 'Diana', weight: 0.02, active: true, notes: 'Bulk' },
  { id: 20, name: 'Debugger T', price: 27500, quantity: 15, rate: 0.08, startDate: '2027-04-22', category: 'Software', assignee: 'Eve', weight: 0.0, active: true, notes: 'Pro license' },
];

const columns = [
  col.text('name', { header: 'Name (text)', width: 150, required: true }),
  col.currency('price', { header: 'Price (number)', width: 130, precision: 2 }),
  col.number('quantity', {
    header: 'Qty (number)',
    width: 100,
    cellEditor: 'number',
    precision: 0,
    rules: [{ validate: (v: unknown) => (v as number) > 0 || 'Must be > 0' }],
  }),
  col.percent('rate', { header: 'Rate (%)', width: 100 }),
  col.date('startDate', { header: 'Start Date', width: 130 }),
  col.text('category', {
    header: 'Category',
    width: 120,
    options: ['Electronics', 'Hardware', 'Software', 'Services'],
  }),
  col.text('assignee', {
    header: 'Assignee',
    width: 130,
    cellEditor: 'autocomplete',
    options: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
    meta: { allowCreate: true },
  }),
  col.text('weight', {
    header: 'Weight',
    width: 120,
    align: 'right',
    valueFormatter: (v: unknown) => typeof v === 'number' ? `${v.toFixed(2)} kg` : String(v ?? ''),
    valueParser: (s: string) => {
      const cleaned = s.replace(/[^0-9.\-]/g, '');
      if (cleaned === '' || cleaned === '-') return undefined;
      const num = Number(cleaned);
      return isNaN(num) ? undefined : Math.round(num * 100) / 100;
    },
  }),
  col.boolean('active', { header: 'Active', width: 70 }),
  col.text('notes', { header: 'Notes', width: 150 }),
] as ColumnDef<EditorRow>[];

export function EditorTypes() {
  const [floatData, setFloatData] = useState(initialData);
  const [inlineData, setInlineData] = useState(initialData);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Editor Types</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        All 5 editor types + both editor modes + validation. Double-click any cell to edit.
      </p>
      <div style={{ marginBottom: 12, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Columns:</strong>{' '}
        Name (text, required) | Price (number, auto-detected from currency cellType) |
        Qty (number, explicit editor) | Rate (percent, text with % parsing) |
        Start Date (date, auto-detected) | Category (dropdown) |
        Assignee (autocomplete, allowCreate) | Weight (valueFormatter/Parser, "X.XX kg") |
        Active (boolean checkbox) | Notes (text)
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 8, marginTop: 24 }}>Float Mode (default)</h2>
      <p style={{ marginBottom: 8, color: '#888', fontSize: 13 }}>
        Editor floats above the cell as an overlay.
      </p>
      <BetterGrid<EditorRow>
        columns={columns}
        data={floatData}
        mode="view"
        features={{
          format: { locale: 'en-US', currencyCode: 'USD' },
          edit: { editTrigger: 'dblclick', editorMode: 'float' },
          validation: { validateOn: 'commit' },
        }}
        selection={{ mode: 'range', fillHandle: false }}
        onCellChange={(changes) => {
          setFloatData((prev) => {
            const next = [...prev];
            for (const change of changes) {
              next[change.rowIndex] = change.row as EditorRow;
            }
            return next;
          });
        }}
        height={300}
      />

      <h2 style={{ fontSize: 18, marginBottom: 8, marginTop: 32 }}>Inline Mode</h2>
      <p style={{ marginBottom: 8, color: '#888', fontSize: 13 }}>
        Editor renders inside the cell bounds.
      </p>
      <BetterGrid<EditorRow>
        columns={columns}
        data={inlineData}
        mode="view"
        features={{
          format: { locale: 'en-US', currencyCode: 'USD' },
          edit: { editTrigger: 'dblclick', editorMode: 'inline' },
          validation: { validateOn: 'commit' },
        }}
        selection={{ mode: 'range', fillHandle: false }}
        onCellChange={(changes) => {
          setInlineData((prev) => {
            const next = [...prev];
            for (const change of changes) {
              next[change.rowIndex] = change.row as EditorRow;
            }
            return next;
          });
        }}
        height={300}
      />
    </div>
  );
}
