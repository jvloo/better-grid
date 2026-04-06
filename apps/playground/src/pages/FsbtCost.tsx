import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
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

const data: CostRow[] = [
  // Land Cost (parent)
  { id: 1, parentId: null, code: '1', name: 'Land Cost', input: 42000000, inputNote: 'Fixed', escalation: 'none', amount: 42000000, start: '2025-07-01', end: '2025-07-31', variance: 0, custom: false, m_2025_07: 42000000 },
  { id: 2, parentId: 1, code: '1.1', name: 'Purchase Price', input: 38000000, inputNote: 'Fixed', escalation: 'none', amount: 38000000, start: '2025-07-01', end: '2025-07-31', variance: 0, custom: false, m_2025_07: 38000000 },
  { id: 3, parentId: 1, code: '1.2', name: 'Stamp Duty', input: 2310000, inputNote: '5.5% of land', escalation: 'none', amount: 2310000, start: '2025-07-01', end: '2025-07-31', variance: 0, custom: false, m_2025_07: 2310000 },
  { id: 4, parentId: 1, code: '1.3', name: 'Legal & Acquisition', input: 1690000, inputNote: 'Fixed', escalation: 'none', amount: 1690000, start: '2025-07-01', end: '2025-07-31', variance: 0, custom: false, m_2025_07: 1690000 },

  // Construction (parent) — spread across 18 months of construction
  { id: 5, parentId: null, code: '2', name: 'Construction', input: 85000000, inputNote: '', escalation: '', amount: 85000000, start: '2026-07-01', end: '2027-12-31', variance: -1200000, custom: false },
  { id: 6, parentId: 5, code: '2.1', name: 'Substructure', input: 12750000, inputNote: '15% of const', escalation: 'cpi', amount: 13005000, start: '2026-07-01', end: '2026-12-31', variance: -255000, custom: false, m_2026_07: 2167500, m_2026_08: 2167500, m_2026_09: 2167500, m_2026_10: 2167500, m_2026_11: 2167500, m_2026_12: 2167500 },
  { id: 7, parentId: 5, code: '2.2', name: 'Superstructure', input: 29750000, inputNote: '35% of const', escalation: 'cpi', amount: 30345000, start: '2027-01-01', end: '2027-07-31', variance: -595000, custom: false, m_2027_01: 4335000, m_2027_02: 4335000, m_2027_03: 4335000, m_2027_04: 4335000, m_2027_05: 4335000, m_2027_06: 4335000, m_2027_07: 4335000 },
  { id: 8, parentId: 5, code: '2.3', name: 'Finishes', input: 21250000, inputNote: '25% of const', escalation: 'cpi', amount: 21675000, start: '2027-05-01', end: '2027-10-31', variance: -425000, custom: false, m_2027_05: 3612500, m_2027_06: 3612500, m_2027_07: 3612500, m_2027_08: 3612500, m_2027_09: 3612500, m_2027_10: 3612500 },
  { id: 9, parentId: 5, code: '2.4', name: 'Services (M&E)', input: 12750000, inputNote: '15% of const', escalation: 'non-cpi', amount: 13005000, start: '2027-03-01', end: '2027-09-30', variance: 75000, custom: false, m_2027_03: 1857857, m_2027_04: 1857857, m_2027_05: 1857857, m_2027_06: 1857857, m_2027_07: 1857857, m_2027_08: 1857857, m_2027_09: 1857858 },
  { id: 10, parentId: 5, code: '2.5', name: 'External Works', input: 4250000, inputNote: '5% of const', escalation: 'none', amount: 4250000, start: '2027-10-01', end: '2027-12-31', variance: 0, custom: false, m_2027_10: 1416667, m_2027_11: 1416667, m_2027_12: 1416666 },
  { id: 11, parentId: 5, code: '2.6', name: 'Preliminaries', input: 4250000, inputNote: '5% of const', escalation: 'none', amount: 4250000, start: '2026-07-01', end: '2027-12-31', variance: 0, custom: false, m_2026_07: 236111, m_2026_08: 236111, m_2026_09: 236111, m_2026_10: 236111, m_2026_11: 236111, m_2026_12: 236111, m_2027_01: 236111, m_2027_02: 236111, m_2027_03: 236111, m_2027_04: 236111, m_2027_05: 236111, m_2027_06: 236111, m_2027_07: 236111, m_2027_08: 236111, m_2027_09: 236111, m_2027_10: 236111, m_2027_11: 236111, m_2027_12: 236113 },

  // Professional Fees (parent)
  { id: 12, parentId: null, code: '3', name: 'Professional Fees', input: 8500000, inputNote: '', escalation: '', amount: 8500000, start: '2025-10-01', end: '2027-12-31', variance: 0, custom: false },
  { id: 13, parentId: 12, code: '3.1', name: 'Architect', input: 3400000, inputNote: '4% of const', escalation: 'none', amount: 3400000, start: '2025-10-01', end: '2027-06-30', variance: 0, custom: false, m_2025_10: 161905, m_2025_11: 161905, m_2025_12: 161905, m_2026_01: 161905, m_2026_02: 161905, m_2026_03: 161905, m_2026_04: 161905, m_2026_05: 161905, m_2026_06: 161905, m_2026_07: 161905, m_2026_08: 161905, m_2026_09: 161905, m_2026_10: 161905, m_2026_11: 161905, m_2026_12: 161905, m_2027_01: 161905, m_2027_02: 161905, m_2027_03: 161905, m_2027_04: 161905, m_2027_05: 161905, m_2027_06: 161900 },
  { id: 14, parentId: 12, code: '3.2', name: 'Structural Engineer', input: 2550000, inputNote: '3% of const', escalation: 'none', amount: 2550000, start: '2026-01-01', end: '2027-06-30', variance: 0, custom: false, m_2026_01: 141667, m_2026_02: 141667, m_2026_03: 141667, m_2026_04: 141667, m_2026_05: 141667, m_2026_06: 141667, m_2026_07: 141667, m_2026_08: 141667, m_2026_09: 141667, m_2026_10: 141667, m_2026_11: 141667, m_2026_12: 141667, m_2027_01: 141667, m_2027_02: 141667, m_2027_03: 141667, m_2027_04: 141667, m_2027_05: 141667, m_2027_06: 141661 },
  { id: 15, parentId: 12, code: '3.3', name: 'Quantity Surveyor', input: 1700000, inputNote: '2% of const', escalation: 'none', amount: 1700000, start: '2026-04-01', end: '2027-09-30', variance: 0, custom: false, m_2026_04: 94444, m_2026_05: 94444, m_2026_06: 94444, m_2026_07: 94444, m_2026_08: 94444, m_2026_09: 94444, m_2026_10: 94444, m_2026_11: 94444, m_2026_12: 94444, m_2027_01: 94444, m_2027_02: 94444, m_2027_03: 94444, m_2027_04: 94444, m_2027_05: 94444, m_2027_06: 94444, m_2027_07: 94444, m_2027_08: 94444, m_2027_09: 94452 },
  { id: 16, parentId: 12, code: '3.4', name: 'Project Manager', input: 850000, inputNote: '1% of const', escalation: 'none', amount: 850000, start: '2026-07-01', end: '2027-12-31', variance: 0, custom: false, m_2026_07: 47222, m_2026_08: 47222, m_2026_09: 47222, m_2026_10: 47222, m_2026_11: 47222, m_2026_12: 47222, m_2027_01: 47222, m_2027_02: 47222, m_2027_03: 47222, m_2027_04: 47222, m_2027_05: 47222, m_2027_06: 47222, m_2027_07: 47222, m_2027_08: 47222, m_2027_09: 47222, m_2027_10: 47222, m_2027_11: 47222, m_2027_12: 47226 },

  // Statutory Costs
  { id: 17, parentId: null, code: '4', name: 'Statutory Costs', input: 5100000, inputNote: '', escalation: '', amount: 5100000, start: '2025-12-01', end: '2026-06-30', variance: 0, custom: false },
  { id: 18, parentId: 17, code: '4.1', name: 'Council S94 Contributions', input: 3400000, inputNote: 'Fixed', escalation: 'none', amount: 3400000, start: '2025-12-01', end: '2025-12-31', variance: 0, custom: false, m_2025_12: 3400000 },
  { id: 19, parentId: 17, code: '4.2', name: 'DA/CC Application Fees', input: 850000, inputNote: 'Fixed', escalation: 'none', amount: 850000, start: '2025-10-01', end: '2025-10-31', variance: 0, custom: false, m_2025_10: 850000 },
  { id: 20, parentId: 17, code: '4.3', name: 'Infrastructure Levy', input: 850000, inputNote: 'Fixed', escalation: 'none', amount: 850000, start: '2026-04-01', end: '2026-06-30', variance: 0, custom: false, m_2026_04: 283333, m_2026_05: 283333, m_2026_06: 283334 },

  // Marketing & Sales
  { id: 21, parentId: null, code: '5', name: 'Marketing & Sales', input: 3200000, inputNote: '', escalation: '', amount: 3200000, start: '2027-04-01', end: '2028-03-31', variance: 0, custom: false },
  { id: 22, parentId: 21, code: '5.1', name: 'Sales & Marketing', input: 2400000, inputNote: 'Fixed', escalation: 'none', amount: 2400000, start: '2027-04-01', end: '2028-03-31', variance: 0, custom: false, m_2027_04: 200000, m_2027_05: 200000, m_2027_06: 200000, m_2027_07: 200000, m_2027_08: 200000, m_2027_09: 200000, m_2027_10: 200000, m_2027_11: 200000, m_2027_12: 200000, m_2028_01: 200000, m_2028_02: 200000, m_2028_03: 200000 },
  { id: 23, parentId: 21, code: '5.2', name: 'Display Suite', input: 800000, inputNote: 'Fixed', escalation: 'none', amount: 800000, start: '2027-04-01', end: '2027-06-30', variance: 0, custom: false, m_2027_04: 266667, m_2027_05: 266667, m_2027_06: 266666 },
];

const months: { key: string; label: string }[] = [];
for (let i = 0; i < 36; i++) {
  const d = new Date(2025, 6 + i);
  const key = `m_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('en-AU', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  months.push({ key, label });
}

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
  for (const m of months) {
    let sum = 0;
    for (const row of data) {
      const val = row[m.key];
      if (typeof val === 'number') sum += val;
    }
    if (sum !== 0) totals[m.key] = sum;
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
      ...months.map(m => ({
        id: m.key,
        accessorKey: m.key,
        header: m.label,
        width: 80,
        cellType: 'currency' as const,
        precision: 0,
        hideZero: true,
      })),
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
