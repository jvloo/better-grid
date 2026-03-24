import { useMemo, useState } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface TestRow {
  id: number;
  name: string;
  quantity: number;
  price: number;
  rate: number;
  status: string;
  priority: number;
  active: boolean;
  activeForcedText: boolean;
  date: string;
  notes: string;
  readonly: string;
}

const initialData: TestRow[] = [
  { id: 1, name: 'Widget A', quantity: 100, price: 25000, rate: 0.05, status: 'Open', priority: 1, active: true, activeForcedText: true, date: '2026-01-15', notes: 'First batch', readonly: 'Cannot edit' },
  { id: 2, name: 'Widget B', quantity: 250, price: 45000, rate: 0.12, status: 'Closed', priority: 2, active: false, activeForcedText: false, date: '2026-02-20', notes: 'Second batch', readonly: 'Cannot edit' },
  { id: 3, name: 'Widget C', quantity: 50, price: 8900, rate: 0.03, status: 'Pending', priority: 3, active: true, activeForcedText: true, date: '2026-03-10', notes: '', readonly: 'Cannot edit' },
  { id: 4, name: 'Widget D', quantity: 500, price: 120000, rate: 0.08, status: 'Open', priority: 1, active: false, activeForcedText: false, date: '2026-04-05', notes: 'Rush order', readonly: 'Cannot edit' },
  { id: 5, name: 'Widget E', quantity: 75, price: 33000, rate: 0.15, status: 'Closed', priority: 2, active: true, activeForcedText: true, date: '2026-05-18', notes: 'Discount applied', readonly: 'Cannot edit' },
];

export function EditableGrid() {
  const [data, setData] = useState(initialData);

  const columns = useMemo<ColumnDef<TestRow>[]>(
    () => [
      // 1. Non-editable (meta.editable: false)
      // 1. Non-editable
      { id: 'id', header: 'ID', width: 50, editable: false },

      // 2. Default string → text input
      { id: 'name', header: 'Name (text)', width: 130 },

      // 3. Default number → text input, auto-parses to number
      { id: 'quantity', header: 'Qty (number)', width: 100 },

      // 4. cellType: 'currency' → text input, parses $1,234 → 1234
      { id: 'price', header: 'Price (currency)', width: 140, cellType: 'currency' },

      // 5. cellType: 'percent' → text input, parses 50 → 0.5
      { id: 'rate', header: 'Rate (percent)', width: 110, cellType: 'percent' },

      // 6. options (strings) → dropdown
      {
        id: 'status',
        header: 'Status (dropdown)',
        width: 140,
        options: ['Open', 'Pending', 'Closed'],
      },

      // 7. options ({ label, value }) → dropdown with label/value
      {
        id: 'priority',
        header: 'Priority (l/v)',
        width: 120,
        options: [
          { label: 'High', value: 1 },
          { label: 'Medium', value: 2 },
          { label: 'Low', value: 3 },
        ],
        cellRenderer: (container, ctx) => {
          const labels: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };
          const colors: Record<number, string> = { 1: '#c62828', 2: '#f57f17', 3: '#2e7d32' };
          const v = ctx.value as number;
          container.textContent = labels[v] ?? String(v);
          container.style.color = colors[v] ?? '';
        },
      },

      // 8. Boolean auto-detect → dropdown (Yes/No)
      {
        id: 'active',
        header: 'Active (auto)',
        width: 110,
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? 'Yes' : 'No';
          container.style.color = ctx.value ? '#2e7d32' : '#c62828';
        },
      },

      // 9. Boolean with editor: 'text' → force text input
      {
        id: 'activeForcedText',
        header: 'Bool (text)',
        width: 100,
        editor: 'text',
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? 'Yes' : 'No';
        },
      },

      // 10. cellType: 'date' → text input with date formatting
      { id: 'date', header: 'Date', width: 120, cellType: 'date' },

      // 11. Plain string (empty allowed)
      { id: 'notes', header: 'Notes', width: 140 },

      // 12. Read-only column
      { id: 'readonly', header: 'Read-only', width: 110, editable: false },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick' }),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Editable Grid — All Editor Types</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        Double-click any cell to edit. Each column demonstrates a different editor configuration.
      </p>
      <BetterGrid<TestRow>
        columns={columns}
        data={data}
        frozenLeftColumns={1}
        selection={{ mode: 'range' }}
        plugins={plugins}
        onDataChange={(changes) => {
          setData((prev) => {
            const next = [...prev];
            for (const change of changes) {
              next[change.rowIndex] = change.row as TestRow;
            }
            return next;
          });
        }}
        height={300}
      />
      <div style={{ marginTop: 16, fontSize: 13, color: '#888' }}>
        <strong>Columns:</strong> ID (readonly) | Name (text) | Qty (auto-number) | Price (currency) |
        Rate (percent) | Status (string dropdown) | Priority (label/value dropdown) |
        Active (auto boolean dropdown) | Bool-text (forced text) | Date | Notes (text) | Read-only
      </div>
    </div>
  );
}
