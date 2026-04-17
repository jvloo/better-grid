import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, editing, sorting, hierarchy, cellRenderers, validation, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface CostRow {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  input: number;
  inputNote: string;
  escalation: string;
  amount: number;
  start: string;
  end: string;
  variance: number;
  custom: boolean;
  [key: string]: string | number | boolean | null;
}

// Data from QA app project 4288: https://qa-app.wiseway.ai/projects/4288/cost
// TDC: $161,041,739
const data: CostRow[] = [
  // 1. Land Cost
  { id: 1, parentId: null, code: '1', name: 'Land Cost', input: 27000000, inputNote: 'Fixed', escalation: 'none', amount: 27000000, start: '2023-08-01', end: '2024-01-31', variance: 0, custom: false, m_2023_08: 27000000 },
  { id: 2, parentId: 1, code: '1.01', name: 'Deposit', input: 2700000, inputNote: '10.00%', escalation: 'none', amount: 2700000, start: '2023-08-01', end: '2023-08-31', variance: 0, custom: false, m_2023_08: 2700000 },
  { id: 3, parentId: 1, code: '1.02', name: 'Settlement', input: 24300000, inputNote: '90.00%', escalation: 'none', amount: 24300000, start: '2024-01-01', end: '2024-01-31', variance: 0, custom: false, m_2024_01: 24300000 },

  // 2. Acquisition Cost
  { id: 4, parentId: null, code: '2', name: 'Acquisition Cost', input: 0, inputNote: '', escalation: '', amount: 1964870, start: '2023-08-01', end: '2023-11-30', variance: 0, custom: false },
  { id: 5, parentId: 4, code: '2.01', name: 'Stamp Duty', input: 1734870, inputNote: 'Fixed', escalation: 'none', amount: 1734870, start: '2023-08-01', end: '2023-08-31', variance: 0, custom: false, m_2023_08: 1734870 },
  { id: 6, parentId: 4, code: '2.02', name: 'DD Costs', input: 200000, inputNote: 'Fixed', escalation: 'cpi', amount: 200000, start: '2023-08-01', end: '2023-11-30', variance: 0, custom: false, m_2023_08: 50000, m_2023_09: 50000, m_2023_10: 50000, m_2023_11: 50000 },
  { id: 7, parentId: 4, code: '2.03', name: 'ASIC SPV Establishment', input: 30000, inputNote: 'Fixed', escalation: 'cpi', amount: 30000, start: '2023-08-01', end: '2023-08-31', variance: 0, custom: false, m_2023_08: 30000 },

  // 3. Construction Cost
  { id: 8, parentId: null, code: '3', name: 'Construction Cost', input: 0, inputNote: '', escalation: '', amount: 114471000, start: '2024-10-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 9, parentId: 8, code: '3.01', name: 'Demolition', input: 1500000, inputNote: 'Fixed', escalation: 'cpi', amount: 1500000, start: '2024-10-01', end: '2024-12-31', variance: 0, custom: false, m_2024_10: 500000, m_2024_11: 500000, m_2024_12: 500000 },
  { id: 10, parentId: 8, code: '3.03', name: 'Early Work', input: 1020000, inputNote: 'Fixed', escalation: 'cpi', amount: 1020000, start: '2025-01-01', end: '2025-06-30', variance: 0, custom: false, m_2025_01: 170000, m_2025_02: 170000, m_2025_03: 170000, m_2025_04: 170000, m_2025_05: 170000, m_2025_06: 170000 },
  { id: 11, parentId: 8, code: '3.05', name: 'Main Construction', input: 106500000, inputNote: 'Fixed', escalation: 'cpi', amount: 106500000, start: '2025-04-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 12, parentId: 8, code: '3.08', name: 'Construction Contingency', input: 5451000, inputNote: '5.00%', escalation: 'none', amount: 5451000, start: '2024-10-01', end: '2026-09-30', variance: 0, custom: false },

  // 4. Professional Fees
  { id: 13, parentId: null, code: '4', name: 'Professional Fees', input: 0, inputNote: '', escalation: '', amount: 2500506, start: '2023-08-01', end: '2025-03-31', variance: 0, custom: false },
  { id: 14, parentId: 13, code: '4.03', name: 'Architecture', input: 500506, inputNote: 'Fixed', escalation: 'cpi', amount: 500506, start: '2023-08-01', end: '2025-03-31', variance: 0, custom: false },
  { id: 15, parentId: 13, code: '4.11', name: 'External PM / Superintendent', input: 2000000, inputNote: 'Fixed', escalation: 'cpi', amount: 2000000, start: '2024-10-01', end: '2026-09-30', variance: 0, custom: false },
];

// Monthly columns: Aug 2023 – Oct 2026 (39 months, matching Program)
const ts = timeSeries({
  start: '2023-08-01',
  end: '2026-10-01',
  locale: 'en-AU',
  columnDefaults: {
    cellType: 'currency' as never,
    precision: 0,
    hideZero: true,
  },
});

// Compute pinned bottom totals row from root-level rows
function buildTotalsRow(): CostRow {
  const rootRows = data.filter(r => r.parentId === null);
  const totals: CostRow = {
    id: -1,
    parentId: null,
    code: '',
    name: 'TOTAL',
    input: 0,
    inputNote: '',
    escalation: '',
    amount: 0,
    start: '',
    end: '',
    variance: 0,
    custom: false,
  };
  for (const row of rootRows) {
    totals.input += row.input;
    totals.amount += row.amount;
    totals.variance += row.variance;
  }
  for (const col of ts.columns) {
    let sum = 0;
    for (const row of data) {
      const val = row[col.id];
      if (typeof val === 'number') sum += val;
    }
    if (sum !== 0) totals[col.id] = sum;
  }
  return totals;
}

const totalsRow = buildTotalsRow();

export function FsbtCost() {
  const columns = useMemo<ColumnDef<CostRow>[]>(
    () => [
      { id: 'menu', header: '', width: 50 },
      { id: 'code', accessorKey: 'code', header: 'Code', width: 40, align: 'center' as const },
      { id: 'name', accessorKey: 'name', header: 'Phase', width: 236 },
      { id: 'input', accessorKey: 'input', header: 'Input', width: 110, cellType: 'currency' as const, precision: 0, align: 'right' as const, editable: true },
      { id: 'inputNote', accessorKey: 'inputNote', header: '', width: 140 },
      { id: 'escalation', accessorKey: 'escalation', header: 'Escalation', width: 110, editor: 'dropdown' as const, options: ['none', 'cpi', 'non-cpi'] },
      { id: 'amount', accessorKey: 'amount', header: 'Amount', width: 110, cellType: 'currency' as const, precision: 0, align: 'right' as const, cellStyle: () => ({ background: '#f5f5f5', fontWeight: '600' }) },
      { id: 'start', accessorKey: 'start', header: 'Start', width: 85, cellType: 'date' as const, dateFormat: 'month-year' as const },
      { id: 'end', accessorKey: 'end', header: 'End', width: 85, cellType: 'date' as const, dateFormat: 'month-year' as const },
      { id: 'variance', accessorKey: 'variance', header: 'Variance', width: 85, cellType: 'change' as const },
      { id: 'varianceStatus', header: '', width: 44 },
      ...ts.columns,
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick', precision: 0 }),
      sorting(),
      hierarchy({ indentColumn: 'name', indentSize: 22 }),
      cellRenderers(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-cost-breakdown' }),
    ],
    [],
  );

  const pinnedBottomRows = useMemo(() => [totalsRow], []);

  const { grid, containerRef } = useGrid<CostRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 12,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    hierarchy: {
      getRowId: (row: CostRow) => row.id,
      getParentId: (row: CostRow) => row.parentId,
      defaultExpanded: true,
    },
    pinnedBottomRows,
    selection: { mode: 'range' as const, fillHandle: true },
    headerHeight: 44,
    rowHeight: 44,
  });

  const handleExpandAll = useCallback(() => grid.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.collapseAll(), [grid]);
  const handleExportCsv = useCallback(() => {
    grid.getPlugin<{ exportToCsv: () => void }>('export')?.exportToCsv();
  }, [grid]);
  const handleExportExcel = useCallback(() => {
    grid.getPlugin<{ exportToExcel: () => void }>('export')?.exportToExcel();
  }, [grid]);
  const handleUndo = useCallback(() => {
    const api = grid.getPlugin<{ undo: () => void }>('undoRedo');
    api?.undo();
  }, [grid]);
  const handleRedo = useCallback(() => {
    const api = grid.getPlugin<{ redo: () => void }>('undoRedo');
    api?.redo();
  }, [grid]);

  const btnStyle = { padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 } as const;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>FSBT Cost Breakdown</h1>
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
        Hierarchical development cost structure with monthly cashflow distribution. CPI and non-CPI escalation options.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, sorting, hierarchy, cellRenderers, validation, clipboard, undoRedo, export &bull;
        <strong> Core:</strong> frozenLeftColumns, hierarchy, pinnedBottomRows
      </div>
      <div
        ref={containerRef}
        style={{
          height: 540,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          
          borderRadius: 12,
        }}
      />
    </div>
  );
}
