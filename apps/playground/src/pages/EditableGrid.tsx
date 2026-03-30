import { useMemo, useState } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, validation } from '@better-grid/plugins';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface TestRow {
  id: number;
  name: string;
  quantity: number;
  price: number;
  rate: number;
  serialNumber: bigint;
  weight: number;
  status: string;
  priority: number;
  active: boolean;
  activeForcedText: boolean;
  date: string;
  notes: string;
  readonly: string;
}

const initialData: TestRow[] = [
  { id: 1, name: 'Widget A', quantity: 100, price: 25000, rate: 0.05, serialNumber: 9876543210012345678n, weight: 2.5, status: 'Open', priority: 1, active: true, activeForcedText: true, date: '2026-01-15', notes: 'First batch', readonly: 'Cannot edit' },
  { id: 2, name: 'Widget B', quantity: 250, price: 45000, rate: 0.12, serialNumber: 1234567890123456789n, weight: 0.75, status: 'Closed', priority: 2, active: false, activeForcedText: false, date: '2026-02-20', notes: 'Second batch', readonly: 'Cannot edit' },
  { id: 3, name: 'Widget C', quantity: 50, price: 8900, rate: 0.03, serialNumber: 5678901234567890123n, weight: 1.2, status: 'Pending', priority: 3, active: true, activeForcedText: true, date: '2026-03-10', notes: '', readonly: 'Cannot edit' },
  { id: 4, name: 'Widget D', quantity: 500, price: 120000, rate: 0.08, serialNumber: 3456789012345678901n, weight: 15.0, status: 'Open', priority: 1, active: false, activeForcedText: false, date: '2026-04-05', notes: 'Rush order', readonly: 'Cannot edit' },
  { id: 5, name: 'Widget E', quantity: 75, price: 33000, rate: 0.15, serialNumber: 7890123456789012345n, weight: 0.35, status: 'Closed', priority: 2, active: true, activeForcedText: true, date: '2026-05-18', notes: 'Discount applied', readonly: 'Cannot edit' },
  { id: 6, name: 'Sensor Module', quantity: 320, price: 18500, rate: 0.07, serialNumber: 2345678901234567890n, weight: 0.08, status: 'Open', priority: 1, active: true, activeForcedText: false, date: '2026-01-22', notes: 'Bulk shipment', readonly: 'Cannot edit' },
  { id: 7, name: 'Power Supply', quantity: 60, price: 72000, rate: 0.10, serialNumber: 6789012345678901234n, weight: 3.4, status: 'Pending', priority: 2, active: false, activeForcedText: true, date: '2026-02-14', notes: '', readonly: 'Cannot edit' },
  { id: 8, name: 'Display Panel', quantity: 150, price: 95000, rate: 0.04, serialNumber: 4567890123456789012n, weight: 4.8, status: 'Open', priority: 1, active: true, activeForcedText: true, date: '2026-03-01', notes: 'OLED variant', readonly: 'Cannot edit' },
  { id: 9, name: 'Battery Pack', quantity: 400, price: 31000, rate: 0.09, serialNumber: 8901234567890123456n, weight: 1.6, status: 'Closed', priority: 3, active: false, activeForcedText: false, date: '2026-04-12', notes: 'Lithium-ion', readonly: 'Cannot edit' },
  { id: 10, name: 'Control Board', quantity: 85, price: 54000, rate: 0.06, serialNumber: 1357924680135792468n, weight: 0.22, status: 'Pending', priority: 2, active: true, activeForcedText: true, date: '2026-05-30', notes: 'Rev 3.1', readonly: 'Cannot edit' },
  { id: 11, name: 'Motor Assembly', quantity: 200, price: 128000, rate: 0.11, serialNumber: 2468013579246801357n, weight: 8.5, status: 'Open', priority: 1, active: true, activeForcedText: false, date: '2026-06-08', notes: 'Brushless DC', readonly: 'Cannot edit' },
  { id: 12, name: 'Heat Sink', quantity: 550, price: 4200, rate: 0.02, serialNumber: 1122334455667788990n, weight: 0.45, status: 'Closed', priority: 3, active: false, activeForcedText: true, date: '2026-07-19', notes: 'Aluminum alloy', readonly: 'Cannot edit' },
  { id: 13, name: 'LED Module', quantity: 1000, price: 2800, rate: 0.14, serialNumber: 9988776655443322110n, weight: 0.03, status: 'Open', priority: 2, active: true, activeForcedText: true, date: '2026-08-25', notes: 'RGB variant', readonly: 'Cannot edit' },
  { id: 14, name: 'Connector Kit', quantity: 300, price: 6500, rate: 0.05, serialNumber: 5544332211009988776n, weight: 0.18, status: 'Pending', priority: 3, active: false, activeForcedText: false, date: '2026-09-03', notes: '', readonly: 'Cannot edit' },
  { id: 15, name: 'Gear Assembly', quantity: 120, price: 41000, rate: 0.08, serialNumber: 6677889900112233445n, weight: 2.1, status: 'Closed', priority: 1, active: true, activeForcedText: true, date: '2026-10-11', notes: 'Stainless steel', readonly: 'Cannot edit' },
  { id: 16, name: 'Relay Switch', quantity: 800, price: 3900, rate: 0.03, serialNumber: 3344556677889900112n, weight: 0.12, status: 'Open', priority: 2, active: false, activeForcedText: false, date: '2026-11-07', notes: '12V rated', readonly: 'Cannot edit' },
  { id: 17, name: 'Capacitor Bank', quantity: 45, price: 87000, rate: 0.13, serialNumber: 7788990011223344556n, weight: 6.0, status: 'Pending', priority: 1, active: true, activeForcedText: true, date: '2026-12-01', notes: 'High voltage', readonly: 'Cannot edit' },
  { id: 18, name: 'Cooling Fan', quantity: 230, price: 15600, rate: 0.06, serialNumber: 4455667788990011223n, weight: 0.28, status: 'Closed', priority: 3, active: false, activeForcedText: false, date: '2026-01-30', notes: '80mm', readonly: 'Cannot edit' },
  { id: 19, name: 'Transformer', quantity: 90, price: 63000, rate: 0.10, serialNumber: 8899001122334455667n, weight: 12.5, status: 'Open', priority: 2, active: true, activeForcedText: true, date: '2026-02-28', notes: 'Step-down 240V', readonly: 'Cannot edit' },
  { id: 20, name: 'Fiber Optic Cable', quantity: 170, price: 22000, rate: 0.07, serialNumber: 2233445566778899001n, weight: 0.55, status: 'Pending', priority: 1, active: false, activeForcedText: false, date: '2026-03-15', notes: 'Multi-mode', readonly: 'Cannot edit' },
];

export function EditableGrid() {
  const [data, setData] = useState(initialData);

  const columns = useMemo<ColumnDef<TestRow>[]>(
    () => [
      // 1. Non-editable (meta.editable: false)
      // 1. Non-editable
      { id: 'id', header: '#', width: 40, editable: false},

      // 2. Default string → text input (required)
      { id: 'name', header: 'Name (text)', width: 150, required: true },

      // 3. Default number → text input with validation
      {
        id: 'quantity',
        header: 'Qty (number)',
        width: 115,
        rules: [{ validate: (v) => (v as number) > 0 || 'Must be positive', message: 'Qty must be > 0' }],
      },

      // 4. cellType: 'currency' → text input with precision: 2
      {
        id: 'price',
        header: 'Price (currency)',
        width: 150,
        cellType: 'currency',
        precision: 2,
        rules: [{ validate: (v) => (v as number) >= 0 || 'Cannot be negative' }],
      },

      // 5. cellType: 'percent' → text input, parses 50 → 0.5
      { id: 'rate', header: 'Rate (percent)', width: 130, cellType: 'percent' },

      // 6. cellType: 'bigint' → full-precision large integers
      { id: 'serialNumber', header: 'Serial (bigint)', width: 185, cellType: 'bigint' },

      // 7. valueModifier → custom parsing (weight in kg)
      {
        id: 'weight',
        header: 'Weight (custom)',
        width: 130,
        align: 'right',
        valueModifier: {
          format: (v: unknown) => typeof v === 'number' ? `${v.toFixed(2)} kg` : String(v ?? ''),
          parse: (s: string) => {
            const cleaned = s.replace(/[^0-9.\-]/g, '');
            if (cleaned === '' || cleaned === '-') return undefined; // invalid → keep original
            const num = Number(cleaned);
            return isNaN(num) ? undefined : Math.round(num * 100) / 100;
          },
        },
      },

      // 8. options (strings) → dropdown
      {
        id: 'status',
        header: 'Status (dropdown)',
        width: 155,
        options: ['Open', 'Pending', 'Closed'],
      },

      // 9. options ({ label, value }) → dropdown with label/value
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

      // 10. Boolean auto-detect → dropdown (Yes/No)
      {
        id: 'active',
        header: 'Active (auto)',
        width: 120,
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? 'Yes' : 'No';
          container.style.color = ctx.value ? '#2e7d32' : '#c62828';
          container.style.textAlign = 'center';
        },
      },

      // 11. Boolean with editor: 'text' → force text input
      {
        id: 'activeForcedText',
        header: 'Bool (text)',
        width: 100,
        editor: 'text',
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? 'Yes' : 'No';
          container.style.textAlign = 'center';
        },
      },

      // 12. cellType: 'date' → text input with date formatting
      { id: 'date', header: 'Date', width: 120, cellType: 'date' },

      // 13. Plain string (empty allowed)
      { id: 'notes', header: 'Notes', width: 140 },

      // 14. Read-only column
      { id: 'readonly', header: 'Read-only', width: 110, editable: false },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick' }),
      validation({ validateOn: 'commit' }),
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
        <strong>Columns:</strong> ID (readonly) | Name (text) | Qty (auto-number) | Price (currency, precision: 2) |
        Rate (percent) | Serial (bigint) | Weight (valueModifier) | Status (string dropdown) | Priority (label/value dropdown) |
        Active (auto boolean dropdown) | Bool-text (forced text) | Date | Notes (text) | Read-only
      </div>

      <CodeBlock title="Editor Reference" code={`// All editor types configured via ColumnDef

{ editable: false }           // readonly
{ /* default string */ }      // text input
{ cellType: 'currency',       // text → parses $1,234
  precision: 2 }              // clamp to 2 decimal places
{ cellType: 'percent' }       // text → shows 5, stores 0.05
{ cellType: 'bigint' }        // full-precision large integers
{ valueModifier: {             // custom parse/format
    format: (v) => ...,
    parse: (s) => ... } }
{ cellType: 'date' }          // text → date string
{ options: ['A', 'B'] }       // dropdown (string)
{ options: [                   // dropdown (label/value)
    { label: 'High', value: 1 }
  ]}
{ /* boolean value */ }        // auto Yes/No dropdown
{ editor: 'text' }            // force text for boolean
{ required: true }             // validation required`} />
    </div>
  );
}
