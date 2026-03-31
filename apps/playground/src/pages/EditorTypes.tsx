import { useMemo, useState } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, validation, cellRenderers } from '@better-grid/plugins';
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
];

function makeColumns(): ColumnDef<EditorRow>[] {
  return [
    {
      id: 'name',
      header: 'Name (text)',
      width: 150,
      required: true,
    },
    {
      id: 'price',
      header: 'Price (number)',
      width: 130,
      cellType: 'currency',
      precision: 2,
    },
    {
      id: 'quantity',
      header: 'Qty (number)',
      width: 100,
      editor: 'number',
      precision: 0,
      rules: [{ validate: (v) => (v as number) > 0 || 'Must be > 0' }],
    },
    {
      id: 'rate',
      header: 'Rate (%)',
      width: 100,
      cellType: 'percent',
    },
    {
      id: 'startDate',
      header: 'Start Date',
      width: 130,
      cellType: 'date',
    },
    {
      id: 'category',
      header: 'Category',
      width: 120,
      options: ['Electronics', 'Hardware', 'Software', 'Services'],
    },
    {
      id: 'assignee',
      header: 'Assignee',
      width: 130,
      editor: 'autocomplete' as const,
      options: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'],
      meta: { allowCreate: true },
    },
    {
      id: 'weight',
      header: 'Weight',
      width: 120,
      align: 'right',
      valueModifier: {
        format: (v: unknown) => typeof v === 'number' ? `${v.toFixed(2)} kg` : String(v ?? ''),
        parse: (s: string) => {
          const cleaned = s.replace(/[^0-9.\-]/g, '');
          if (cleaned === '' || cleaned === '-') return undefined;
          const num = Number(cleaned);
          return isNaN(num) ? undefined : Math.round(num * 100) / 100;
        },
      },
    },
    {
      id: 'active',
      header: 'Active',
      width: 70,
      cellType: 'boolean',
    },
    {
      id: 'notes',
      header: 'Notes',
      width: 150,
    },
  ];
}

export function EditorTypes() {
  const [floatData, setFloatData] = useState(initialData);
  const [inlineData, setInlineData] = useState(initialData);

  const columns = useMemo(() => makeColumns(), []);

  const floatPlugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      editing({ editTrigger: 'dblclick', editorMode: 'float' }),
      validation({ validateOn: 'commit' }),
      cellRenderers(),
    ],
    [],
  );

  const inlinePlugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      editing({ editTrigger: 'dblclick', editorMode: 'inline' }),
      validation({ validateOn: 'commit' }),
      cellRenderers(),
    ],
    [],
  );

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
        Assignee (autocomplete, allowCreate) | Weight (valueModifier, "X.XX kg") |
        Active (boolean checkbox) | Notes (text)
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 8, marginTop: 24 }}>Float Mode (default)</h2>
      <p style={{ marginBottom: 8, color: '#888', fontSize: 13 }}>
        Editor floats above the cell as an overlay.
      </p>
      <BetterGrid<EditorRow>
        columns={columns}
        data={floatData}
        selection={{ mode: 'range' }}
        plugins={floatPlugins}
        onDataChange={(changes) => {
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
        selection={{ mode: 'range' }}
        plugins={inlinePlugins}
        onDataChange={(changes) => {
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
