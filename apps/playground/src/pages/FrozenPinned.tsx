import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
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

const headerRows: HeaderRow[] = [
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
];

const salesColumns = [
  col.text('id', { headerName: '#', width: 40, sortable: true, hideZero: true }),
  col.text('region', { headerName: 'Region', width: 130, sortable: true }),
  col.text('product', { headerName: 'Product', width: 130, sortable: true }),
  ...monthKeys.map((m) =>
    col.currency(m, {
      headerName: m.charAt(0).toUpperCase() + m.slice(1),
      width: 100,
      precision: 0,
      sortable: true,
    }),
  ),
  col.currency('total', {
    headerName: 'Total',
    width: 120,
    precision: 0,
    sortable: true,
    cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
      const val = ctx.value as number;
      el.textContent = `$${val.toLocaleString()}`;
      el.style.fontWeight = '600';
    },
  }),
] as ColumnDef<SalesRow>[];

// ---------------------------------------------------------------------------
// Freeze Clip — Budget line items (inspired by development management tables)
// ---------------------------------------------------------------------------

interface BudgetRow {
  code: string;
  description: string;
  category: string;
  type: string;
  rate: number;
  startDate: string;
  endDate: string;
  [month: string]: string | number;
}

const budgetMonths = ['jan26', 'feb26', 'mar26', 'apr26', 'may26', 'jun26', 'jul26', 'aug26', 'sep26', 'oct26', 'nov26', 'dec26',
  'jan27', 'feb27', 'mar27', 'apr27', 'may27', 'jun27', 'jul27', 'aug27', 'sep27', 'oct27', 'nov27', 'dec27'] as const;
const budgetMonthLabels = ['Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26', 'Dec 26',
  'Jan 27', 'Feb 27', 'Mar 27', 'Apr 27', 'May 27', 'Jun 27', 'Jul 27', 'Aug 27', 'Sep 27', 'Oct 27', 'Nov 27', 'Dec 27'];

const budgetItems = [
  { code: 'SAL-001', desc: 'Base Salary - Engineering', cat: 'Manpower', type: 'Fixed', rate: 0.03 },
  { code: 'SAL-002', desc: 'Base Salary - Operations', cat: 'Manpower', type: 'Fixed', rate: 0.03 },
  { code: 'SAL-003', desc: 'Contract Staff - Dev', cat: 'Manpower', type: 'Variable', rate: 0.05 },
  { code: 'UTL-001', desc: 'Electricity & Water', cat: 'Utilities', type: 'Variable', rate: 0.02 },
  { code: 'UTL-002', desc: 'Internet & Telecom', cat: 'Utilities', type: 'Fixed', rate: 0.01 },
  { code: 'RNT-001', desc: 'Office Lease - HQ', cat: 'Rental', type: 'Fixed', rate: 0.04 },
  { code: 'RNT-002', desc: 'Co-working Space', cat: 'Rental', type: 'Variable', rate: 0.02 },
  { code: 'MKT-001', desc: 'Digital Advertising', cat: 'Marketing', type: 'Variable', rate: 0.08 },
  { code: 'MKT-002', desc: 'Events & Sponsorship', cat: 'Marketing', type: 'Variable', rate: 0.06 },
  { code: 'SFW-001', desc: 'Cloud Infrastructure', cat: 'Software', type: 'Variable', rate: 0.04 },
  { code: 'SFW-002', desc: 'SaaS Licenses', cat: 'Software', type: 'Fixed', rate: 0.02 },
  { code: 'TRV-001', desc: 'Business Travel', cat: 'Travel', type: 'Variable', rate: 0.03 },
  { code: 'PRF-001', desc: 'Legal & Audit Fees', cat: 'Professional', type: 'Fixed', rate: 0.01 },
  { code: 'PRF-002', desc: 'Consulting Services', cat: 'Professional', type: 'Variable', rate: 0.05 },
  { code: 'DEP-001', desc: 'Equipment Depreciation', cat: 'Depreciation', type: 'Fixed', rate: 0.00 },
];

const rng2 = seededRandom(42);
const budgetData: BudgetRow[] = budgetItems.map((item) => {
  const base = Math.round(rng2() * 40000 + 5000);
  const row: BudgetRow = {
    code: item.code,
    description: item.desc,
    category: item.cat,
    type: item.type,
    rate: item.rate,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
  };
  budgetMonths.forEach((m, i) => {
    row[m] = Math.round(base * (1 + item.rate * i) + (rng2() - 0.5) * base * 0.1);
  });
  return row;
});

const budgetTotals: BudgetRow = {
  code: '',
  description: 'TOTAL',
  category: '',
  type: '',
  rate: 0,
  startDate: '',
  endDate: '',
  ...Object.fromEntries(
    budgetMonths.map((m) => [m, budgetData.reduce((sum, r) => sum + (r[m] as number), 0)]),
  ),
};

const budgetColumns = [
  col.text('code', { headerName: 'Code', width: 80 }),
  col.text('description', { headerName: 'Description', width: 200 }),
  col.text('category', { headerName: 'Category', width: 100 }),
  col.text('type', { headerName: 'Type', width: 80 }),
  col.percent('rate', { headerName: 'Esc. Rate', width: 80 }),
  col.date('startDate', { headerName: 'Start', width: 100 }),
  col.date('endDate', { headerName: 'End', width: 100 }),
  ...budgetMonths.map((m, i) =>
    col.currency(m, {
      headerName: budgetMonthLabels[i]!,
      width: 90,
      precision: 0,
    }),
  ),
] as ColumnDef<BudgetRow>[];

export function FrozenPinned() {
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
        <strong> Mode:</strong> view (sort/filter/resize/select) + format feature
      </div>

      <BetterGrid<SalesRow>
        columns={salesColumns}
        data={sampleData}
        mode="view"
        features={{ format: { locale: 'en-US', currencyCode: 'USD' } }}
        headers={headerRows}
        frozen={{ left: 3 }}
        pinned={{ bottom: [totalsRow] }}
        selection={{ mode: 'range' }}
        height={400}
      />

      <h2 style={{ fontSize: 18, marginBottom: 8, marginTop: 32 }}>Freeze Clip</h2>
      <p style={{ marginBottom: 8, color: '#888', fontSize: 13, lineHeight: 1.5 }}>
        Development budgets often freeze many info columns (code, description, category, rates)
        that eat horizontal space. Drag the clip handle to collapse frozen columns and see more
        monthly data. Double-click to restore.
      </p>

      <BetterGrid<BudgetRow>
        columns={budgetColumns}
        data={budgetData}
        mode="view"
        features={{ format: { locale: 'en-US', currencyCode: 'USD' } }}
        frozen={{ left: 7, clip: { minVisible: 2 } }}
        pinned={{ bottom: [budgetTotals] }}
        selection={{ mode: 'range' }}
        height={380}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
        7 frozen columns (Code, Description, Category, Type, Rate, Start, End) totalling ~750px &bull;
        Drag handle to clip &bull; Double-click to expand &bull; minVisible: 2
      </div>
    </div>
  );
}

