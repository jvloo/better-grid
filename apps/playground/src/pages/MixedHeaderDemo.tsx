import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { formatting } from '@better-grid/plugins';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface SalesRow {
  id: number;
  product: string;
  region: string;
  q1Rev: number;
  q1Units: number;
  q2Rev: number;
  q2Units: number;
  ytdTotal: number;
  margin: number;
}

const data: SalesRow[] = [
  { id: 1, product: 'Widget Pro', region: 'North America', q1Rev: 245000, q1Units: 820, q2Rev: 312000, q2Units: 1040, ytdTotal: 557000, margin: 0.38 },
  { id: 2, product: 'Widget Pro', region: 'Europe', q1Rev: 178000, q1Units: 595, q2Rev: 203000, q2Units: 677, ytdTotal: 381000, margin: 0.35 },
  { id: 3, product: 'Widget Pro', region: 'Asia Pacific', q1Rev: 156000, q1Units: 520, q2Rev: 198000, q2Units: 660, ytdTotal: 354000, margin: 0.32 },
  { id: 4, product: 'Gadget X', region: 'North America', q1Rev: 89000, q1Units: 445, q2Rev: 112000, q2Units: 560, ytdTotal: 201000, margin: 0.42 },
  { id: 5, product: 'Gadget X', region: 'Europe', q1Rev: 67000, q1Units: 335, q2Rev: 78000, q2Units: 390, ytdTotal: 145000, margin: 0.40 },
  { id: 6, product: 'Gadget X', region: 'Asia Pacific', q1Rev: 95000, q1Units: 475, q2Rev: 125000, q2Units: 625, ytdTotal: 220000, margin: 0.37 },
  { id: 7, product: 'Sensor Pack', region: 'North America', q1Rev: 340000, q1Units: 680, q2Rev: 385000, q2Units: 770, ytdTotal: 725000, margin: 0.45 },
  { id: 8, product: 'Sensor Pack', region: 'Europe', q1Rev: 210000, q1Units: 420, q2Rev: 255000, q2Units: 510, ytdTotal: 465000, margin: 0.41 },
  { id: 9, product: 'IoT Hub', region: 'North America', q1Rev: 128000, q1Units: 320, q2Rev: 165000, q2Units: 412, ytdTotal: 293000, margin: 0.48 },
  { id: 10, product: 'IoT Hub', region: 'Asia Pacific', q1Rev: 185000, q1Units: 462, q2Rev: 220000, q2Units: 550, ytdTotal: 405000, margin: 0.44 },
  { id: 11, product: 'Sensor Pack', region: 'Asia Pacific', q1Rev: 275000, q1Units: 550, q2Rev: 310000, q2Units: 620, ytdTotal: 585000, margin: 0.39 },
  { id: 12, product: 'IoT Hub', region: 'Europe', q1Rev: 142000, q1Units: 355, q2Rev: 178000, q2Units: 445, ytdTotal: 320000, margin: 0.46 },
  { id: 13, product: 'Cable Kit', region: 'North America', q1Rev: 52000, q1Units: 1300, q2Rev: 68000, q2Units: 1700, ytdTotal: 120000, margin: 0.33 },
  { id: 14, product: 'Cable Kit', region: 'Europe', q1Rev: 38000, q1Units: 950, q2Rev: 45000, q2Units: 1125, ytdTotal: 83000, margin: 0.31 },
  { id: 15, product: 'Cable Kit', region: 'Asia Pacific', q1Rev: 61000, q1Units: 1525, q2Rev: 74000, q2Units: 1850, ytdTotal: 135000, margin: 0.34 },
  { id: 16, product: 'Widget Pro', region: 'Latin America', q1Rev: 98000, q1Units: 327, q2Rev: 125000, q2Units: 417, ytdTotal: 223000, margin: 0.36 },
  { id: 17, product: 'Gadget X', region: 'Latin America', q1Rev: 54000, q1Units: 270, q2Rev: 72000, q2Units: 360, ytdTotal: 126000, margin: 0.38 },
  { id: 18, product: 'Sensor Pack', region: 'Latin America', q1Rev: 192000, q1Units: 384, q2Rev: 228000, q2Units: 456, ytdTotal: 420000, margin: 0.43 },
  { id: 19, product: 'IoT Hub', region: 'Latin America', q1Rev: 105000, q1Units: 262, q2Rev: 138000, q2Units: 345, ytdTotal: 243000, margin: 0.47 },
  { id: 20, product: 'Cable Kit', region: 'Latin America', q1Rev: 42000, q1Units: 1050, q2Rev: 56000, q2Units: 1400, ytdTotal: 98000, margin: 0.32 },
];

export function MixedHeaderDemo() {
  // Mixed headers: colSpan + rowSpan
  // |  Product Info  |    Q1 (2 cols)    |    Q2 (2 cols)    |  YTD   | Margin |
  // |  #  | Product  | Region | Revenue  | Units | Revenue | Units  | (rSpan)| (rSpan)|
  //
  // "YTD Total" and "Margin" span both rows (rowSpan: 2)
  const headerRows = useMemo<HeaderRow[]>(
    () => [
      {
        id: 'groups',
        height: 32,
        cells: [
          { id: 'g-info', content: 'Product Info', colSpan: 3 },
          { id: 'g-q1', content: 'Q1', colSpan: 2 },
          { id: 'g-q2', content: 'Q2', colSpan: 2 },
          { id: 'g-ytd', content: 'YTD Total', rowSpan: 2 },
          { id: 'g-margin', content: 'Margin', rowSpan: 2 },
        ],
      },
      {
        id: 'columns',
        height: 32,
        cells: [
          { id: 'h-id', content: '#', columnId: 'id' },
          { id: 'h-product', content: 'Product', columnId: 'product' },
          { id: 'h-region', content: 'Region', columnId: 'region' },
          // YTD and Margin are skipped — occupied by rowSpan from row above
          { id: 'h-q1rev', content: 'Revenue', columnId: 'q1Rev' },
          { id: 'h-q1units', content: 'Units', columnId: 'q1Units' },
          { id: 'h-q2rev', content: 'Revenue', columnId: 'q2Rev' },
          { id: 'h-q2units', content: 'Units', columnId: 'q2Units' },
        ],
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<SalesRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40 },
      { id: 'product', header: 'Product', width: 120 },
      { id: 'region', header: 'Region', width: 120 },
      { id: 'q1Rev', header: 'Revenue', width: 110, cellType: 'currency' },
      { id: 'q1Units', header: 'Units', width: 80 },
      { id: 'q2Rev', header: 'Revenue', width: 110, cellType: 'currency' },
      { id: 'q2Units', header: 'Units', width: 80 },
      {
        id: 'ytdTotal',
        header: 'YTD Total',
        width: 120,
        cellType: 'currency',
        cellRenderer: (el, ctx) => {
          const val = ctx.value as number;
          el.textContent = `$${val.toLocaleString()}`;
          el.style.fontWeight = '600';
          el.style.color = val >= 400000 ? '#2e7d32' : '#333';
        },
      },
      {
        id: 'margin',
        header: 'Margin',
        width: 80,
        cellType: 'percent',
        cellRenderer: (el, ctx) => {
          const val = ctx.value as number;
          el.textContent = `${(val * 100).toFixed(0)}%`;
          el.style.fontWeight = '500';
          el.style.color = val >= 0.4 ? '#2e7d32' : val >= 0.35 ? '#f57f17' : '#c62828';
        },
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [formatting({ locale: 'en-US', currencyCode: 'USD' })],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Mixed Headers — colSpan + rowSpan</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Group headers with <code>colSpan</code> and summary columns with <code>rowSpan</code>.
        "YTD Total" and "Margin" span both header rows — no sub-columns needed.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Layout:</strong> Product Info (3 cols) &bull; Q1 (2 cols) &bull; Q2 (2 cols) &bull; YTD Total (rowSpan: 2) &bull; Margin (rowSpan: 2)
        <br />
        <strong>Frozen:</strong> #, Product, Region stay on left during horizontal scroll.
      </div>

      <BetterGrid<SalesRow>
        columns={columns}
        data={data}
        headerRows={headerRows}
        frozenLeftColumns={3}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={440}
      />

      <CodeBlock title="Mixed Headers" code={`// Mixed headers: colSpan groups + rowSpan summary columns

const headerRows = [
  { id: 'groups', height: 32, cells: [
    { id: 'g-info', content: 'Product Info', colSpan: 3 },
    { id: 'g-q1', content: 'Q1', colSpan: 2 },
    { id: 'g-q2', content: 'Q2', colSpan: 2 },
    { id: 'g-ytd', content: 'YTD Total', rowSpan: 2 },
    { id: 'g-margin', content: 'Margin', rowSpan: 2 },
  ]},
  { id: 'columns', height: 32, cells: [
    { id: 'h-id', content: '#', columnId: 'id' },
    { id: 'h-product', content: 'Product', columnId: 'product' },
    { id: 'h-region', content: 'Region', columnId: 'region' },
    // YTD & Margin skipped — occupied by rowSpan
    { id: 'h-q1rev', content: 'Revenue', columnId: 'q1Rev' },
    { id: 'h-q1units', content: 'Units', columnId: 'q1Units' },
    { id: 'h-q2rev', content: 'Revenue', columnId: 'q2Rev' },
    { id: 'h-q2units', content: 'Units', columnId: 'q2Units' },
  ]},
];

<BetterGrid
  columns={columns}
  data={data}
  headerRows={headerRows}
  frozenLeftColumns={3}
  plugins={[formatting({ currencyCode: 'USD' })]}
/>`} />
    </div>
  );
}
