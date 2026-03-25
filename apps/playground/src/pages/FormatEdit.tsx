import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing } from '@better-grid/plugins';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface ProductRow {
  id: number;
  name: string;
  category: string;
  price: number;
  cost: number;
  margin: number;
  launchDate: string;
  inStock: boolean;
}

const data: ProductRow[] = [
  { id: 1, name: 'Widget Pro', category: 'Electronics', price: 299.99, cost: 180, margin: 0.4, launchDate: '2026-01-15', inStock: true },
  { id: 2, name: 'Gadget X', category: 'Electronics', price: 149.50, cost: 85, margin: 0.432, launchDate: '2025-06-01', inStock: true },
  { id: 3, name: 'Tool Kit', category: 'Hardware', price: 89.95, cost: 52, margin: 0.4219, launchDate: '2024-11-20', inStock: false },
  { id: 4, name: 'Sensor Pack', category: 'IoT', price: 459, cost: 310, margin: 0.3247, launchDate: '2026-03-10', inStock: true },
  { id: 5, name: 'Cable Bundle', category: 'Accessories', price: 24.99, cost: 8.5, margin: 0.6598, launchDate: '2025-09-05', inStock: true },
  { id: 6, name: 'Display 4K', category: 'Electronics', price: 599, cost: 420, margin: 0.299, launchDate: '2026-02-28', inStock: false },
  { id: 7, name: 'Mount Arm', category: 'Accessories', price: 45, cost: 18, margin: 0.6, launchDate: '2025-04-15', inStock: true },
  { id: 8, name: 'IoT Hub', category: 'IoT', price: 199, cost: 130, margin: 0.3467, launchDate: '2025-12-01', inStock: true },
  { id: 9, name: 'Mesh Router', category: 'Networking', price: 179.99, cost: 105, margin: 0.4167, launchDate: '2025-08-12', inStock: true },
  { id: 10, name: 'USB-C Dock', category: 'Accessories', price: 69.99, cost: 32, margin: 0.5429, launchDate: '2026-01-22', inStock: true },
  { id: 11, name: 'Dev Board v3', category: 'Hardware', price: 54.95, cost: 28, margin: 0.4904, launchDate: '2025-10-08', inStock: false },
  { id: 12, name: 'License Server', category: 'Software', price: 999, cost: 120, margin: 0.8799, launchDate: '2026-03-01', inStock: true },
  { id: 13, name: 'PoE Switch 8-Port', category: 'Networking', price: 249, cost: 165, margin: 0.3373, launchDate: '2025-07-18', inStock: true },
  { id: 14, name: 'Thermal Camera', category: 'Electronics', price: 849, cost: 580, margin: 0.3168, launchDate: '2025-11-30', inStock: false },
  { id: 15, name: 'Edge Gateway', category: 'IoT', price: 349, cost: 215, margin: 0.384, launchDate: '2026-02-14', inStock: true },
  { id: 16, name: 'Torque Driver Set', category: 'Hardware', price: 39.99, cost: 16, margin: 0.5999, launchDate: '2025-03-25', inStock: true },
  { id: 17, name: 'Analytics Suite', category: 'Software', price: 499, cost: 60, margin: 0.8797, launchDate: '2025-05-10', inStock: true },
  { id: 18, name: 'Wireless Charger', category: 'Accessories', price: 34.99, cost: 14, margin: 0.5999, launchDate: '2026-01-05', inStock: false },
  { id: 19, name: 'Fiber Patch Panel', category: 'Networking', price: 129, cost: 72, margin: 0.4419, launchDate: '2025-09-20', inStock: true },
  { id: 20, name: 'Smart Relay', category: 'IoT', price: 89, cost: 48, margin: 0.4607, launchDate: '2026-03-18', inStock: true },
];

export function FormatEdit() {
  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40, editable: false },
      { id: 'name', header: 'Product', width: 155 },
      {
        id: 'category',
        header: 'Category',
        width: 110,
        options: ['Electronics', 'Hardware', 'IoT', 'Accessories', 'Software', 'Networking'],
      },
      { id: 'price', header: 'Price', width: 100, cellType: 'currency' },
      { id: 'cost', header: 'Cost', width: 100, cellType: 'currency' },
      { id: 'margin', header: 'Margin', width: 80, cellType: 'percent' },
      { id: 'launchDate', header: 'Launch', width: 120, cellType: 'date' },
      {
        id: 'inStock',
        header: 'In Stock',
        width: 80,
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? '✓' : '✗';
          container.style.color = ctx.value ? '#2e7d32' : '#c62828';
          container.style.textAlign = 'center';
          container.style.fontWeight = '600';
        },
      },
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
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Formatting & Editing</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        <code>formatting()</code> + <code>editing()</code> plugins. Compare with Core Only — same data, different presentation.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Formatting:</strong> Price/Cost → <code>$299.99</code> &bull; Margin → <code>40%</code> &bull; Launch → <code>Jan 15, 2026</code>
        <br />
        <strong>Editing:</strong> Double-click any cell &bull; Category → dropdown &bull; In Stock → Yes/No toggle &bull; Margin → type "40", stores 0.4
      </div>

      <BetterGrid<ProductRow>
        columns={columns}
        data={data}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={380}
      />

      <CodeBlock title="Format & Edit" code={`import { formatting, editing } from '@better-grid/plugins';

const columns = [
  { id: 'id', header: '#', width: 40, editable: false },
  { id: 'name', header: 'Product', width: 140 },
  { id: 'category', header: 'Category', width: 110,
    options: ['Electronics', 'Hardware', 'IoT', 'Accessories', 'Software', 'Networking'] },
  { id: 'price', header: 'Price', width: 100,
    cellType: 'currency' },             // → $299.99
  { id: 'cost', header: 'Cost', width: 100,
    cellType: 'currency' },             // → $180.00
  { id: 'margin', header: 'Margin', width: 90,
    cellType: 'percent' },              // → 40%
  { id: 'launchDate', header: 'Launch', width: 120,
    cellType: 'date' },                 // → Jan 15, 2026
  { id: 'inStock', header: 'In Stock', width: 80,
    cellRenderer: (el, ctx) => {
      el.textContent = ctx.value ? '✓' : '✗';
      el.style.color = ctx.value ? '#2e7d32' : '#c62828';
      el.style.textAlign = 'center';
    },
  },
];

<BetterGrid
  columns={columns}
  data={products}
  frozenLeftColumns={2}
  plugins={[
    formatting({ locale: 'en-US', currencyCode: 'USD',
                 accountingFormat: true }),
    editing({ editTrigger: 'dblclick' }),
  ]}
/>`} />
    </div>
  );
}
