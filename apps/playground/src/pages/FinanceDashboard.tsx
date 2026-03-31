import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { formatting, editing, sorting, filtering, hierarchy, cellRenderers, validation, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

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

export function FinanceDashboard() {
  const columns = useMemo<ColumnDef<BudgetRow>[]>(
    () => [
      { id: 'department', accessorKey: 'department', header: 'Department', width: 200 },
      { id: 'category', accessorKey: 'category', header: 'Category', width: 120 },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        width: 120,
        cellType: 'badge',
        options: [
          { label: 'On Track', value: 'On Track', color: '#2e7d32', bg: '#e8f5e9' },
          { label: 'Over Budget', value: 'Over Budget', color: '#c62828', bg: '#ffebee' },
          { label: 'Under Budget', value: 'Under Budget', color: '#1565c0', bg: '#e3f2fd' },
        ],
      },
      { id: 'q1Actual', accessorKey: 'q1Actual', header: 'Actual', width: 100, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'q1Budget', accessorKey: 'q1Budget', header: 'Budget', width: 100, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'q2Actual', accessorKey: 'q2Actual', header: 'Actual', width: 100, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'q2Budget', accessorKey: 'q2Budget', header: 'Budget', width: 100, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'q3Actual', accessorKey: 'q3Actual', header: 'Actual', width: 100, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'q3Budget', accessorKey: 'q3Budget', header: 'Budget', width: 100, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'q4Actual', accessorKey: 'q4Actual', header: 'Actual', width: 100, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'q4Budget', accessorKey: 'q4Budget', header: 'Budget', width: 100, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'ytdActual', accessorKey: 'ytdActual', header: 'Actual', width: 110, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'ytdBudget', accessorKey: 'ytdBudget', header: 'Budget', width: 110, cellType: 'currency', precision: 0, align: 'right' },
      { id: 'variance', accessorKey: 'variance', header: 'Variance', width: 120, cellType: 'change' },
    ],
    [],
  );

  const multiHeaders = useMemo<HeaderRow[]>(
    () => [
      {
        id: 'groups',
        height: 32,
        cells: [
          { id: 'g-dept', content: 'Department', colSpan: 2 },
          { id: 'g-status', content: 'Status', rowSpan: 2 },
          { id: 'g-q1', content: 'Q1', colSpan: 2 },
          { id: 'g-q2', content: 'Q2', colSpan: 2 },
          { id: 'g-q3', content: 'Q3', colSpan: 2 },
          { id: 'g-q4', content: 'Q4', colSpan: 2 },
          { id: 'g-ytd', content: 'YTD', colSpan: 2 },
          { id: 'g-var', content: 'Var', rowSpan: 2 },
        ],
      },
      {
        id: 'columns',
        height: 32,
        cells: [
          { id: 'h-dept', content: 'Department', columnId: 'department' },
          { id: 'h-cat', content: 'Category', columnId: 'category' },
          // Status skipped — occupied by rowSpan from group row
          { id: 'h-q1a', content: 'Actual', columnId: 'q1Actual' },
          { id: 'h-q1b', content: 'Budget', columnId: 'q1Budget' },
          { id: 'h-q2a', content: 'Actual', columnId: 'q2Actual' },
          { id: 'h-q2b', content: 'Budget', columnId: 'q2Budget' },
          { id: 'h-q3a', content: 'Actual', columnId: 'q3Actual' },
          { id: 'h-q3b', content: 'Budget', columnId: 'q3Budget' },
          { id: 'h-q4a', content: 'Actual', columnId: 'q4Actual' },
          { id: 'h-q4b', content: 'Budget', columnId: 'q4Budget' },
          { id: 'h-ytda', content: 'Actual', columnId: 'ytdActual' },
          { id: 'h-ytdb', content: 'Budget', columnId: 'ytdBudget' },
          // Variance skipped — occupied by rowSpan from group row
        ],
      },
    ],
    [],
  );

  const totalsRow = useMemo<BudgetRow>(() => {
    const roots = data.filter((r) => r.parentId === null);
    return {
      id: -1,
      parentId: null,
      department: 'Total',
      category: '',
      q1Actual: roots.reduce((sum, r) => sum + r.q1Actual, 0),
      q1Budget: roots.reduce((sum, r) => sum + r.q1Budget, 0),
      q2Actual: roots.reduce((sum, r) => sum + r.q2Actual, 0),
      q2Budget: roots.reduce((sum, r) => sum + r.q2Budget, 0),
      q3Actual: roots.reduce((sum, r) => sum + r.q3Actual, 0),
      q3Budget: roots.reduce((sum, r) => sum + r.q3Budget, 0),
      q4Actual: roots.reduce((sum, r) => sum + r.q4Actual, 0),
      q4Budget: roots.reduce((sum, r) => sum + r.q4Budget, 0),
      ytdActual: roots.reduce((sum, r) => sum + r.ytdActual, 0),
      ytdBudget: roots.reduce((sum, r) => sum + r.ytdBudget, 0),
      variance: roots.reduce((sum, r) => sum + r.variance, 0),
      status: '',
    };
  }, []);

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick', precision: 0 }),
      sorting(),
      filtering(),
      hierarchy({ expandColumn: 'department', indentSize: 22 }),
      cellRenderers(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'budget-report' }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<BudgetRow>({
    data,
    columns,
    headerRows: multiHeaders,
    plugins,
    pinnedBottomRows: [totalsRow],
    frozenLeftColumns: 2,
    hierarchy: {
      getRowId: (row: BudgetRow) => row.id,
      getParentId: (row: BudgetRow) => row.parentId,
      defaultExpanded: true,
    },
    selection: { mode: 'range', fillHandle: true },
    rowHeight: 36,
  });

  const handleExpandAll = useCallback(() => grid.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.collapseAll(), [grid]);
  const handleExport = useCallback(() => {
    const api = grid.getPlugin<{ exportToCsv: () => void }>('export');
    api?.exportToCsv();
  }, [grid]);
  const handleUndo = useCallback(() => {
    const api = grid.getPlugin<{ undo: () => void }>('undoRedo');
    api?.undo();
  }, [grid]);
  const handleRedo = useCallback(() => {
    const api = grid.getPlugin<{ redo: () => void }>('undoRedo');
    api?.redo();
  }, [grid]);

  const btnStyle = {
    padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6,
    background: '#fff', cursor: 'pointer', fontSize: 12,
  } as const;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Finance Dashboard</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleExpandAll} style={btnStyle}>Expand All</button>
          <button onClick={handleCollapseAll} style={btnStyle}>Collapse All</button>
          <button onClick={handleUndo} style={btnStyle}>Undo</button>
          <button onClick={handleRedo} style={btnStyle}>Redo</button>
          <button onClick={handleExport} style={btnStyle}>Export CSV</button>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Real-time budget tracking across departments. Hierarchical rows, frozen columns, quarterly breakdowns, and YTD variance analysis.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, sorting, filtering, hierarchy, cellRenderers, validation, clipboard, undoRedo, export &bull;
        <strong> Core:</strong> frozenLeftColumns, headerRows, pinnedBottomRows, fillHandle, hierarchy
      </div>
      <div
        ref={containerRef}
        style={{
          height: 560,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
        }}
      />
    </div>
  );
}
