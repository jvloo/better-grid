import { useMemo } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, cellRenderers } from '@better-grid/plugins';
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

const columns: ColumnDef<Row>[] = [
  { id: 'product', header: 'Product', width: 180 },
  { id: 'category', header: 'Category', width: 120 },
  { id: 'price', header: 'Price', width: 90, cellType: 'currency', precision: 2, align: 'right' },
  { id: 'stock', header: 'Stock', width: 80, align: 'right' },
  { id: 'rating', header: 'Rating', width: 90, cellType: 'rating' },
];

const plugins = [
  formatting({ locale: 'en-US', currencyCode: 'USD' }),
  cellRenderers(),
];

function GridCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: '0 0 10px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>{description}</p>
      {children}
    </div>
  );
}

// ─── Grid 1: No selection (default) ──────────────────────────────────────────

function NoSelectionGrid() {
  const cols = useMemo(() => [...columns], []);
  const pl = useMemo(() => [...plugins], []);

  const { containerRef } = useGrid<Row>({
    data,
    columns: cols,
    plugins: pl,
    rowHeight: 36,
    // No selection prop — selection is disabled
  });

  return (
    <div
      ref={containerRef}
      style={{ height: 320, width: '100%', position: 'relative', overflow: 'hidden', border: '1px solid #e0e0e0', borderRadius: 8 }}
    />
  );
}

// ─── Grid 2: Cell mode ───────────────────────────────────────────────────────

function CellModeGrid() {
  const cols = useMemo(() => [...columns], []);
  const pl = useMemo(() => [...plugins], []);

  const { containerRef } = useGrid<Row>({
    data,
    columns: cols,
    plugins: pl,
    selection: { mode: 'cell' },
    rowHeight: 36,
  });

  return (
    <div
      ref={containerRef}
      style={{ height: 320, width: '100%', position: 'relative', overflow: 'hidden', border: '1px solid #e0e0e0', borderRadius: 8 }}
    />
  );
}

// ─── Grid 3: Range mode ──────────────────────────────────────────────────────

function RangeModeGrid() {
  const cols = useMemo(() => [...columns], []);
  const pl = useMemo(() => [...plugins], []);

  const { containerRef } = useGrid<Row>({
    data,
    columns: cols,
    plugins: pl,
    selection: { mode: 'range' },
    rowHeight: 36,
  });

  return (
    <div
      ref={containerRef}
      style={{ height: 320, width: '100%', position: 'relative', overflow: 'hidden', border: '1px solid #e0e0e0', borderRadius: 8 }}
    />
  );
}

// ─── Grid 4: Range + fill handle ─────────────────────────────────────────────

function RangeFillGrid() {
  const cols = useMemo(() => [...columns], []);
  const pl = useMemo(() => [...plugins], []);

  const { containerRef } = useGrid<Row>({
    data,
    columns: cols,
    plugins: pl,
    selection: { mode: 'range', fillHandle: true },
    rowHeight: 36,
  });

  return (
    <div
      ref={containerRef}
      style={{ height: 320, width: '100%', position: 'relative', overflow: 'hidden', border: '1px solid #e0e0e0', borderRadius: 8 }}
    />
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SelectionModes() {
  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600 }}>Selection Modes</h1>
      <p style={{ margin: '0 0 24px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Selection is <strong>disabled by default</strong>. Pass the <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>selection</code> prop to enable it. Each mode controls what the user can do with clicks, keyboard, and drag.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <GridCard
          title="No selection (default)"
          description="No selection prop passed. Clicking cells does nothing. Arrow keys don't navigate. Pure read-only display."
        >
          <NoSelectionGrid />
        </GridCard>

        <GridCard
          title='selection: { mode: "cell" }'
          description="Click selects a single cell. Arrow keys move between cells. Shift+click and Ctrl+click have no effect — no range extension, no multi-select."
        >
          <CellModeGrid />
        </GridCard>

        <GridCard
          title='selection: { mode: "range" }'
          description="Click selects a cell. Shift+click extends to a range. Ctrl+click adds additional ranges. Shift+Arrow extends range via keyboard."
        >
          <RangeModeGrid />
        </GridCard>

        <GridCard
          title='selection: { mode: "range", fillHandle: true }'
          description="Same as range mode, plus a small square handle at the bottom-right corner of the selection. Drag it to fill cells with values from the selected range."
        >
          <RangeFillGrid />
        </GridCard>
      </div>
    </div>
  );
}
