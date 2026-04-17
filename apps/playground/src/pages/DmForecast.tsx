import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, editing, sorting, hierarchy, cellRenderers, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface ForecastRow {
  id: number;
  parentId: number | null;
  type: 'parent' | 'child1' | 'child2';
  accountCode: string;
  accountName: string;
  escalationRate: string;
  frequency: string;
  startDate: string;
  endDate: string;
  remainingValue: number;
  amountPerFreq: number;
  totalAmount: number;
  [key: string]: string | number | null;
}

const data: ForecastRow[] = [
  // Land Costs (parent)
  { id: 1, parentId: null, type: 'parent', accountCode: 'L', accountName: 'Land Costs', escalationRate: '', frequency: '', startDate: '', endDate: '', remainingValue: 0, amountPerFreq: 0, totalAmount: 44310000 },
  { id: 2, parentId: 1, type: 'child2', accountCode: 'L.01', accountName: 'Purchase Price', escalationRate: 'none', frequency: 'one-off', startDate: '2025-07-01', endDate: '2025-07-31', remainingValue: 0, amountPerFreq: 38000000, totalAmount: 38000000, m_2025_07: 38000000 },
  { id: 3, parentId: 1, type: 'child2', accountCode: 'L.02', accountName: 'Stamp Duty', escalationRate: 'none', frequency: 'one-off', startDate: '2025-07-01', endDate: '2025-07-31', remainingValue: 0, amountPerFreq: 2310000, totalAmount: 2310000, m_2025_07: 2310000 },
  { id: 4, parentId: 1, type: 'child2', accountCode: 'L.03', accountName: 'Legal & Acquisition', escalationRate: 'none', frequency: 'one-off', startDate: '2025-08-01', endDate: '2025-08-31', remainingValue: 0, amountPerFreq: 1500000, totalAmount: 1500000, m_2025_08: 1500000 },
  { id: 5, parentId: 1, type: 'child2', accountCode: 'L.04', accountName: "Agent's Commission", escalationRate: 'none', frequency: 'one-off', startDate: '2025-07-01', endDate: '2025-07-31', remainingValue: 0, amountPerFreq: 2500000, totalAmount: 2500000, m_2025_07: 2500000 },

  // Construction (parent)
  { id: 6, parentId: null, type: 'parent', accountCode: 'C', accountName: 'Construction', escalationRate: '', frequency: '', startDate: '', endDate: '', remainingValue: 0, amountPerFreq: 0, totalAmount: 86530000 },
  { id: 7, parentId: 6, type: 'child2', accountCode: 'C.01', accountName: 'Substructure', escalationRate: 'cpi', frequency: 'monthly', startDate: '2026-07-01', endDate: '2026-12-31', remainingValue: 0, amountPerFreq: 2167500, totalAmount: 13005000, m_2026_07: 2167500, m_2026_08: 2167500, m_2026_09: 2167500, m_2026_10: 2167500, m_2026_11: 2167500, m_2026_12: 2167500 },
  { id: 8, parentId: 6, type: 'child2', accountCode: 'C.02', accountName: 'Superstructure', escalationRate: 'cpi', frequency: 'monthly', startDate: '2027-01-01', endDate: '2027-07-31', remainingValue: 0, amountPerFreq: 4335000, totalAmount: 30345000, m_2027_01: 4335000, m_2027_02: 4335000, m_2027_03: 4335000, m_2027_04: 4335000, m_2027_05: 4335000, m_2027_06: 4335000, m_2027_07: 4335000 },
  { id: 9, parentId: 6, type: 'child2', accountCode: 'C.03', accountName: 'Finishes', escalationRate: 'cpi', frequency: 'monthly', startDate: '2027-05-01', endDate: '2027-10-31', remainingValue: 0, amountPerFreq: 3612500, totalAmount: 21675000, m_2027_05: 3612500, m_2027_06: 3612500, m_2027_07: 3612500, m_2027_08: 3612500, m_2027_09: 3612500, m_2027_10: 3612500 },
  { id: 10, parentId: 6, type: 'child2', accountCode: 'C.04', accountName: 'Services (M&E)', escalationRate: 'non-cpi', frequency: 'monthly', startDate: '2027-03-01', endDate: '2027-09-30', remainingValue: 0, amountPerFreq: 1857857, totalAmount: 13005000, m_2027_03: 1857857, m_2027_04: 1857857, m_2027_05: 1857857, m_2027_06: 1857857, m_2027_07: 1857857, m_2027_08: 1857857, m_2027_09: 1857858 },
  { id: 11, parentId: 6, type: 'child2', accountCode: 'C.05', accountName: 'External Works', escalationRate: 'none', frequency: 'monthly', startDate: '2027-10-01', endDate: '2027-12-31', remainingValue: 0, amountPerFreq: 1416667, totalAmount: 4250000, m_2027_10: 1416667, m_2027_11: 1416667, m_2027_12: 1416666 },
  { id: 12, parentId: 6, type: 'child2', accountCode: 'C.06', accountName: 'Preliminaries', escalationRate: 'none', frequency: 'monthly', startDate: '2026-07-01', endDate: '2027-12-31', remainingValue: 0, amountPerFreq: 236111, totalAmount: 4250000, m_2026_07: 236111, m_2026_08: 236111, m_2026_09: 236111, m_2026_10: 236111, m_2026_11: 236111, m_2026_12: 236111, m_2027_01: 236111, m_2027_02: 236111, m_2027_03: 236111, m_2027_04: 236111, m_2027_05: 236111, m_2027_06: 236111, m_2027_07: 236111, m_2027_08: 236111, m_2027_09: 236111, m_2027_10: 236111, m_2027_11: 236111, m_2027_12: 236113 },

  // Professional Fees
  { id: 13, parentId: null, type: 'parent', accountCode: 'PF', accountName: 'Professional Fees', escalationRate: '', frequency: '', startDate: '', endDate: '', remainingValue: 0, amountPerFreq: 0, totalAmount: 8500000 },
  { id: 14, parentId: 13, type: 'child2', accountCode: 'PF.01', accountName: 'Architect', escalationRate: 'none', frequency: 'monthly', startDate: '2025-10-01', endDate: '2027-06-30', remainingValue: 0, amountPerFreq: 161905, totalAmount: 3400000, m_2025_10: 161905, m_2025_11: 161905, m_2025_12: 161905, m_2026_01: 161905, m_2026_02: 161905, m_2026_03: 161905, m_2026_04: 161905, m_2026_05: 161905, m_2026_06: 161905, m_2026_07: 161905, m_2026_08: 161905, m_2026_09: 161905, m_2026_10: 161905, m_2026_11: 161905, m_2026_12: 161905, m_2027_01: 161905, m_2027_02: 161905, m_2027_03: 161905, m_2027_04: 161905, m_2027_05: 161905, m_2027_06: 161900 },
  { id: 15, parentId: 13, type: 'child2', accountCode: 'PF.02', accountName: 'Engineer', escalationRate: 'none', frequency: 'monthly', startDate: '2026-01-01', endDate: '2027-06-30', remainingValue: 0, amountPerFreq: 141667, totalAmount: 2550000, m_2026_01: 141667, m_2026_02: 141667, m_2026_03: 141667, m_2026_04: 141667, m_2026_05: 141667, m_2026_06: 141667, m_2026_07: 141667, m_2026_08: 141667, m_2026_09: 141667, m_2026_10: 141667, m_2026_11: 141667, m_2026_12: 141667, m_2027_01: 141667, m_2027_02: 141667, m_2027_03: 141667, m_2027_04: 141667, m_2027_05: 141667, m_2027_06: 141661 },
  { id: 16, parentId: 13, type: 'child2', accountCode: 'PF.03', accountName: 'Quantity Surveyor', escalationRate: 'none', frequency: 'quarterly', startDate: '2026-04-01', endDate: '2027-09-30', remainingValue: 0, amountPerFreq: 283333, totalAmount: 1700000, m_2026_04: 283333, m_2026_07: 283333, m_2026_10: 283333, m_2027_01: 283333, m_2027_04: 283334, m_2027_07: 283334 },
  { id: 17, parentId: 13, type: 'child2', accountCode: 'PF.04', accountName: 'Project Manager', escalationRate: 'none', frequency: 'monthly', startDate: '2026-07-01', endDate: '2027-12-31', remainingValue: 0, amountPerFreq: 47222, totalAmount: 850000, m_2026_07: 47222, m_2026_08: 47222, m_2026_09: 47222, m_2026_10: 47222, m_2026_11: 47222, m_2026_12: 47222, m_2027_01: 47222, m_2027_02: 47222, m_2027_03: 47222, m_2027_04: 47222, m_2027_05: 47222, m_2027_06: 47222, m_2027_07: 47222, m_2027_08: 47222, m_2027_09: 47222, m_2027_10: 47222, m_2027_11: 47222, m_2027_12: 47226 },
  { id: 18, parentId: 13, type: 'child2', accountCode: 'PF.05', accountName: 'Legal', escalationRate: 'none', frequency: 'quarterly', startDate: '2025-10-01', endDate: '2027-12-31', remainingValue: 0, amountPerFreq: 111111, totalAmount: 1000000, m_2025_10: 111111, m_2026_01: 111111, m_2026_04: 111111, m_2026_07: 111111, m_2026_10: 111111, m_2027_01: 111111, m_2027_04: 111111, m_2027_07: 111111, m_2027_10: 111112 },

  // Statutory
  { id: 19, parentId: null, type: 'parent', accountCode: 'ST', accountName: 'Statutory Costs', escalationRate: '', frequency: '', startDate: '', endDate: '', remainingValue: 0, amountPerFreq: 0, totalAmount: 5100000 },
  { id: 20, parentId: 19, type: 'child2', accountCode: 'ST.01', accountName: 'Council S94', escalationRate: 'none', frequency: 'one-off', startDate: '2025-12-01', endDate: '2025-12-31', remainingValue: 0, amountPerFreq: 3400000, totalAmount: 3400000, m_2025_12: 3400000 },
  { id: 21, parentId: 19, type: 'child2', accountCode: 'ST.02', accountName: 'DA/CC Fees', escalationRate: 'none', frequency: 'one-off', startDate: '2025-10-01', endDate: '2025-10-31', remainingValue: 0, amountPerFreq: 850000, totalAmount: 850000, m_2025_10: 850000 },
  { id: 22, parentId: 19, type: 'child2', accountCode: 'ST.03', accountName: 'Infrastructure Levy', escalationRate: 'none', frequency: 'quarterly', startDate: '2026-04-01', endDate: '2026-06-30', remainingValue: 0, amountPerFreq: 283333, totalAmount: 850000, m_2026_04: 283333, m_2026_05: 283333, m_2026_06: 283334 },

  // Finance Costs
  { id: 23, parentId: null, type: 'parent', accountCode: 'FC', accountName: 'Finance Costs', escalationRate: '', frequency: '', startDate: '', endDate: '', remainingValue: 0, amountPerFreq: 0, totalAmount: 9360000 },
  { id: 24, parentId: 23, type: 'child2', accountCode: 'FC.01', accountName: 'Senior Debt Interest', escalationRate: 'none', frequency: 'monthly', startDate: '2026-07-01', endDate: '2027-10-31', remainingValue: 0, amountPerFreq: 520000, totalAmount: 8320000, m_2026_07: 283333, m_2026_08: 311667, m_2026_09: 340000, m_2026_10: 368333, m_2026_11: 396667, m_2026_12: 425000, m_2027_01: 453333, m_2027_02: 481667, m_2027_03: 504167, m_2027_04: 526667, m_2027_05: 549167, m_2027_06: 571667, m_2027_07: 588333, m_2027_08: 605000, m_2027_09: 621667, m_2027_10: 813333 },
  { id: 25, parentId: 23, type: 'child2', accountCode: 'FC.02', accountName: 'Establishment Fees', escalationRate: 'none', frequency: 'one-off', startDate: '2026-07-01', endDate: '2026-07-31', remainingValue: 0, amountPerFreq: 1040000, totalAmount: 1040000, m_2026_07: 1040000 },

  // Marketing
  { id: 26, parentId: null, type: 'parent', accountCode: 'MK', accountName: 'Marketing & Sales', escalationRate: '', frequency: '', startDate: '', endDate: '', remainingValue: 0, amountPerFreq: 0, totalAmount: 3200000 },
  { id: 27, parentId: 26, type: 'child2', accountCode: 'MK.01', accountName: 'Sales & Marketing', escalationRate: 'none', frequency: 'monthly', startDate: '2027-04-01', endDate: '2028-03-31', remainingValue: 0, amountPerFreq: 200000, totalAmount: 2400000, m_2027_04: 200000, m_2027_05: 200000, m_2027_06: 200000, m_2027_07: 200000, m_2027_08: 200000, m_2027_09: 200000, m_2027_10: 200000, m_2027_11: 200000, m_2027_12: 200000, m_2028_01: 200000, m_2028_02: 200000, m_2028_03: 200000 },
  { id: 28, parentId: 26, type: 'child2', accountCode: 'MK.02', accountName: 'Display & Signage', escalationRate: 'none', frequency: 'one-off', startDate: '2027-04-01', endDate: '2027-06-30', remainingValue: 0, amountPerFreq: 800000, totalAmount: 800000, m_2027_04: 266667, m_2027_05: 266667, m_2027_06: 266666 },

  // Revenue (negative values = inflows)
  { id: 29, parentId: null, type: 'parent', accountCode: 'RV', accountName: 'Revenue', escalationRate: '', frequency: '', startDate: '', endDate: '', remainingValue: 0, amountPerFreq: 0, totalAmount: -199210000 },
  { id: 30, parentId: 29, type: 'child2', accountCode: 'RV.01', accountName: 'BTS Sales Revenue', escalationRate: 'none', frequency: 'monthly', startDate: '2028-01-01', endDate: '2028-06-30', remainingValue: 0, amountPerFreq: -31201667, totalAmount: -187210000, m_2028_01: -31201667, m_2028_02: -31201667, m_2028_03: -31201667, m_2028_04: -31201667, m_2028_05: -31201667, m_2028_06: -31201665 },
  { id: 31, parentId: 29, type: 'child2', accountCode: 'RV.02', accountName: 'Rental Revenue', escalationRate: 'none', frequency: 'monthly', startDate: '2028-01-01', endDate: '2028-06-30', remainingValue: 0, amountPerFreq: -2000000, totalAmount: -12000000, m_2028_01: -2000000, m_2028_02: -2000000, m_2028_03: -2000000, m_2028_04: -2000000, m_2028_05: -2000000, m_2028_06: -2000000 },
];

// 36 months: Jul 2025 – Jun 2028
const ts = timeSeries({
  start: '2025-07-01',
  end: '2028-06-01',
  locale: 'en-AU',
  fiscalYearStart: 7,
  columnWidth: 90,
  columnDefaults: {
    cellType: 'currency' as never,
    precision: 0,
    hideZero: true,
  },
});

function buildNetTotalRow(): ForecastRow {
  const roots = data.filter(r => r.parentId === null);
  const row: ForecastRow = {
    id: -1,
    parentId: null,
    type: 'parent',
    accountCode: '',
    accountName: 'Net Total',
    escalationRate: '',
    frequency: '',
    startDate: '',
    endDate: '',
    remainingValue: 0,
    amountPerFreq: 0,
    totalAmount: roots.reduce((s, r) => s + r.totalAmount, 0),
  };
  for (const col of ts.columns) {
    let sum = 0;
    for (const r of roots) {
      const val = r[col.id];
      if (typeof val === 'number') sum += val;
    }
    // Also sum from child rows whose parent is a root (roots may not have monthly values directly)
    for (const r of data) {
      if (r.parentId !== null) {
        const val = r[col.id];
        if (typeof val === 'number') {
          // Check if parent is a root (parentId is in roots list)
          const parentIsRoot = roots.some(root => root.id === r.parentId);
          if (parentIsRoot) sum += val;
        }
      }
    }
    if (sum !== 0) row[col.id] = sum;
  }
  return row;
}

const netTotalRow = buildNetTotalRow();

export function DmForecast() {
  const columns = useMemo<ColumnDef<ForecastRow>[]>(
    () => [
      { id: 'toggle', header: '', width: 30 },
      { id: 'accountCode', accessorKey: 'accountCode', header: 'ID', width: 70, align: 'center' as const },
      { id: 'accountName', accessorKey: 'accountName', header: 'Description', width: 210 },
      {
        id: 'escalationRate', accessorKey: 'escalationRate', header: 'Escalation', width: 100, cellEditor: 'dropdown' as const,
        options: [
          { label: 'None', value: 'none' },
          { label: 'CPI - 3%', value: 'cpi' },
          { label: 'Non-CPI - 2%', value: 'non-cpi' },
        ],
      },
      {
        id: 'frequency', accessorKey: 'frequency', header: 'Frequency', width: 100, cellEditor: 'dropdown' as const,
        options: [
          { label: 'Monthly', value: 'monthly' },
          { label: 'Quarterly', value: 'quarterly' },
          { label: 'Annually', value: 'annually' },
          { label: 'One-off', value: 'one-off' },
          { label: 'Other', value: 'other' },
          { label: 'S-curve', value: 'scurve' },
        ],
      },
      { id: 'startDate', accessorKey: 'startDate', header: 'Start', width: 80, cellType: 'date' as const, dateFormat: 'month-year' as const },
      { id: 'endDate', accessorKey: 'endDate', header: 'End', width: 80, cellType: 'date' as const, dateFormat: 'month-year' as const },
      { id: 'remainingValue', accessorKey: 'remainingValue', header: 'Remaining Value', width: 100, cellType: 'currency' as const, precision: 0, align: 'right' as const, editable: true, hideZero: true },
      { id: 'amountPerFreq', accessorKey: 'amountPerFreq', header: 'Amount per Freq.', width: 100, cellType: 'currency' as const, precision: 0, align: 'right' as const, editable: true, hideZero: true },
      {
        id: 'totalAmount', accessorKey: 'totalAmount', header: 'Total Amount', width: 110, cellType: 'currency' as const, precision: 0, align: 'right' as const,
        cellStyle: (v: unknown) => {
          const style: Record<string, string> = { fontWeight: '600', background: '#f5f5f5', borderRight: '2px solid #EAECF0' };
          if (typeof v === 'number' && v < 0) style.color = '#16a34a';
          return style;
        },
      },
      ...ts.columns.map(c => ({
        ...c,
        editable: true,
        cellStyle: (v: unknown) => {
          if (typeof v === 'number' && v < 0) return { color: '#16a34a' };
          return undefined;
        },
      })),
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick', precision: 0 }),
      sorting(),
      hierarchy({ indentColumn: 'accountName', indentSize: 22 }),
      cellRenderers(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'dm-forecast' }),
    ],
    [],
  );

  const pinnedBottomRows = useMemo(() => [netTotalRow], []);

  const { grid, containerRef } = useGrid<ForecastRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 10,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    hierarchy: {
      getRowId: (row: ForecastRow) => row.id,
      getParentId: (row: ForecastRow) => row.parentId,
      defaultExpanded: true,
    },
    pinnedBottomRows,
    selection: { mode: 'range' as const, fillHandle: true },
    headerHeight: 44,
    rowHeight: 44,
  });

  const handleExpandAll = useCallback(() => grid.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.collapseAll(), [grid]);
  const handleExportCsv = useCallback(() => grid.plugins.export?.exportToCsv(), [grid]);
  const handleExportExcel = useCallback(() => grid.plugins.export?.exportToExcel(), [grid]);
  const handleUndo = useCallback(() => grid.plugins.undoRedo?.undo(), [grid]);
  const handleRedo = useCallback(() => grid.plugins.undoRedo?.redo(), [grid]);

  const btnStyle = { padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 } as const;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>DM Forecast</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleExpandAll} style={btnStyle}>Expand All</button>
          <button onClick={handleCollapseAll} style={btnStyle}>Collapse All</button>
          <button onClick={handleUndo} style={btnStyle}>Undo</button>
          <button onClick={handleRedo} style={btnStyle}>Redo</button>
          <button onClick={handleExportCsv} style={btnStyle}>CSV</button>
          <button onClick={handleExportExcel} style={btnStyle}>Excel</button>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Development cost forecast with hierarchical accounts, escalation rates, and frequency-based monthly distribution.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, sorting, hierarchy, cellRenderers, clipboard, undoRedo, export &bull;
        <strong> Core:</strong> frozenLeftColumns, hierarchy, pinnedBottomRows
      </div>
      <div
        ref={containerRef}
        style={{
          height: 560,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          
          borderRadius: 12,
        }}
      />
    </div>
  );
}
