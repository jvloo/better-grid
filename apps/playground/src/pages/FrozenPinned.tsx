import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { formatting, sorting } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface SalesRow {
  id: number;
  region: string;
  product: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  total: number;
}

const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
const products = [
  'Widget Pro', 'Gadget X', 'Sensor Pack', 'IoT Hub', 'Cable Kit',
  'Power Unit', 'Control Board', 'Display Module', 'Battery Cell', 'Antenna Array',
  'Motor Drive', 'Relay Switch', 'Thermal Pad', 'Fiber Link', 'Chip Set',
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = seededRandom(99);

const sampleData: SalesRow[] = products.map((product, i) => {
  const jan = Math.round(rng() * 80000 + 10000);
  const feb = Math.round(rng() * 80000 + 10000);
  const mar = Math.round(rng() * 80000 + 10000);
  const apr = Math.round(rng() * 80000 + 10000);
  const may = Math.round(rng() * 80000 + 10000);
  const jun = Math.round(rng() * 80000 + 10000);
  const jul = Math.round(rng() * 80000 + 10000);
  const aug = Math.round(rng() * 80000 + 10000);
  const sep = Math.round(rng() * 80000 + 10000);
  const oct = Math.round(rng() * 80000 + 10000);
  const nov = Math.round(rng() * 80000 + 10000);
  const dec = Math.round(rng() * 80000 + 10000);
  return {
    id: i + 1,
    region: regions[i % regions.length]!,
    product,
    jan, feb, mar, apr, may, jun,
    jul, aug, sep, oct, nov, dec,
    total: jan + feb + mar + apr + may + jun + jul + aug + sep + oct + nov + dec,
  };
});

const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

const totalsRow: SalesRow = {
  id: 0,
  region: '',
  product: 'TOTAL',
  ...Object.fromEntries(
    monthKeys.map((m) => [m, sampleData.reduce((sum, r) => sum + r[m], 0)]),
  ) as Record<typeof monthKeys[number], number>,
  total: sampleData.reduce((sum, r) => sum + r.total, 0),
};

export function FrozenPinned() {
  const headerRows = useMemo<HeaderRow[]>(
    () => [
      {
        id: 'groups',
        height: 30,
        cells: [
          { id: 'g-info', content: 'Info', colSpan: 3 },
          { id: 'g-q1', content: 'Q1', colSpan: 3 },
          { id: 'g-q2', content: 'Q2', colSpan: 3 },
          { id: 'g-q3', content: 'Q3', colSpan: 3 },
          { id: 'g-q4', content: 'Q4', colSpan: 3 },
          { id: 'g-total', content: 'Annual', rowSpan: 2 },
        ],
      },
      {
        id: 'columns',
        height: 30,
        cells: [
          { id: 'h-id', content: '#', columnId: 'id' },
          { id: 'h-region', content: 'Region', columnId: 'region' },
          { id: 'h-product', content: 'Product', columnId: 'product' },
          { id: 'h-jan', content: 'Jan', columnId: 'jan' },
          { id: 'h-feb', content: 'Feb', columnId: 'feb' },
          { id: 'h-mar', content: 'Mar', columnId: 'mar' },
          { id: 'h-apr', content: 'Apr', columnId: 'apr' },
          { id: 'h-may', content: 'May', columnId: 'may' },
          { id: 'h-jun', content: 'Jun', columnId: 'jun' },
          { id: 'h-jul', content: 'Jul', columnId: 'jul' },
          { id: 'h-aug', content: 'Aug', columnId: 'aug' },
          { id: 'h-sep', content: 'Sep', columnId: 'sep' },
          { id: 'h-oct', content: 'Oct', columnId: 'oct' },
          { id: 'h-nov', content: 'Nov', columnId: 'nov' },
          { id: 'h-dec', content: 'Dec', columnId: 'dec' },
        ],
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<SalesRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40, sortable: true },
      { id: 'region', header: 'Region', width: 130, sortable: true },
      { id: 'product', header: 'Product', width: 130, sortable: true },
      ...monthKeys.map((m) => ({
        id: m,
        header: m.charAt(0).toUpperCase() + m.slice(1),
        width: 100,
        cellType: 'currency' as const,
        precision: 0,
        sortable: true,
      })),
      {
        id: 'total',
        header: 'Total',
        width: 120,
        cellType: 'currency' as const,
        precision: 0,
        sortable: true,
        cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
          const val = ctx.value as number;
          el.textContent = `$${val.toLocaleString()}`;
          el.style.fontWeight = '600';
        },
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      sorting(),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Frozen Columns + Pinned Rows</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Frozen columns stay visible while scrolling horizontally. Pinned footer shows totals.
        Scroll right to see the effect.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Frozen:</strong> #, Region, Product (3 columns) stay locked on the left &bull;
        <strong> Pinned:</strong> TOTAL row pinned to bottom &bull;
        <strong> Headers:</strong> Months grouped into Q1-Q4 spans &bull;
        <strong> Plugins:</strong> Formatting (USD), Sorting, Clipboard
      </div>

      <BetterGrid<SalesRow>
        columns={columns}
        data={sampleData}
        headerRows={headerRows}
        frozenLeftColumns={3}
        pinnedBottomRows={[totalsRow]}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={480}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
        {sampleData.length} rows + 1 pinned footer &bull; {columns.length} columns &bull;
        3 frozen left columns &bull; Multi-header with Q1-Q4 grouping
      </div>
    </div>
  );
}
