import { useMemo, useState } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, validation } from '@better-grid/plugins';
import { CodeBlock } from '../components/CodeBlock';
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
  { id: 7, customer: 'Eta Systems', product: 'Relay F', quantity: 30, unitPrice: 42.00, discount: 0.12, email: 'sales@eta-systems.io', status: 'Confirmed' },
  { id: 8, customer: '', product: 'Module G', quantity: 15, unitPrice: 310, discount: 0.25, email: 'info@theta.com', status: 'Pending' },
  { id: 9, customer: 'Iota Corp', product: 'Bracket H', quantity: -10, unitPrice: 8.75, discount: 0.03, email: 'iota@corp.net', status: 'Shipped' },
  { id: 10, customer: 'Kappa Ltd', product: 'Valve I', quantity: 500, unitPrice: 3.20, discount: 0.55, email: 'kappa@kappa.com', status: 'Confirmed' },
  { id: 11, customer: 'Lambda Inc', product: 'Pipe J', quantity: 60, unitPrice: 18.50, discount: 0.1, email: 'notanemail', status: 'Draft' },
  { id: 12, customer: 'Mu Logistics', product: 'Gear K', quantity: 250, unitPrice: 7.99, discount: 0.08, email: 'orders@mulog.com', status: 'Shipped' },
  { id: 13, customer: 'Nu Design', product: '', quantity: 40, unitPrice: 125, discount: 0.3, email: 'hello@nudesign.co', status: 'Pending' },
  { id: 14, customer: 'Xi Partners', product: 'Washer L', quantity: 1000, unitPrice: 0.50, discount: 0, email: 'xi@partners.org', status: 'Confirmed' },
  { id: 15, customer: '', product: 'Bolt M', quantity: 0, unitPrice: 1.25, discount: 0.7, email: '', status: 'Draft' },
  { id: 16, customer: 'Omicron Tech', product: 'Panel N', quantity: 80, unitPrice: 65, discount: 0.18, email: 'tech@omicron.dev', status: 'Shipped' },
  { id: 17, customer: 'Pi Electronics', product: 'Diode O', quantity: 300, unitPrice: 2.10, discount: 0.04, email: 'pi@electronics.com', status: 'Confirmed' },
  { id: 18, customer: 'Rho Supply', product: 'Spring P', quantity: -3, unitPrice: 14.00, discount: 0.6, email: 'bad@@email', status: 'Pending' },
  { id: 19, customer: 'Sigma Mfg', product: 'Clamp Q', quantity: 150, unitPrice: 9.80, discount: 0.22, email: 'sigma@mfg.com', status: 'Shipped' },
  { id: 20, customer: 'Tau Industries', product: 'Hose R', quantity: 45, unitPrice: 33.00, discount: 0.15, email: 'orders@tau.industries', status: 'Confirmed' },
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
        align: 'right',
        rules: [
          { validate: (v) => (v as number) > 0 || 'Must be > 0' },
        ],
      },
      {
        id: 'unitPrice',
        header: 'Unit Price',
        width: 100,
        cellType: 'currency',
        precision: 2,
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
        width: 190,
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
        <strong>Pre-populated errors:</strong> Rows 2, 8, 15 missing customer &bull; Rows 3, 13 missing product &bull;
        Rows 3, 9, 18 negative qty &bull; Row 5 qty = 0 &bull; Rows 3, 11, 18 invalid email &bull;
        Rows 6, 15 missing email &bull; Rows 4, 10, 15, 18 discount &gt; 50%
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

      <CodeBlock title="Validation" code={`import { formatting, editing, validation } from '@better-grid/plugins';

const columns = [
  { id: 'id', header: '#', width: 40, editable: false },
  { id: 'customer', header: 'Customer', width: 130,
    required: true },
  { id: 'product', header: 'Product', width: 110,
    required: true },
  { id: 'quantity', header: 'Qty', width: 70,
    rules: [{
      validate: (v) => v > 0 || 'Must be > 0'
    }] },
  { id: 'unitPrice', header: 'Unit Price', width: 100,
    cellType: 'currency',
    precision: 2,
    rules: [{
      validate: (v) => v >= 0 || 'Cannot be negative'
    }] },
  { id: 'discount', header: 'Discount', width: 90,
    cellType: 'percent',
    rules: [{
      validate: (v) => v >= 0 && v <= 0.5 || 'Max 50%'
    }] },
  { id: 'email', header: 'Email', width: 160,
    required: true,
    rules: [{
      validate: (v) => /@/.test(v) || 'Invalid email'
    }] },
  { id: 'status', header: 'Status', width: 100,
    options: ['Draft', 'Pending', 'Confirmed', 'Shipped'] },
];

<BetterGrid
  columns={columns}
  data={orders}
  plugins={[
    formatting({ locale: 'en-US', currencyCode: 'USD' }),
    editing({ editTrigger: 'dblclick' }),
    validation({ validateOn: 'all' }),
  ]}
/>`} />
    </div>
  );
}
