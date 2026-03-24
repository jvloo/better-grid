import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { formatting, editing, sorting } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface FinancialRow {
  id: number;
  project: string;
  category: string;
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

const data: FinancialRow[] = [
  { id: 1, project: 'Alpha Tower', category: 'Revenue', total: 1250000, jan: 95000, feb: 102000, mar: 110000, apr: 98000, may: 105000, jun: 112000, jul: 108000, aug: 103000, sep: 115000, oct: 98000, nov: 104000, dec: 0, variance: 0.05, status: 'Active' },
  { id: 2, project: 'Alpha Tower', category: 'Cost', total: -890000, jan: -72000, feb: -74000, mar: -76000, apr: -71000, may: -73000, jun: -78000, jul: -75000, aug: -74000, sep: -77000, oct: -73000, nov: -75000, dec: 0, variance: -0.03, status: 'Active' },
  { id: 3, project: 'Beta Plaza', category: 'Revenue', total: 980000, jan: 78000, feb: 82000, mar: 85000, apr: 79000, may: 84000, jun: 88000, jul: 83000, aug: 81000, sep: 86000, oct: 82000, nov: 84000, dec: 0, variance: 0.08, status: 'Active' },
  { id: 4, project: 'Beta Plaza', category: 'Cost', total: -650000, jan: -52000, feb: -54000, mar: -56000, apr: -53000, may: -55000, jun: -57000, jul: -54000, aug: -53000, sep: -56000, oct: -54000, nov: -55000, dec: 0, variance: -0.02, status: 'Active' },
  { id: 5, project: 'Gamma Heights', category: 'Revenue', total: 2100000, jan: 170000, feb: 175000, mar: 180000, apr: 172000, may: 178000, jun: 185000, jul: 180000, aug: 176000, sep: 182000, oct: 0, nov: 0, dec: 0, variance: 0.12, status: 'Pending' },
  { id: 6, project: 'Gamma Heights', category: 'Cost', total: -1450000, jan: -120000, feb: -122000, mar: -125000, apr: -118000, may: -121000, jun: -128000, jul: -124000, aug: -120000, sep: -126000, oct: 0, nov: 0, dec: 0, variance: -0.04, status: 'Pending' },
  { id: 7, project: 'Delta Park', category: 'Revenue', total: 560000, jan: 45000, feb: 47000, mar: 48000, apr: 46000, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, variance: -0.15, status: 'On Hold' },
  { id: 8, project: 'Delta Park', category: 'Cost', total: -420000, jan: -35000, feb: -36000, mar: -37000, apr: -34000, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, variance: 0.01, status: 'On Hold' },
];

export function ComplexGrid() {
  // Multi-level header rows: Group → Quarter → Month
  const multiHeaders = useMemo<HeaderRow[]>(
    () => [
      // Row 1: Group headers
      {
        id: 'groups',
        height: 32,
        cells: [
          { id: 'g-info', content: 'Project Info', colSpan: 3 },
          { id: 'g-total', content: 'Summary', colSpan: 1 },
          { id: 'g-q1', content: 'Q1', colSpan: 3 },
          { id: 'g-q2', content: 'Q2', colSpan: 3 },
          { id: 'g-q3', content: 'Q3', colSpan: 3 },
          { id: 'g-q4', content: 'Q4', colSpan: 3 },
          { id: 'g-kpi', content: 'KPI', colSpan: 2 },
        ],
      },
      // Row 2: Column headers
      {
        id: 'columns',
        height: 32,
        cells: [
          { id: 'h-id', content: 'ID', columnId: 'id' },
          { id: 'h-project', content: 'Project', columnId: 'project' },
          { id: 'h-category', content: 'Category', columnId: 'category' },
          { id: 'h-total', content: 'Total', columnId: 'total' },
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
          { id: 'h-variance', content: 'Variance', columnId: 'variance' },
          { id: 'h-status', content: 'Status', columnId: 'status' },
        ],
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<FinancialRow>[]>(
    () => [
      { id: 'id', header: 'ID', width: 45, editable: false },
      { id: 'project', header: 'Project', width: 130 },
      { id: 'category', header: 'Category', width: 90, options: ['Revenue', 'Cost'] },
      { id: 'total', header: 'Total', width: 120, cellType: 'currency', editable: false, sortable: true },
      // Monthly columns
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
        header: 'Variance',
        width: 90,
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
        width: 90,
        options: ['Active', 'Pending', 'On Hold', 'Completed'],
        cellRenderer: (container: HTMLElement, ctx: { value: unknown }) => {
          const val = ctx.value as string;
          container.textContent = val;
          const colors: Record<string, string> = {
            Active: '#2e7d32',
            Pending: '#f57f17',
            'On Hold': '#c62828',
            Completed: '#1565c0',
          };
          container.style.color = colors[val] ?? '';
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
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Complex Grid — Multi-Header Financial</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        Multi-level headers (Group → Month), frozen ID/Project/Category columns,
        conditional formatting (red negatives, green positives), zero hiding, custom renderers.
      </p>
      <BetterGrid<FinancialRow>
        columns={columns}
        data={data}
        headerRows={multiHeaders}
        frozenLeftColumns={3}
        frozenTopRows={0}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={450}
      />
    </div>
  );
}
