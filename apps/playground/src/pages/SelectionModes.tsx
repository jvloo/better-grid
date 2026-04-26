import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface Row {
  id: number;
  product: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
}

const data: Row[] = [
  { id: 1, product: 'Wireless Mouse', category: 'Peripherals', price: 29.99, stock: 150, rating: 4 },
  { id: 2, product: 'Mechanical Keyboard', category: 'Peripherals', price: 89.99, stock: 75, rating: 5 },
  { id: 3, product: 'USB-C Hub', category: 'Accessories', price: 49.99, stock: 200, rating: 3 },
  { id: 4, product: '27" Monitor', category: 'Displays', price: 349.99, stock: 30, rating: 5 },
  { id: 5, product: 'Webcam HD', category: 'Peripherals', price: 69.99, stock: 90, rating: 4 },
  { id: 6, product: 'Laptop Stand', category: 'Accessories', price: 39.99, stock: 120, rating: 4 },
  { id: 7, product: 'Noise-Cancel Headset', category: 'Audio', price: 199.99, stock: 45, rating: 5 },
  { id: 8, product: 'Desk Lamp LED', category: 'Accessories', price: 24.99, stock: 300, rating: 3 },
];

const columns = [
  col.text('product', { headerName: 'Product', width: 180 }),
  col.text('category', { headerName: 'Category', width: 120 }),
  col.currency('price', { headerName: 'Price', width: 90, precision: 2 }),
  col.number('stock', { headerName: 'Stock', width: 80 }),
  col.rating('rating', { headerName: 'Rating', width: 90 }),
] as ColumnDef<Row>[];

const FORMAT_FEATURE = { format: { locale: 'en-US', currencyCode: 'USD' } };

function GridCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: '0 0 10px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>{description}</p>
      {children}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SelectionModes() {
  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600 }}>Selection Modes</h1>
      <p style={{ margin: '0 0 24px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Selection defaults to <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>{'{ mode: "cell" }'}</code> when the <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>selection</code> prop is omitted. Pass <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>selection={'{false}'}</code> to disable. <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>range</code> mode enables Shift+click; add <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>multiRange: true</code> for Ctrl+click multi-range.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <GridCard
          title="selection: false"
          description="Selection turned off. Clicking cells does nothing — pure read-only display. Use this when the grid is purely a display surface (dashboards, reports)."
        >
          <BetterGrid<Row>
            columns={columns}
            data={data}
            mode={null}
            features={FORMAT_FEATURE}
            selection={false}
            rowHeight={36}
            height={320}
            style={{ borderRadius: 8 }}
          />
        </GridCard>

        <GridCard
          title="Default — no selection prop"
          description='Omitting the prop is equivalent to selection={{ mode: "cell" }}. Click selects a single cell. Arrow keys move between cells. Shift+click and Ctrl+click have no effect.'
        >
          <BetterGrid<Row>
            columns={columns}
            data={data}
            mode={null}
            features={FORMAT_FEATURE}
            rowHeight={36}
            height={320}
            style={{ borderRadius: 8 }}
          />
        </GridCard>

        <GridCard
          title='selection: { mode: "range" }'
          description="Click selects a cell. Shift+click extends to a range. Shift+Arrow extends via keyboard. The bottom-right fill handle is on by default — drag to fill from the selected range. Ctrl+click does NOT add additional ranges (see next tile)."
        >
          <BetterGrid<Row>
            columns={columns}
            data={data}
            mode={null}
            features={FORMAT_FEATURE}
            selection={{ mode: 'range' }}
            rowHeight={36}
            height={320}
            style={{ borderRadius: 8 }}
          />
        </GridCard>

        <GridCard
          title='selection: { mode: "range", multiRange: true }'
          description="Range mode with Ctrl+click multi-range. Click + Shift+click selects one range; Ctrl+click adds another disjoint range. Use when consumers need to apply a single operation to several discontiguous regions."
        >
          <BetterGrid<Row>
            columns={columns}
            data={data}
            mode={null}
            features={FORMAT_FEATURE}
            selection={{ mode: 'range', multiRange: true }}
            rowHeight={36}
            height={320}
            style={{ borderRadius: 8 }}
          />
        </GridCard>

        <GridCard
          title='selection: { mode: "range", fillHandle: false }'
          description="Range mode with the bottom-right fill handle suppressed. Selection still works (click, Shift+click) but no draggable square appears. Use when the grid should not allow value-fill (e.g. read-only ranges that consumers may copy from)."
        >
          <BetterGrid<Row>
            columns={columns}
            data={data}
            mode={null}
            features={FORMAT_FEATURE}
            selection={{ mode: 'range', fillHandle: false }}
            rowHeight={36}
            height={320}
            style={{ borderRadius: 8 }}
          />
        </GridCard>
      </div>
    </div>
  );
}

