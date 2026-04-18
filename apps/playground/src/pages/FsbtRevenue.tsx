import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, sorting, hierarchy, cellRenderers, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';
import { FSBT_STYLES, parentRowCellStyle, parentRowCellStyleIndented } from './_fsbt-cell-styles';

// ============================================================================
// Grid A: Build-to-Sell (BTS) General Table
// ============================================================================

interface BtsRow {
  id: number;
  type: string;
  stage: number;
  nsa: number;
  units: number;
  salePrice: number;
  growthRate: number | string;
  launchDate: string;
  projectedPrice: number;
  grossRevenue: number;
  gst: number;
  commUpfront: number;
  commBackend: number;
}

// Data from QA app project 4288: https://qa-app.wiseway.ai/projects/4288/revenue
// Total Gross Revenue: $224,739,528
const btsData: BtsRow[] = [
  { id: 1, type: 'Residential - BTS', stage: 1, nsa: 19500, units: 160, salePrice: 8803, growthRate: 6.0, launchDate: '2026-10-01', projectedPrice: 9331, grossRevenue: 181958010, gst: 9.09, commUpfront: 1.5, commBackend: 1.5 },
  { id: 2, type: 'Retail - BTS', stage: 1, nsa: 2600, units: 30, salePrice: 15898, growthRate: 3.5, launchDate: '2026-10-01', projectedPrice: 16454, grossRevenue: 42781518, gst: 9.09, commUpfront: 1.75, commBackend: 0.25 },
  { id: 3, type: 'Land - BTS', stage: 0, nsa: 0, units: 0, salePrice: 1960, growthRate: 'CPI', launchDate: '', projectedPrice: 1960, grossRevenue: 0, gst: 9.09, commUpfront: 0, commBackend: 0 },
];

// ============================================================================
// Grid B: Holding Revenue Details
// ============================================================================

interface HoldingRow {
  id: number;
  parentId: number | null;
  type: string;
  description: string;
  input: number;
  amount: number;
  start: string;
  end: string;
  variance: number;
  [key: string]: string | number | null;
}

const holdingData: HoldingRow[] = [
  // Gross Rent (parent)
  { id: 1, parentId: null, type: 'Gross Rental Revenue', description: '', input: 0, amount: 8400000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 2, parentId: 1, type: '', description: 'Residential', input: 520, amount: 4264000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 710667, m_2026_02: 710667, m_2026_03: 710667, m_2026_04: 710667, m_2026_05: 710667, m_2026_06: 710665 },
  { id: 3, parentId: 1, type: '', description: 'Commercial', input: 650, amount: 2080000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 346667, m_2026_02: 346667, m_2026_03: 346667, m_2026_04: 346667, m_2026_05: 346667, m_2026_06: 346665 },
  { id: 4, parentId: 1, type: '', description: 'Retail', input: 850, amount: 1275000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 212500, m_2026_02: 212500, m_2026_03: 212500, m_2026_04: 212500, m_2026_05: 212500, m_2026_06: 212500 },
  { id: 5, parentId: 1, type: '', description: 'Parking', input: 250, amount: 781000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 130167, m_2026_02: 130167, m_2026_03: 130167, m_2026_04: 130167, m_2026_05: 130167, m_2026_06: 130165 },

  // Less Outgoings (parent)
  { id: 6, parentId: null, type: 'Less: Outgoings', description: '', input: 0, amount: -1260000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 7, parentId: 6, type: '', description: 'Property Management', input: 0, amount: -504000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -84000, m_2026_02: -84000, m_2026_03: -84000, m_2026_04: -84000, m_2026_05: -84000, m_2026_06: -84000 },
  { id: 8, parentId: 6, type: '', description: 'Maintenance & Repairs', input: 0, amount: -378000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -63000, m_2026_02: -63000, m_2026_03: -63000, m_2026_04: -63000, m_2026_05: -63000, m_2026_06: -63000 },
  { id: 9, parentId: 6, type: '', description: 'Insurance & Rates', input: 0, amount: -378000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -63000, m_2026_02: -63000, m_2026_03: -63000, m_2026_04: -63000, m_2026_05: -63000, m_2026_06: -63000 },

  // Incentive (parent)
  { id: 10, parentId: null, type: 'Less: Incentives', description: '', input: 0, amount: -420000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 11, parentId: 10, type: '', description: 'Leasing Incentive (5%)', input: 5, amount: -420000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -70000, m_2026_02: -70000, m_2026_03: -70000, m_2026_04: -70000, m_2026_05: -70000, m_2026_06: -70000 },

  // Net (parent - summary)
  { id: 12, parentId: null, type: 'Net Rental Revenue', description: '', input: 0, amount: 6720000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
];

// Monthly column definitions for Jan-Jun 2028
const holdingMonths = [
  { key: 'm_2026_01', label: 'Jan 26' },
  { key: 'm_2026_02', label: 'Feb 26' },
  { key: 'm_2026_03', label: 'Mar 26' },
  { key: 'm_2026_04', label: 'Apr 26' },
  { key: 'm_2026_05', label: 'May 26' },
  { key: 'm_2026_06', label: 'Jun 28' },
];

export function FsbtRevenue() {
  // ════════════════════════════════════════════════════════════════════════════
  // BTS Grid Setup
  // ════════════════════════════════════════════════════════════════════════════

  const btsColumns = useMemo<ColumnDef<BtsRow>[]>(
    () => [
      { id: 'type', accessorKey: 'type', header: 'Type', width: 170, align: 'left' as const, sortable: true },
      { id: 'stage', accessorKey: 'stage', header: 'Stage', width: 105, align: 'center' as const },
      { id: 'nsa', accessorKey: 'nsa', header: 'NSA (m2)', width: 105, align: 'center' as const },
      { id: 'units', accessorKey: 'units', header: 'Unit/Lot/Tenancy', width: 105, align: 'center' as const },
      { id: 'salePrice', accessorKey: 'salePrice', header: 'Current Sale Price ($/m2)', width: 190, align: 'center' as const, editable: true },
      { id: 'growthRate', accessorKey: 'growthRate', header: 'Growth Rate', width: 190, align: 'center' as const, editable: true },
      { id: 'launchDate', accessorKey: 'launchDate', header: 'Sales Launch Date', width: 190, cellType: 'date' as const, dateFormat: 'month-year' as const, align: 'center' as const },
      {
        id: 'projectedPrice',
        accessorKey: 'projectedPrice',
        header: 'Projected Sale Price ($/m2)',
        width: 190,
        align: 'center' as const,
        cellStyle: () => ({ background: '#f5f5f5' }),
      },
      {
        id: 'grossRevenue',
        accessorKey: 'grossRevenue',
        header: 'Gross Revenue',
        width: 105,
        cellType: 'currency' as const,
        precision: 0,
        align: 'center' as const,
      },
      { id: 'gst', accessorKey: 'gst', header: 'GST (%)', width: 120, align: 'center' as const },
      { id: 'commUpfront', accessorKey: 'commUpfront', header: 'Sales Commission - Upfront (%)', width: 230, align: 'center' as const, editable: true },
      { id: 'commBackend', accessorKey: 'commBackend', header: 'Sales Commission - Back End (%)', width: 230, align: 'center' as const, editable: true },
    ],
    [],
  );

  const btsTotalsRow = useMemo<BtsRow>(() => ({
    id: -1,
    type: 'Total',
    stage: 0,
    nsa: btsData.reduce((s, r) => s + r.nsa, 0),
    units: btsData.reduce((s, r) => s + r.units, 0),
    salePrice: 0,
    growthRate: 0,
    launchDate: '',
    projectedPrice: 0,
    grossRevenue: btsData.reduce((s, r) => s + r.grossRevenue, 0),
    gst: 0,
    commUpfront: 0,
    commBackend: 0,
  }), []);

  const btsPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD' }),
      editing({ editTrigger: 'dblclick' }),
      sorting(),
      cellRenderers(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-bts' }),
    ],
    [],
  );

  const { grid: btsGrid, containerRef: btsRef } = useGrid<BtsRow>({
    data: btsData,
    columns: btsColumns,
    plugins: btsPlugins,
    pinnedBottomRows: [btsTotalsRow],
    selection: { mode: 'range' as const, fillHandle: true },
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    pinnedBottomRowHeight: FSBT_STYLES.rowHeight,
    tableStyle: 'striped' as const,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Holding Revenue Grid Setup
  // ════════════════════════════════════════════════════════════════════════════

  const holdingColumns = useMemo<ColumnDef<HoldingRow>[]>(
    () => [
      { id: 'type', accessorKey: 'type', header: 'Type', width: 200, align: 'left' as const, cellStyle: parentRowCellStyleIndented },
      { id: 'description', accessorKey: 'description', header: 'Description', width: 80, align: 'center' as const, cellStyle: parentRowCellStyle },
      { id: 'input', accessorKey: 'input', header: 'Input', width: 100, cellType: 'currency' as const, precision: 0, align: 'center' as const, hideZero: true, cellStyle: parentRowCellStyle },
      {
        id: 'amount',
        accessorKey: 'amount',
        header: 'Amount',
        width: 100,
        cellType: 'currency' as const,
        precision: 0,
        align: 'center' as const,
        cellStyle: (v: unknown, row: unknown) => {
          const base = parentRowCellStyle(v, row) ?? {};
          if (typeof v === 'number' && v < 0) return { ...base, color: '#dc2626' };
          return base;
        },
      },
      { id: 'start', accessorKey: 'start', header: 'Start', width: 80, cellType: 'date' as const, dateFormat: 'month-year' as const, align: 'center' as const, cellStyle: parentRowCellStyle },
      { id: 'end', accessorKey: 'end', header: 'End', width: 80, cellType: 'date' as const, dateFormat: 'month-year' as const, align: 'center' as const, cellStyle: parentRowCellStyle },
      { id: 'variance', accessorKey: 'variance', header: 'Variance', width: 80, align: 'center' as const, cellStyle: parentRowCellStyle },
      { id: 'varianceStatus', accessorKey: 'varianceStatus' as keyof HoldingRow, header: '', width: 44, align: 'center' as const, cellStyle: parentRowCellStyle },
      ...holdingMonths.map(m => ({
        id: m.key,
        accessorKey: m.key,
        header: m.label,
        width: 100,
        cellType: 'currency' as const,
        precision: 0,
        hideZero: true,
        cellStyle: (v: unknown, row: unknown) => {
          const base = parentRowCellStyle(v, row) ?? {};
          if (typeof v === 'number' && v < 0) return { ...base, color: '#dc2626' };
          return base;
        },
      })),
    ],
    [],
  );

  const holdingPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick', precision: 0 }),
      hierarchy({ indentColumn: 'type', indentSize: 22 }),
      cellRenderers(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-holding' }),
    ],
    [],
  );

  const { grid: holdingGrid, containerRef: holdingRef } = useGrid<HoldingRow>({
    data: holdingData,
    columns: holdingColumns,
    plugins: holdingPlugins,
    frozenLeftColumns: 8,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    hierarchy: {
      getRowId: (row: HoldingRow) => row.id,
      getParentId: (row: HoldingRow) => row.parentId,
      defaultExpanded: true,
    },
    selection: { mode: 'range' as const },
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Action Handlers
  // ════════════════════════════════════════════════════════════════════════════

  const handleBtsUndo = useCallback(() => btsGrid.plugins.undoRedo?.undo(), [btsGrid]);
  const handleBtsRedo = useCallback(() => btsGrid.plugins.undoRedo?.redo(), [btsGrid]);
  const handleBtsCsv = useCallback(() => btsGrid.plugins.export?.exportToCsv(), [btsGrid]);
  const handleBtsExcel = useCallback(() => btsGrid.plugins.export?.exportToExcel(), [btsGrid]);

  const handleHoldingExpandAll = useCallback(() => holdingGrid.expandAll(), [holdingGrid]);
  const handleHoldingCollapseAll = useCallback(() => holdingGrid.collapseAll(), [holdingGrid]);
  const handleHoldingUndo = useCallback(() => holdingGrid.plugins.undoRedo?.undo(), [holdingGrid]);
  const handleHoldingRedo = useCallback(() => holdingGrid.plugins.undoRedo?.redo(), [holdingGrid]);
  const handleHoldingCsv = useCallback(() => holdingGrid.plugins.export?.exportToCsv(), [holdingGrid]);
  const handleHoldingExcel = useCallback(() => holdingGrid.plugins.export?.exportToExcel(), [holdingGrid]);

  const btnStyle = { padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 } as const;

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>FSBT Revenue</h1>
      <p style={{ margin: '8px 0 0', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Revenue analysis for Build-to-Sell and Holding (rental) scenarios. BTS covers sale projections with growth rates and commissions; Holding covers monthly rental income, outgoings, and incentives.
      </p>

      {/* BTS Section */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Build-to-Sell (BTS)</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleBtsUndo} style={btnStyle}>Undo</button>
            <button onClick={handleBtsRedo} style={btnStyle}>Redo</button>
            <button onClick={handleBtsCsv} style={btnStyle}>CSV</button>
            <button onClick={handleBtsExcel} style={btnStyle}>Excel</button>
          </div>
        </div>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
          Plugins: formatting, editing, sorting, cellRenderers, clipboard, undoRedo, export
        </div>
        <div
          ref={btsRef}
          style={{
            height: 300,
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            
            borderRadius: 12,
          }}
        />
      </div>

      {/* Holding Revenue Section */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Holding Revenue (Rental)</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleHoldingExpandAll} style={btnStyle}>Expand All</button>
            <button onClick={handleHoldingCollapseAll} style={btnStyle}>Collapse All</button>
            <button onClick={handleHoldingUndo} style={btnStyle}>Undo</button>
            <button onClick={handleHoldingRedo} style={btnStyle}>Redo</button>
            <button onClick={handleHoldingCsv} style={btnStyle}>CSV</button>
            <button onClick={handleHoldingExcel} style={btnStyle}>Excel</button>
          </div>
        </div>
        <div
          ref={holdingRef}
          style={{
            height: 400,
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            
            borderRadius: 12,
          }}
        />
      </div>
    </div>
  );
}
