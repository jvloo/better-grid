import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { formatting, editing, sorting, filtering, cellRenderers, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface ActualRow {
  id: number;
  child2Code: string;
  child2Name: string;
  child1Code: string;
  child1Name: string;
  parentCode: string;
  parentName: string;
  total: number;
  [key: string]: string | number | null;
}

const data: ActualRow[] = [
  { id: 1, child2Code: 'C10011', child2Name: 'Settlement Payment', child1Code: 'C1001', child1Name: 'Purchase', parentCode: 'B1001', parentName: 'Land', total: 38000000, m_2026_07: 38000000 },
  { id: 2, child2Code: 'C10021', child2Name: 'Stamp Duty Payment', child1Code: 'C1002', child1Name: 'Stamp Duty', parentCode: 'B1001', parentName: 'Land', total: 2310000, m_2026_07: 2310000 },
  { id: 3, child2Code: 'C10031', child2Name: 'Settlement Legal Fees', child1Code: 'C1003', child1Name: 'Legal', parentCode: 'B1001', parentName: 'Land', total: 1500000, m_2026_08: 750000, m_2026_09: 750000 },
  { id: 4, child2Code: 'C20011', child2Name: 'Piling Works', child1Code: 'C2001', child1Name: 'Substructure', parentCode: 'B2001', parentName: 'Construction', total: 6800000, m_2026_10: 1700000, m_2026_11: 1700000, m_2026_12: 1700000, m_2027_01: 1700000 },
  { id: 5, child2Code: 'C20012', child2Name: 'Excavation', child1Code: 'C2001', child1Name: 'Substructure', parentCode: 'B2001', parentName: 'Construction', total: 4200000, m_2026_07: 1050000, m_2026_08: 1050000, m_2026_09: 1050000, m_2026_10: 1050000 },
  { id: 6, child2Code: 'C20021', child2Name: 'Concrete Frame', child1Code: 'C2002', child1Name: 'Superstructure', parentCode: 'B2001', parentName: 'Construction', total: 18500000, m_2027_01: 2642857, m_2027_02: 2642857, m_2027_03: 2642857, m_2027_04: 2642857, m_2027_05: 2642857, m_2027_06: 2642857, m_2027_07: 2642858 },
  { id: 7, child2Code: 'C20022', child2Name: 'Structural Steel', child1Code: 'C2002', child1Name: 'Superstructure', parentCode: 'B2001', parentName: 'Construction', total: 8400000, m_2027_02: 1400000, m_2027_03: 1400000, m_2027_04: 1400000, m_2027_05: 1400000, m_2027_06: 1400000, m_2027_07: 1400000 },
  { id: 8, child2Code: 'C20031', child2Name: 'Tiling & Flooring', child1Code: 'C2003', child1Name: 'Finishes', parentCode: 'B2001', parentName: 'Construction', total: 5600000, m_2027_06: 933333, m_2027_07: 933333, m_2027_08: 933333, m_2027_09: 933333, m_2027_10: 933334, m_2027_11: 933334 },
  { id: 9, child2Code: 'C20032', child2Name: 'Painting & Coatings', child1Code: 'C2003', child1Name: 'Finishes', parentCode: 'B2001', parentName: 'Construction', total: 3200000, m_2027_08: 800000, m_2027_09: 800000, m_2027_10: 800000, m_2027_11: 800000 },
  { id: 10, child2Code: 'C20041', child2Name: 'Mechanical (HVAC)', child1Code: 'C2004', child1Name: 'Services', parentCode: 'B2001', parentName: 'Construction', total: 7800000, m_2027_03: 1300000, m_2027_04: 1300000, m_2027_05: 1300000, m_2027_06: 1300000, m_2027_07: 1300000, m_2027_08: 1300000 },
  { id: 11, child2Code: 'C30011', child2Name: 'Design Fees Phase 2', child1Code: 'C3001', child1Name: 'Architect', parentCode: 'B3001', parentName: 'Professional', total: 1800000, m_2026_07: 150000, m_2026_08: 150000, m_2026_09: 150000, m_2026_10: 150000, m_2026_11: 150000, m_2026_12: 150000, m_2027_01: 150000, m_2027_02: 150000, m_2027_03: 150000, m_2027_04: 150000, m_2027_05: 150000, m_2027_06: 150000 },
  { id: 12, child2Code: 'C30021', child2Name: 'Structural Review', child1Code: 'C3002', child1Name: 'Engineer', parentCode: 'B3001', parentName: 'Professional', total: 960000, m_2026_09: 120000, m_2026_10: 120000, m_2026_11: 120000, m_2026_12: 120000, m_2027_01: 120000, m_2027_02: 120000, m_2027_03: 120000, m_2027_04: 120000 },
  { id: 13, child2Code: 'C40011', child2Name: 'S94 Contribution', child1Code: 'C4001', child1Name: 'Council', parentCode: 'B4001', parentName: 'Statutory', total: 3400000, m_2026_07: 3400000 },
  { id: 14, child2Code: 'C50011', child2Name: 'Agent Commission', child1Code: 'C5001', child1Name: 'Sales', parentCode: 'B5001', parentName: 'Marketing', total: 2400000, m_2028_01: 400000, m_2028_02: 400000, m_2028_03: 400000, m_2028_04: 400000, m_2028_05: 400000, m_2028_06: 400000 },
  { id: 15, child2Code: 'C60011', child2Name: 'Senior Debt Interest', child1Code: 'C6001', child1Name: 'Interest', parentCode: 'B6001', parentName: 'Finance', total: 8160000, m_2026_07: 283333, m_2026_08: 311667, m_2026_09: 340000, m_2026_10: 368333, m_2026_11: 396667, m_2026_12: 425000, m_2027_01: 453333, m_2027_02: 481667, m_2027_03: 504167, m_2027_04: 526667, m_2027_05: 549167, m_2027_06: 571667, m_2027_07: 588333, m_2027_08: 605000, m_2027_09: 621667, m_2027_10: 638333 },
];

// Generate 24 monthly columns: Jul 2026 – Jun 2028
const months: { key: string; label: string; fy: string }[] = [];
for (let i = 0; i < 24; i++) {
  const d = new Date(2026, 6 + i); // starts at Jul 2026
  const key = `m_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('en-AU', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  const fy = d.getMonth() >= 6 ? `FY${d.getFullYear() + 1}` : `FY${d.getFullYear()}`;
  months.push({ key, label, fy });
}

// Compute pinned bottom totals row
function buildTotalsRow(): ActualRow {
  const totals: ActualRow = {
    id: -1,
    child2Code: '',
    child2Name: 'TOTAL',
    child1Code: '',
    child1Name: '',
    parentCode: '',
    parentName: '',
    total: 0,
  };
  for (const row of data) {
    totals.total += row.total;
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

export function DmActuals() {
  const columns = useMemo<ColumnDef<ActualRow>[]>(
    () => [
      {
        id: 'actions',
        header: '',
        width: 50,
      },
      {
        id: 'child2Code',
        accessorKey: 'child2Code',
        header: 'ID',
        width: 85,
        align: 'center' as const,
      },
      {
        id: 'child2Name',
        accessorKey: 'child2Name',
        header: 'Description',
        width: 200,
        editable: true,
      },
      {
        id: 'child1Code',
        accessorKey: 'child1Code',
        header: 'ID',
        width: 85,
        align: 'center' as const,
      },
      {
        id: 'child1Name',
        accessorKey: 'child1Name',
        header: 'Description',
        width: 200,
      },
      {
        id: 'parentCode',
        accessorKey: 'parentCode',
        header: 'ID',
        width: 85,
        align: 'center' as const,
      },
      {
        id: 'parentName',
        accessorKey: 'parentName',
        header: 'Description',
        width: 200,
      },
      {
        id: 'total',
        accessorKey: 'total',
        header: 'Total',
        width: 72,
        cellType: 'currency' as const,
        precision: 0,
        align: 'right' as const,
      },
      ...months.map(m => ({
        id: m.key,
        accessorKey: m.key,
        header: m.label,
        width: 90,
        cellType: 'currency' as const,
        precision: 0,
        hideZero: true,
        editable: true,
      })),
    ],
    [],
  );

  const multiHeaders = useMemo<HeaderRow[]>(() => {
    const fyGroups: { fy: string; count: number }[] = [];
    for (const m of months) {
      if (fyGroups.length > 0 && fyGroups[fyGroups.length - 1].fy === m.fy) {
        fyGroups[fyGroups.length - 1].count++;
      } else {
        fyGroups.push({ fy: m.fy, count: 1 });
      }
    }

    return [
      {
        id: 'groups',
        height: 32,
        cells: [
          { id: 'g-actions', content: '', columnId: 'actions' },
          { id: 'g-child2', content: 'Child2', colSpan: 2 },
          { id: 'g-child1', content: 'Child1', colSpan: 2 },
          { id: 'g-parent', content: 'Parent', colSpan: 2 },
          { id: 'g-total', content: 'Total', rowSpan: 2 },
          ...fyGroups.map(g => ({
            id: `g-${g.fy.toLowerCase()}`,
            content: g.fy,
            colSpan: g.count,
          })),
        ],
      },
      {
        id: 'columns',
        height: 32,
        cells: [
          { id: 'h-actions', content: '', columnId: 'actions' },
          { id: 'h-child2Code', content: 'ID', columnId: 'child2Code' },
          { id: 'h-child2Name', content: 'Description', columnId: 'child2Name' },
          { id: 'h-child1Code', content: 'ID', columnId: 'child1Code' },
          { id: 'h-child1Name', content: 'Description', columnId: 'child1Name' },
          { id: 'h-parentCode', content: 'ID', columnId: 'parentCode' },
          { id: 'h-parentName', content: 'Description', columnId: 'parentName' },
          ...months.map(m => ({
            id: `h-${m.key}`,
            content: m.label,
            columnId: m.key,
          })),
        ],
      },
    ];
  }, []);

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick', precision: 0 }),
      sorting(),
      filtering(),
      cellRenderers(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'dm-input-actuals' }),
    ],
    [],
  );

  const pinnedBottomRows = useMemo(() => [totalsRow], []);

  const { grid, containerRef } = useGrid<ActualRow>({
    data,
    columns,
    headerRows: multiHeaders,
    plugins,
    frozenLeftColumns: 8,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    pinnedBottomRows,
    selection: { mode: 'range' as const, fillHandle: true },
    rowHeight: 40,
  });

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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>DM Input Actuals</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleUndo} style={btnStyle}>Undo</button>
          <button onClick={handleRedo} style={btnStyle}>Redo</button>
          <button onClick={handleExportCsv} style={btnStyle}>CSV</button>
          <button onClick={handleExportExcel} style={btnStyle}>Excel</button>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Actual cost entries with parent/child account structure and monthly breakdown. Each row represents a child-2 level account item.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, sorting, filtering, cellRenderers, clipboard, undoRedo, export &bull;
        <strong> Core:</strong> frozenLeftColumns, headerRows, pinnedBottomRows
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
