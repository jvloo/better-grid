import { useMemo, useState } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, validation } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface OrderRow {
  id: number;
  customer: string;
  product: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  email: string;
  status: string;
}

// Some rows have intentionally invalid data
const initialData: OrderRow[] = [
  { id: 1, customer: 'Acme Corp', product: 'Widget A', quantity: 100, unitPrice: 25, discount: 0.1, email: 'orders@acme.com', status: 'Confirmed' },
  { id: 2, customer: '', product: 'Gadget B', quantity: 50, unitPrice: 49.99, discount: 0.05, email: 'buy@beta.com', status: 'Pending' },
  { id: 3, customer: 'Gamma LLC', product: '', quantity: -5, unitPrice: 199, discount: 0.15, email: 'invalid-email', status: 'Confirmed' },
  { id: 4, customer: 'Delta Inc', product: 'Sensor C', quantity: 200, unitPrice: 12.50, discount: 0.8, email: 'delta@example.com', status: 'Shipped' },
  { id: 5, customer: 'Epsilon Co', product: 'Cable D', quantity: 0, unitPrice: 5.99, discount: 0, email: 'eps@epsilon.co', status: 'Pending' },
  { id: 6, customer: 'Zeta Ltd', product: 'Board E', quantity: 75, unitPrice: 85, discount: 0.2, email: '', status: 'Draft' },
];

export function ValidationDemo() {
  const [data] = useState(initialData);

  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40, editable: false },
      {
        id: 'customer',
        header: 'Customer',
        width: 130,
        required: true,
      },
      {
        id: 'product',
        header: 'Product',
        width: 110,
        required: true,
      },
      {
        id: 'quantity',
        header: 'Qty',
        width: 70,
        rules: [
          { validate: (v) => (v as number) > 0 || 'Must be > 0' },
        ],
      },
      {
        id: 'unitPrice',
        header: 'Unit Price',
        width: 100,
        cellType: 'currency',
        rules: [
          { validate: (v) => (v as number) >= 0 || 'Cannot be negative' },
        ],
      },
      {
        id: 'discount',
        header: 'Discount',
        width: 90,
        cellType: 'percent',
        rules: [
          { validate: (v) => { const n = v as number; return (n >= 0 && n <= 0.5) || 'Max 50%'; } },
        ],
      },
      {
        id: 'email',
        header: 'Email',
        width: 160,
        required: true,
        rules: [
          { validate: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || 'Invalid email' },
        ],
      },
      {
        id: 'status',
        header: 'Status',
        width: 100,
        options: ['Draft', 'Pending', 'Confirmed', 'Shipped'],
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      editing({ editTrigger: 'dblclick' }),
      validation({ validateOn: 'all' }),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Validation</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        <code>validation()</code> plugin with <code>validateOn: 'all'</code> — errors shown immediately on load.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Pre-populated errors:</strong> Row 2 missing customer &bull; Row 3 missing product, negative qty, invalid email &bull;
        Row 4 discount &gt; 50% &bull; Row 5 qty = 0 &bull; Row 6 missing email
        <br />
        <strong>Fix:</strong> Double-click an error cell, correct the value, press Enter. Red border clears.
        <br />
        <strong>Break:</strong> Clear a required field or enter a negative qty to see new errors.
      </div>

      <BetterGrid<OrderRow>
        columns={columns}
        data={data}
        frozenLeftColumns={1}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={320}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa' }}>
        Red outline = validation error. Hover cell for error message tooltip.
      </div>
    </div>
  );
}
