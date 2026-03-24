import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing } from '@better-grid/plugins';
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
];

export function FormatEdit() {
  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      { id: 'id', header: 'ID', width: 45, editable: false },
      { id: 'name', header: 'Product', width: 140 },
      {
        id: 'category',
        header: 'Category',
        width: 110,
        options: ['Electronics', 'Hardware', 'IoT', 'Accessories'],
      },
      { id: 'price', header: 'Price', width: 100, cellType: 'currency' },
      { id: 'cost', header: 'Cost', width: 100, cellType: 'currency' },
      { id: 'margin', header: 'Margin', width: 90, cellType: 'percent' },
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
    </div>
  );
}
