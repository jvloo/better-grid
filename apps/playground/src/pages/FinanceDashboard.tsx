import { useCallback } from 'react';
import { BetterGrid, useGrid, defineColumn as col } from '@better-grid/react';
import type { BadgeOption, ColumnDef, HeaderRow } from '@better-grid/core';
import type { ExportApi } from '@better-grid/plugins';
import '@better-grid/core/styles.css';
import { IconButton, ExpandAllIcon, CollapseAllIcon, ExportIcon } from './_toolbar-icons';

interface BudgetRow {
  id: number;
  parentId: number | null;
  department: string;
  category: string;
  q1Actual: number;
  q1Budget: number;
  q2Actual: number;
  q2Budget: number;
  q3Actual: number;
  q3Budget: number;
  q4Actual: number;
  q4Budget: number;
  ytdActual: number;
  ytdBudget: number;
  variance: number;
  status: string;
}

const data: BudgetRow[] = [
  // Engineering (parent)
  { id: 1, parentId: null, department: 'Engineering', category: '', q1Actual: 2850000, q1Budget: 2700000, q2Actual: 2920000, q2Budget: 2800000, q3Actual: 3010000, q3Budget: 2900000, q4Actual: 3100000, q4Budget: 3000000, ytdActual: 11880000, ytdBudget: 11400000, variance: 480000, status: 'Over Budget' },
  { id: 2, parentId: 1, department: 'Frontend', category: 'Development', q1Actual: 680000, q1Budget: 650000, q2Actual: 710000, q2Budget: 680000, q3Actual: 720000, q3Budget: 700000, q4Actual: 750000, q4Budget: 720000, ytdActual: 2860000, ytdBudget: 2750000, variance: 110000, status: 'Over Budget' },
  { id: 3, parentId: 1, department: 'Backend', category: 'Development', q1Actual: 920000, q1Budget: 900000, q2Actual: 940000, q2Budget: 920000, q3Actual: 960000, q3Budget: 940000, q4Actual: 980000, q4Budget: 960000, ytdActual: 3800000, ytdBudget: 3720000, variance: 80000, status: 'On Track' },
  { id: 4, parentId: 1, department: 'DevOps', category: 'Infrastructure', q1Actual: 520000, q1Budget: 500000, q2Actual: 540000, q2Budget: 520000, q3Actual: 580000, q3Budget: 540000, q4Actual: 600000, q4Budget: 560000, ytdActual: 2240000, ytdBudget: 2120000, variance: 120000, status: 'Over Budget' },
  { id: 5, parentId: 1, department: 'QA', category: 'Quality', q1Actual: 730000, q1Budget: 650000, q2Actual: 730000, q2Budget: 680000, q3Actual: 750000, q3Budget: 720000, q4Actual: 770000, q4Budget: 760000, ytdActual: 2980000, ytdBudget: 2810000, variance: 170000, status: 'Over Budget' },

  // Marketing (parent)
  { id: 6, parentId: null, department: 'Marketing', category: '', q1Actual: 1420000, q1Budget: 1500000, q2Actual: 1380000, q2Budget: 1450000, q3Actual: 1510000, q3Budget: 1520000, q4Actual: 1600000, q4Budget: 1650000, ytdActual: 5910000, ytdBudget: 6120000, variance: -210000, status: 'Under Budget' },
  { id: 7, parentId: 6, department: 'Content', category: 'Creative', q1Actual: 380000, q1Budget: 400000, q2Actual: 360000, q2Budget: 390000, q3Actual: 410000, q3Budget: 420000, q4Actual: 430000, q4Budget: 450000, ytdActual: 1580000, ytdBudget: 1660000, variance: -80000, status: 'Under Budget' },
  { id: 8, parentId: 6, department: 'Paid Ads', category: 'Acquisition', q1Actual: 620000, q1Budget: 650000, q2Actual: 580000, q2Budget: 610000, q3Actual: 640000, q3Budget: 630000, q4Actual: 680000, q4Budget: 700000, ytdActual: 2520000, ytdBudget: 2590000, variance: -70000, status: 'Under Budget' },
  { id: 9, parentId: 6, department: 'SEO', category: 'Organic', q1Actual: 420000, q1Budget: 450000, q2Actual: 440000, q2Budget: 450000, q3Actual: 460000, q3Budget: 470000, q4Actual: 490000, q4Budget: 500000, ytdActual: 1810000, ytdBudget: 1870000, variance: -60000, status: 'Under Budget' },

  // Sales (parent)
  { id: 10, parentId: null, department: 'Sales', category: '', q1Actual: 2100000, q1Budget: 2000000, q2Actual: 2250000, q2Budget: 2100000, q3Actual: 2350000, q3Budget: 2200000, q4Actual: 2500000, q4Budget: 2300000, ytdActual: 9200000, ytdBudget: 8600000, variance: 600000, status: 'Over Budget' },
  { id: 11, parentId: 10, department: 'Enterprise', category: 'Direct Sales', q1Actual: 1050000, q1Budget: 980000, q2Actual: 1120000, q2Budget: 1040000, q3Actual: 1180000, q3Budget: 1100000, q4Actual: 1260000, q4Budget: 1150000, ytdActual: 4610000, ytdBudget: 4270000, variance: 340000, status: 'Over Budget' },
  { id: 12, parentId: 10, department: 'SMB', category: 'Inside Sales', q1Actual: 680000, q1Budget: 650000, q2Actual: 720000, q2Budget: 680000, q3Actual: 740000, q3Budget: 700000, q4Actual: 780000, q4Budget: 730000, ytdActual: 2920000, ytdBudget: 2760000, variance: 160000, status: 'Over Budget' },
  { id: 13, parentId: 10, department: 'Partnerships', category: 'Channel', q1Actual: 370000, q1Budget: 370000, q2Actual: 410000, q2Budget: 380000, q3Actual: 430000, q3Budget: 400000, q4Actual: 460000, q4Budget: 420000, ytdActual: 1670000, ytdBudget: 1570000, variance: 100000, status: 'Over Budget' },

  // Operations (parent)
  { id: 14, parentId: null, department: 'Operations', category: '', q1Actual: 1850000, q1Budget: 1900000, q2Actual: 1820000, q2Budget: 1880000, q3Actual: 1870000, q3Budget: 1900000, q4Actual: 1910000, q4Budget: 1950000, ytdActual: 7450000, ytdBudget: 7630000, variance: -180000, status: 'Under Budget' },
  { id: 15, parentId: 14, department: 'HR', category: 'People', q1Actual: 520000, q1Budget: 540000, q2Actual: 510000, q2Budget: 530000, q3Actual: 530000, q3Budget: 540000, q4Actual: 540000, q4Budget: 550000, ytdActual: 2100000, ytdBudget: 2160000, variance: -60000, status: 'Under Budget' },
  { id: 16, parentId: 14, department: 'Finance', category: 'Accounting', q1Actual: 480000, q1Budget: 490000, q2Actual: 470000, q2Budget: 480000, q3Actual: 490000, q3Budget: 500000, q4Actual: 500000, q4Budget: 510000, ytdActual: 1940000, ytdBudget: 1980000, variance: -40000, status: 'On Track' },
  { id: 17, parentId: 14, department: 'Legal', category: 'Compliance', q1Actual: 420000, q1Budget: 430000, q2Actual: 410000, q2Budget: 430000, q3Actual: 420000, q3Budget: 420000, q4Actual: 440000, q4Budget: 450000, ytdActual: 1690000, ytdBudget: 1730000, variance: -40000, status: 'On Track' },
  { id: 18, parentId: 14, department: 'IT', category: 'Technology', q1Actual: 430000, q1Budget: 440000, q2Actual: 430000, q2Budget: 440000, q3Actual: 430000, q3Budget: 440000, q4Actual: 430000, q4Budget: 440000, ytdActual: 1720000, ytdBudget: 1760000, variance: -40000, status: 'Under Budget' },
];

// Quarter periods drive both column defs and multi-header rows.
const periods = [
  { key: 'q1', label: 'Q1', width: 100 }, { key: 'q2', label: 'Q2', width: 100 },
  { key: 'q3', label: 'Q3', width: 100 }, { key: 'q4', label: 'Q4', width: 100 },
  { key: 'ytd', label: 'YTD', width: 110 },
];

// Each quarter expands to (Actual, Budget) currency columns, precision 0.
const columns = [
  col.text('department', { headerName: 'Department', width: 200 }),
  col.text('category', { headerName: 'Category', width: 120 }),
  col.badge('status', {
    headerName: 'Status',
    width: 120,
    options: [
      { label: 'On Track', value: 'On Track', color: '#2e7d32', bg: '#e8f5e9' },
      { label: 'Over Budget', value: 'Over Budget', color: '#c62828', bg: '#ffebee' },
      { label: 'Under Budget', value: 'Under Budget', color: '#1565c0', bg: '#e3f2fd' },
    ] as BadgeOption[],
  }),
  ...periods.flatMap((p) => [
    col.currency(`${p.key}Actual`, { headerName: 'Actual', width: p.width, precision: 0 }),
    col.currency(`${p.key}Budget`, { headerName: 'Budget', width: p.width, precision: 0 }),
  ]),
  col.change('variance', { headerName: 'Variance', width: 120 }),
] as ColumnDef<BudgetRow>[];

// Multi-header generated from the same `periods` array used for columns.
// Status & Variance use rowSpan so they have no row-2 cell.
const multiHeaders: HeaderRow[] = [
  {
    id: 'groups', height: 32,
    cells: [
      { id: 'g-dept', content: 'Department', colSpan: 2 },
      { id: 'g-status', content: 'Status', rowSpan: 2 },
      ...periods.map((p) => ({ id: `g-${p.key}`, content: p.label, colSpan: 2 })),
      { id: 'g-var', content: 'Var', rowSpan: 2 },
    ],
  },
  {
    id: 'columns', height: 32,
    cells: [
      { id: 'h-dept', content: 'Department', columnId: 'department' },
      { id: 'h-cat', content: 'Category', columnId: 'category' },
      ...periods.flatMap((p) => [
        { id: `h-${p.key}a`, content: 'Actual', columnId: `${p.key}Actual` },
        { id: `h-${p.key}b`, content: 'Budget', columnId: `${p.key}Budget` },
      ]),
    ],
  },
];

// Totals row computed once at module scope — depends only on static data.
const rootRows = data.filter((r) => r.parentId === null);
const numericKeys = ['q1Actual', 'q1Budget', 'q2Actual', 'q2Budget', 'q3Actual', 'q3Budget', 'q4Actual', 'q4Budget', 'ytdActual', 'ytdBudget', 'variance'] as const;
const totalsRow: BudgetRow = {
  id: -1, parentId: null, department: 'Total', category: '', status: '',
  ...Object.fromEntries(numericKeys.map((k) => [k, rootRows.reduce((s, r) => s + r[k], 0)])),
} as BudgetRow;

export function FinanceDashboard() {
  // useGrid form: needed because the toolbar buttons call grid.api.expandAll/collapseAll
  // and the export plugin imperatively. <BetterGrid grid={grid}> renders the same handle.
  const grid = useGrid<BudgetRow>({
    data,
    columns,
    mode: 'spreadsheet',
    features: {
      format: { locale: 'en-US', currencyCode: 'USD', accountingFormat: true },
      edit: { editTrigger: 'dblclick', precision: 0 },
      validation: true,
      export: { filename: 'budget-report' },
    },
    headers: multiHeaders,
    pinned: { bottom: [totalsRow] },
    frozen: { left: 2 },
    hierarchy: {
      getRowId: (row) => row.id,
      getParentId: (row) => row.parentId,
      defaultExpanded: true,
    },
    selection: { mode: 'range', fillHandle: true },
    rowHeight: 36,
  });

  const handleExpandAll = useCallback(() => grid.api.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.api.collapseAll(), [grid]);
  const handleExport = useCallback(() => (grid.api.plugins as { export?: ExportApi }).export?.exportToCsv(), [grid]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Finance Dashboard</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton title="Expand All" onClick={handleExpandAll}><ExpandAllIcon /></IconButton>
          <IconButton title="Collapse All" onClick={handleCollapseAll}><CollapseAllIcon /></IconButton>
          <IconButton title="Export" onClick={handleExport}><ExportIcon /></IconButton>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Real-time budget tracking across departments. Hierarchical rows, frozen columns, quarterly breakdowns, and YTD variance analysis.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Mode:</strong> spreadsheet (sort/filter/resize/select/reorder/edit/clipboard/undo) &bull;
        <strong> Features:</strong> format, validation, export, hierarchy &bull;
        <strong> Layout:</strong> frozen left, multi-headers, pinned totals row, fillHandle
      </div>
      <BetterGrid grid={grid} height={560} style={{ border: '1px solid #e0e0e0', borderRadius: 8 }} />
    </div>
  );
}

