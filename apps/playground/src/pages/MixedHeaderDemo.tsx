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
  q3Rev: number;
  q3Units: number;
  q4Rev: number;
  q4Units: number;
  ytdTotal: number;
  growth: number;
  margin: number;
}

const data: SalesRow[] = [
  { id: 1, product: 'Widget Pro', region: 'North America', q1Rev: 245000, q1Units: 820, q2Rev: 312000, q2Units: 1040, q3Rev: 298000, q3Units: 993, q4Rev: 335000, q4Units: 1117, ytdTotal: 1190000, growth: 0.18, margin: 0.38 },
  { id: 2, product: 'Widget Pro', region: 'Europe', q1Rev: 178000, q1Units: 595, q2Rev: 203000, q2Units: 677, q3Rev: 195000, q3Units: 650, q4Rev: 218000, q4Units: 727, ytdTotal: 794000, growth: 0.12, margin: 0.35 },
  { id: 3, product: 'Widget Pro', region: 'Asia Pacific', q1Rev: 156000, q1Units: 520, q2Rev: 198000, q2Units: 660, q3Rev: 210000, q3Units: 700, q4Rev: 225000, q4Units: 750, ytdTotal: 789000, growth: 0.22, margin: 0.32 },
  { id: 4, product: 'Gadget X', region: 'North America', q1Rev: 89000, q1Units: 445, q2Rev: 112000, q2Units: 560, q3Rev: 105000, q3Units: 525, q4Rev: 128000, q4Units: 640, ytdTotal: 434000, growth: 0.15, margin: 0.42 },
  { id: 5, product: 'Gadget X', region: 'Europe', q1Rev: 67000, q1Units: 335, q2Rev: 78000, q2Units: 390, q3Rev: 82000, q3Units: 410, q4Rev: 91000, q4Units: 455, ytdTotal: 318000, growth: 0.08, margin: 0.40 },
  { id: 6, product: 'Gadget X', region: 'Asia Pacific', q1Rev: 95000, q1Units: 475, q2Rev: 125000, q2Units: 625, q3Rev: 118000, q3Units: 590, q4Rev: 140000, q4Units: 700, ytdTotal: 478000, growth: 0.25, margin: 0.37 },
  { id: 7, product: 'Sensor Pack', region: 'North America', q1Rev: 340000, q1Units: 680, q2Rev: 385000, q2Units: 770, q3Rev: 370000, q3Units: 740, q4Rev: 410000, q4Units: 820, ytdTotal: 1505000, growth: 0.14, margin: 0.45 },
  { id: 8, product: 'Sensor Pack', region: 'Europe', q1Rev: 210000, q1Units: 420, q2Rev: 255000, q2Units: 510, q3Rev: 240000, q3Units: 480, q4Rev: 268000, q4Units: 536, ytdTotal: 973000, growth: 0.11, margin: 0.41 },
  { id: 9, product: 'IoT Hub', region: 'North America', q1Rev: 128000, q1Units: 320, q2Rev: 165000, q2Units: 412, q3Rev: 155000, q3Units: 388, q4Rev: 180000, q4Units: 450, ytdTotal: 628000, growth: 0.20, margin: 0.48 },
  { id: 10, product: 'IoT Hub', region: 'Asia Pacific', q1Rev: 185000, q1Units: 462, q2Rev: 220000, q2Units: 550, q3Rev: 235000, q3Units: 588, q4Rev: 260000, q4Units: 650, ytdTotal: 900000, growth: 0.28, margin: 0.44 },
  { id: 11, product: 'Sensor Pack', region: 'Asia Pacific', q1Rev: 275000, q1Units: 550, q2Rev: 310000, q2Units: 620, q3Rev: 295000, q3Units: 590, q4Rev: 330000, q4Units: 660, ytdTotal: 1210000, growth: 0.16, margin: 0.39 },
  { id: 12, product: 'IoT Hub', region: 'Europe', q1Rev: 142000, q1Units: 355, q2Rev: 178000, q2Units: 445, q3Rev: 168000, q3Units: 420, q4Rev: 192000, q4Units: 480, ytdTotal: 680000, growth: 0.19, margin: 0.46 },
  { id: 13, product: 'Cable Kit', region: 'North America', q1Rev: 52000, q1Units: 1300, q2Rev: 68000, q2Units: 1700, q3Rev: 62000, q3Units: 1550, q4Rev: 75000, q4Units: 1875, ytdTotal: 257000, growth: 0.10, margin: 0.33 },
  { id: 14, product: 'Cable Kit', region: 'Europe', q1Rev: 38000, q1Units: 950, q2Rev: 45000, q2Units: 1125, q3Rev: 42000, q3Units: 1050, q4Rev: 50000, q4Units: 1250, ytdTotal: 175000, growth: 0.07, margin: 0.31 },
  { id: 15, product: 'Cable Kit', region: 'Asia Pacific', q1Rev: 61000, q1Units: 1525, q2Rev: 74000, q2Units: 1850, q3Rev: 70000, q3Units: 1750, q4Rev: 82000, q4Units: 2050, ytdTotal: 287000, growth: 0.13, margin: 0.34 },
  { id: 16, product: 'Widget Pro', region: 'Latin America', q1Rev: 98000, q1Units: 327, q2Rev: 125000, q2Units: 417, q3Rev: 115000, q3Units: 383, q4Rev: 138000, q4Units: 460, ytdTotal: 476000, growth: 0.21, margin: 0.36 },
  { id: 17, product: 'Gadget X', region: 'Latin America', q1Rev: 54000, q1Units: 270, q2Rev: 72000, q2Units: 360, q3Rev: 65000, q3Units: 325, q4Rev: 80000, q4Units: 400, ytdTotal: 271000, growth: 0.17, margin: 0.38 },
  { id: 18, product: 'Sensor Pack', region: 'Latin America', q1Rev: 192000, q1Units: 384, q2Rev: 228000, q2Units: 456, q3Rev: 215000, q3Units: 430, q4Rev: 248000, q4Units: 496, ytdTotal: 883000, growth: 0.15, margin: 0.43 },
  { id: 19, product: 'IoT Hub', region: 'Latin America', q1Rev: 105000, q1Units: 262, q2Rev: 138000, q2Units: 345, q3Rev: 130000, q3Units: 325, q4Rev: 152000, q4Units: 380, ytdTotal: 525000, growth: 0.23, margin: 0.47 },
  { id: 20, product: 'Cable Kit', region: 'Latin America', q1Rev: 42000, q1Units: 1050, q2Rev: 56000, q2Units: 1400, q3Rev: 50000, q3Units: 1250, q4Rev: 62000, q4Units: 1550, ytdTotal: 210000, growth: 0.09, margin: 0.32 },
];

export function MixedHeaderDemo() {
  // Mixed headers: colSpan + rowSpan
  // |  Product Info (3)  |  Q1 (2)  |  Q2 (2)  |  Q3 (2)  |  Q4 (2)  | YTD  | Growth | Margin |
  // |  # | Product | Reg  | Rev | Un | Rev | Un | Rev | Un | Rev | Un | (rS2)| (rS2)  | (rS2)  |
  const headerRows = useMemo<HeaderRow[]>(
    () => [
      {
        id: 'groups',
        height: 32,
        cells: [
          { id: 'g-info', content: 'Product Info', colSpan: 3 },
          { id: 'g-q1', content: 'Q1', colSpan: 2 },
          { id: 'g-q2', content: 'Q2', colSpan: 2 },
          { id: 'g-q3', content: 'Q3', colSpan: 2 },
          { id: 'g-q4', content: 'Q4', colSpan: 2 },
          { id: 'g-ytd', content: 'YTD Total', rowSpan: 2 },
          { id: 'g-growth', content: 'Growth', rowSpan: 2 },
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
          { id: 'h-q1rev', content: 'Revenue', columnId: 'q1Rev' },
          { id: 'h-q1units', content: 'Units', columnId: 'q1Units' },
          { id: 'h-q2rev', content: 'Revenue', columnId: 'q2Rev' },
          { id: 'h-q2units', content: 'Units', columnId: 'q2Units' },
          { id: 'h-q3rev', content: 'Revenue', columnId: 'q3Rev' },
          { id: 'h-q3units', content: 'Units', columnId: 'q3Units' },
          { id: 'h-q4rev', content: 'Revenue', columnId: 'q4Rev' },
          { id: 'h-q4units', content: 'Units', columnId: 'q4Units' },
          // YTD, Growth, Margin skipped — occupied by rowSpan from row above
        ],
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<SalesRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40 },
      { id: 'product', header: 'Product', width: 110 },
      { id: 'region', header: 'Region', width: 120 },
      { id: 'q1Rev', header: 'Revenue', width: 110, cellType: 'currency' },
      { id: 'q1Units', header: 'Units', width: 75, align: 'right' },
      { id: 'q2Rev', header: 'Revenue', width: 110, cellType: 'currency' },
      { id: 'q2Units', header: 'Units', width: 75, align: 'right' },
      { id: 'q3Rev', header: 'Revenue', width: 110, cellType: 'currency' },
      { id: 'q3Units', header: 'Units', width: 75, align: 'right' },
      { id: 'q4Rev', header: 'Revenue', width: 110, cellType: 'currency' },
      { id: 'q4Units', header: 'Units', width: 75, align: 'right' },
      {
        id: 'ytdTotal',
        header: 'YTD Total',
        width: 120,
        cellType: 'currency',
        cellRenderer: (el, ctx) => {
          const val = ctx.value as number;
          el.textContent = `$${val.toLocaleString()}`;
          el.style.fontWeight = '600';
          el.style.color = val >= 800000 ? '#2e7d32' : '#333';
        },
      },
      {
        id: 'growth',
        header: 'Growth',
        width: 80,
        cellType: 'percent',
        cellRenderer: (el, ctx) => {
          const val = ctx.value as number;
          el.textContent = `+${(val * 100).toFixed(0)}%`;
          el.style.fontWeight = '500';
          el.style.color = val >= 0.2 ? '#2e7d32' : val >= 0.1 ? '#f57f17' : '#c62828';
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
        "YTD Total", "Growth", and "Margin" span both header rows — no sub-columns needed.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Layout:</strong> Product Info (3 cols) &bull; Q1–Q4 (2 cols each) &bull; YTD Total (rowSpan: 2) &bull; Growth (rowSpan: 2) &bull; Margin (rowSpan: 2)
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
    { id: 'g-q3', content: 'Q3', colSpan: 2 },
    { id: 'g-q4', content: 'Q4', colSpan: 2 },
    { id: 'g-ytd', content: 'YTD Total', rowSpan: 2 },
    { id: 'g-growth', content: 'Growth', rowSpan: 2 },
    { id: 'g-margin', content: 'Margin', rowSpan: 2 },
  ]},
  { id: 'columns', height: 32, cells: [
    { id: 'h-id', content: '#', columnId: 'id' },
    { id: 'h-product', content: 'Product', columnId: 'product' },
    { id: 'h-region', content: 'Region', columnId: 'region' },
    // YTD, Growth & Margin skipped — occupied by rowSpan
    { id: 'h-q1rev', content: 'Revenue', columnId: 'q1Rev' },
    { id: 'h-q1units', content: 'Units', columnId: 'q1Units' },
    // ... Q2, Q3, Q4 Revenue & Units
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
