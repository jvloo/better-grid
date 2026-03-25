import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { formatting, editing, sorting } from '@better-grid/plugins';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface BudgetRow {
  id: number;
  department: string;
  lineItem: string;
  total: number;
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
  variance: number;
  status: string;
}

// Realistic annual budget data — 30 rows across departments
const data: BudgetRow[] = [
  // Engineering
  { id: 1, department: 'Engineering', lineItem: 'Salaries', total: 2400000, jan: 200000, feb: 200000, mar: 200000, apr: 200000, may: 200000, jun: 200000, jul: 200000, aug: 200000, sep: 200000, oct: 200000, nov: 200000, dec: 200000, variance: 0.0, status: 'Active' },
  { id: 2, department: 'Engineering', lineItem: 'Cloud Infra', total: 480000, jan: 35000, feb: 37000, mar: 38000, apr: 39000, may: 40000, jun: 42000, jul: 41000, aug: 43000, sep: 44000, oct: 42000, nov: 40000, dec: 39000, variance: 0.08, status: 'Active' },
  { id: 3, department: 'Engineering', lineItem: 'Tooling & Licenses', total: 156000, jan: 13000, feb: 13000, mar: 13000, apr: 13000, may: 13000, jun: 13000, jul: 13000, aug: 13000, sep: 13000, oct: 13000, nov: 13000, dec: 13000, variance: 0.0, status: 'Active' },
  { id: 4, department: 'Engineering', lineItem: 'Contractors', total: 360000, jan: 30000, feb: 30000, mar: 30000, apr: 30000, may: 30000, jun: 30000, jul: 30000, aug: 30000, sep: 30000, oct: 30000, nov: 30000, dec: 30000, variance: -0.05, status: 'Active' },
  { id: 5, department: 'Engineering', lineItem: 'Hardware', total: 120000, jan: 45000, feb: 0, mar: 0, apr: 0, may: 0, jun: 35000, jul: 0, aug: 0, sep: 0, oct: 0, nov: 40000, dec: 0, variance: 0.12, status: 'Active' },

  // Sales
  { id: 6, department: 'Sales', lineItem: 'Salaries', total: 1800000, jan: 150000, feb: 150000, mar: 150000, apr: 150000, may: 150000, jun: 150000, jul: 150000, aug: 150000, sep: 150000, oct: 150000, nov: 150000, dec: 150000, variance: 0.0, status: 'Active' },
  { id: 7, department: 'Sales', lineItem: 'Commissions', total: 720000, jan: 48000, feb: 52000, mar: 65000, apr: 58000, may: 62000, jun: 72000, jul: 55000, aug: 60000, sep: 68000, oct: 58000, nov: 62000, dec: 60000, variance: 0.15, status: 'Active' },
  { id: 8, department: 'Sales', lineItem: 'Travel', total: 240000, jan: 18000, feb: 20000, mar: 22000, apr: 19000, may: 21000, jun: 15000, jul: 12000, aug: 18000, sep: 25000, oct: 28000, nov: 22000, dec: 20000, variance: -0.03, status: 'Active' },
  { id: 9, department: 'Sales', lineItem: 'CRM & Tools', total: 96000, jan: 8000, feb: 8000, mar: 8000, apr: 8000, may: 8000, jun: 8000, jul: 8000, aug: 8000, sep: 8000, oct: 8000, nov: 8000, dec: 8000, variance: 0.0, status: 'Active' },
  { id: 10, department: 'Sales', lineItem: 'Client Entertainment', total: 60000, jan: 4000, feb: 5000, mar: 6000, apr: 5000, may: 5000, jun: 4000, jul: 3000, aug: 5000, sep: 7000, oct: 6000, nov: 5000, dec: 5000, variance: 0.10, status: 'Active' },

  // Marketing
  { id: 11, department: 'Marketing', lineItem: 'Salaries', total: 960000, jan: 80000, feb: 80000, mar: 80000, apr: 80000, may: 80000, jun: 80000, jul: 80000, aug: 80000, sep: 80000, oct: 80000, nov: 80000, dec: 80000, variance: 0.0, status: 'Active' },
  { id: 12, department: 'Marketing', lineItem: 'Digital Ads', total: 600000, jan: 40000, feb: 45000, mar: 50000, apr: 48000, may: 55000, jun: 60000, jul: 52000, aug: 48000, sep: 55000, oct: 50000, nov: 45000, dec: 52000, variance: 0.18, status: 'Active' },
  { id: 13, department: 'Marketing', lineItem: 'Events & Conferences', total: 180000, jan: 0, feb: 0, mar: 45000, apr: 0, may: 0, jun: 50000, jul: 0, aug: 0, sep: 45000, oct: 0, nov: 0, dec: 40000, variance: -0.08, status: 'Active' },
  { id: 14, department: 'Marketing', lineItem: 'Content & SEO', total: 144000, jan: 12000, feb: 12000, mar: 12000, apr: 12000, may: 12000, jun: 12000, jul: 12000, aug: 12000, sep: 12000, oct: 12000, nov: 12000, dec: 12000, variance: 0.0, status: 'Active' },
  { id: 15, department: 'Marketing', lineItem: 'Brand & Design', total: 96000, jan: 8000, feb: 8000, mar: 8000, apr: 8000, may: 8000, jun: 8000, jul: 8000, aug: 8000, sep: 8000, oct: 8000, nov: 8000, dec: 8000, variance: 0.05, status: 'Active' },

  // Product
  { id: 16, department: 'Product', lineItem: 'Salaries', total: 720000, jan: 60000, feb: 60000, mar: 60000, apr: 60000, may: 60000, jun: 60000, jul: 60000, aug: 60000, sep: 60000, oct: 60000, nov: 60000, dec: 60000, variance: 0.0, status: 'Active' },
  { id: 17, department: 'Product', lineItem: 'User Research', total: 120000, jan: 10000, feb: 10000, mar: 10000, apr: 10000, may: 10000, jun: 10000, jul: 10000, aug: 10000, sep: 10000, oct: 10000, nov: 10000, dec: 10000, variance: -0.02, status: 'Active' },
  { id: 18, department: 'Product', lineItem: 'Analytics Tools', total: 48000, jan: 4000, feb: 4000, mar: 4000, apr: 4000, may: 4000, jun: 4000, jul: 4000, aug: 4000, sep: 4000, oct: 4000, nov: 4000, dec: 4000, variance: 0.0, status: 'Active' },

  // Operations
  { id: 19, department: 'Operations', lineItem: 'Salaries', total: 600000, jan: 50000, feb: 50000, mar: 50000, apr: 50000, may: 50000, jun: 50000, jul: 50000, aug: 50000, sep: 50000, oct: 50000, nov: 50000, dec: 50000, variance: 0.0, status: 'Active' },
  { id: 20, department: 'Operations', lineItem: 'Office Lease', total: 360000, jan: 30000, feb: 30000, mar: 30000, apr: 30000, may: 30000, jun: 30000, jul: 30000, aug: 30000, sep: 30000, oct: 30000, nov: 30000, dec: 30000, variance: 0.0, status: 'Active' },
  { id: 21, department: 'Operations', lineItem: 'Utilities', total: 48000, jan: 4200, feb: 4000, mar: 3800, apr: 3600, may: 3500, jun: 4200, jul: 4500, aug: 4500, sep: 4000, oct: 3800, nov: 3900, dec: 4000, variance: 0.03, status: 'Active' },
  { id: 22, department: 'Operations', lineItem: 'Insurance', total: 84000, jan: 7000, feb: 7000, mar: 7000, apr: 7000, may: 7000, jun: 7000, jul: 7000, aug: 7000, sep: 7000, oct: 7000, nov: 7000, dec: 7000, variance: 0.0, status: 'Active' },

  // HR
  { id: 23, department: 'HR', lineItem: 'Salaries', total: 480000, jan: 40000, feb: 40000, mar: 40000, apr: 40000, may: 40000, jun: 40000, jul: 40000, aug: 40000, sep: 40000, oct: 40000, nov: 40000, dec: 40000, variance: 0.0, status: 'Active' },
  { id: 24, department: 'HR', lineItem: 'Recruiting', total: 240000, jan: 20000, feb: 22000, mar: 25000, apr: 18000, may: 20000, jun: 22000, jul: 15000, aug: 18000, sep: 25000, oct: 22000, nov: 18000, dec: 15000, variance: -0.10, status: 'Active' },
  { id: 25, department: 'HR', lineItem: 'Training & Dev', total: 96000, jan: 8000, feb: 8000, mar: 8000, apr: 8000, may: 8000, jun: 8000, jul: 8000, aug: 8000, sep: 8000, oct: 8000, nov: 8000, dec: 8000, variance: 0.0, status: 'Active' },
  { id: 26, department: 'HR', lineItem: 'Benefits Admin', total: 36000, jan: 3000, feb: 3000, mar: 3000, apr: 3000, may: 3000, jun: 3000, jul: 3000, aug: 3000, sep: 3000, oct: 3000, nov: 3000, dec: 3000, variance: 0.0, status: 'Active' },

  // Finance
  { id: 27, department: 'Finance', lineItem: 'Salaries', total: 540000, jan: 45000, feb: 45000, mar: 45000, apr: 45000, may: 45000, jun: 45000, jul: 45000, aug: 45000, sep: 45000, oct: 45000, nov: 45000, dec: 45000, variance: 0.0, status: 'Active' },
  { id: 28, department: 'Finance', lineItem: 'Audit & Compliance', total: 120000, jan: 10000, feb: 10000, mar: 15000, apr: 10000, may: 10000, jun: 10000, jul: 10000, aug: 10000, sep: 10000, oct: 10000, nov: 10000, dec: 5000, variance: -0.04, status: 'Active' },
  { id: 29, department: 'Finance', lineItem: 'Legal Fees', total: 180000, jan: 15000, feb: 15000, mar: 15000, apr: 15000, may: 15000, jun: 15000, jul: 15000, aug: 15000, sep: 15000, oct: 15000, nov: 15000, dec: 15000, variance: 0.06, status: 'Pending' },
  { id: 30, department: 'Finance', lineItem: 'Tax Advisory', total: 60000, jan: 0, feb: 0, mar: 20000, apr: 0, may: 0, jun: 20000, jul: 0, aug: 0, sep: 20000, oct: 0, nov: 0, dec: 0, variance: 0.0, status: 'Pending' },
];

export function ComplexGrid() {
  const multiHeaders = useMemo<HeaderRow[]>(
    () => [
      {
        id: 'groups',
        height: 32,
        cells: [
          { id: 'g-info', content: 'Details', colSpan: 3 },
          { id: 'g-total', content: 'Total', rowSpan: 2 },
          { id: 'g-q1', content: 'Q1', colSpan: 3 },
          { id: 'g-q2', content: 'Q2', colSpan: 3 },
          { id: 'g-q3', content: 'Q3', colSpan: 3 },
          { id: 'g-q4', content: 'Q4', colSpan: 3 },
          { id: 'g-kpi', content: 'KPI', colSpan: 2 },
        ],
      },
      {
        id: 'columns',
        height: 32,
        cells: [
          { id: 'h-id', content: '#', columnId: 'id' },
          { id: 'h-dept', content: 'Department', columnId: 'department' },
          { id: 'h-item', content: 'Line Item', columnId: 'lineItem' },
          // Annual Total skipped — occupied by rowSpan from group row
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
          { id: 'h-var', content: 'YoY', columnId: 'variance' },
          { id: 'h-status', content: 'Status', columnId: 'status' },
        ],
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<BudgetRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40, editable: false },
      { id: 'department', header: 'Department', width: 110, sortable: true },
      { id: 'lineItem', header: 'Line Item', width: 170, sortable: true },
      { id: 'total', header: 'Total', width: 120, cellType: 'currency', editable: false, sortable: true },
      ...(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const).map(
        (month) => ({
          id: month,
          header: month.charAt(0).toUpperCase() + month.slice(1),
          width: 90,
          cellType: 'currency' as const,
          hideZero: true,
          cellRenderer: (container: HTMLElement, ctx: { value: unknown }) => {
            const val = ctx.value as number;
            if (val === 0) {
              container.textContent = '';
              container.style.background = 'var(--bg-cell-empty-bg, #fafafa)';
              return;
            }
            container.textContent = val < 0
              ? `(${Math.abs(val).toLocaleString()})`
              : val.toLocaleString();
            container.style.textAlign = 'right';
            container.style.color = val < 0 ? '#c62828' : '';
          },
        }),
      ),
      {
        id: 'variance',
        header: 'YoY',
        width: 80,
        cellType: 'percent',
        sortable: true,
        cellRenderer: (container: HTMLElement, ctx: { value: unknown }) => {
          const val = ctx.value as number;
          const pct = (val * 100).toFixed(1);
          container.textContent = val >= 0 ? `+${pct}%` : `${pct}%`;
          container.style.textAlign = 'right';
          container.style.color = val >= 0 ? '#2e7d32' : '#c62828';
          container.style.fontWeight = '500';
        },
      },
      {
        id: 'status',
        header: 'Status',
        width: 100,
        options: ['Active', 'Pending', 'On Hold', 'Completed'],
        cellRenderer: (container: HTMLElement, ctx: { value: unknown }) => {
          const val = ctx.value as string;
          const colors: Record<string, { bg: string; fg: string }> = {
            Active: { bg: '#e8f5e9', fg: '#2e7d32' },
            Pending: { bg: '#fff3e0', fg: '#e65100' },
            'On Hold': { bg: '#ffebee', fg: '#c62828' },
            Completed: { bg: '#e3f2fd', fg: '#1565c0' },
          };
          const c = colors[val] ?? { bg: '#f5f5f5', fg: '#666' };
          container.innerHTML = `<span style="pointer-events:none;padding:2px 8px;border-radius:12px;font-size:11px;background:${c.bg};color:${c.fg}">${val}</span>`;
        },
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick' }),
      sorting(),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Annual Budget Planning</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        30-row departmental budget with monthly breakdown, quarterly grouping, YoY variance, and status tracking.
        Frozen department columns, conditional formatting, zero hiding, editable cells.
      </p>
      <BetterGrid<BudgetRow>
        columns={columns}
        data={data}
        headerRows={multiHeaders}
        frozenLeftColumns={3}
        frozenTopRows={0}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={520}
      />

      <CodeBlock title="Budget Planning Grid" code={`import { BetterGrid } from '@better-grid/react';
import { formatting, editing, sorting } from '@better-grid/plugins';

const columns = [
  { id: 'id', header: '#', width: 40, editable: false },
  { id: 'department', header: 'Department', width: 110, sortable: true },
  { id: 'lineItem', header: 'Line Item', width: 140, sortable: true },
  { id: 'total', header: 'Total', width: 120,
    cellType: 'currency', editable: false, sortable: true },
  // Monthly columns with conditional formatting
  ...months.map(month => ({
    id: month, header: month, width: 90,
    cellType: 'currency', hideZero: true,
    cellRenderer: (el, ctx) => {
      if (ctx.value === 0) { el.textContent = ''; return; }
      el.textContent = ctx.value < 0
        ? \`(\${Math.abs(ctx.value).toLocaleString()})\`
        : ctx.value.toLocaleString();
      el.style.color = ctx.value < 0 ? '#c62828' : '';
    },
  })),
  { id: 'variance', header: 'YoY', width: 80,
    cellType: 'percent', sortable: true,
    cellRenderer: (el, ctx) => {
      const pct = (ctx.value * 100).toFixed(1);
      el.textContent = ctx.value >= 0 ? \`+\${pct}%\` : \`\${pct}%\`;
      el.style.color = ctx.value >= 0 ? '#2e7d32' : '#c62828';
    },
  },
  { id: 'status', header: 'Status', width: 90,
    options: ['Active', 'Pending', 'On Hold', 'Completed'] },
];

const headerRows = [
  { id: 'groups', height: 32, cells: [
    { id: 'g-dept', content: 'Details', colSpan: 3 },
    { id: 'g-total', content: 'Total', rowSpan: 2 },
    { id: 'g-q1', content: 'Q1', colSpan: 3 },
    { id: 'g-q2', content: 'Q2', colSpan: 3 },
    { id: 'g-q3', content: 'Q3', colSpan: 3 },
    { id: 'g-q4', content: 'Q4', colSpan: 3 },
    { id: 'g-kpi', content: 'KPI', colSpan: 2 },
  ]},
];

<BetterGrid
  columns={columns}
  data={budgetData}
  headerRows={headerRows}
  frozenLeftColumns={3}
  selection={{ mode: 'range' }}
  plugins={[
    formatting({ currencyCode: 'USD', accountingFormat: true }),
    editing({ editTrigger: 'dblclick' }),
    sorting(),
  ]}
  height={520}
/>`} />
    </div>
  );
}
