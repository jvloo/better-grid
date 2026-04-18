import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, editing, cellRenderers, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface FundingRow {
  id: number;
  equityItem: string;
  amount: number;
  [key: string]: string | number | null;
}

// Data from QA app project 4288: https://qa-app.wiseway.ai/projects/4288/funding
// Equity Peak: $22,809,333 | Cashflow: -$5,241,240
const data: FundingRow[] = [
  { id: 1, equityItem: 'Opening Balance', amount: 0 },
  { id: 2, equityItem: 'Cash Equity Injection', amount: 22185537, m_2023_08: 3104106, m_2023_09: 374106, m_2023_10: 374106, m_2023_11: 374106, m_2023_12: 236606, m_2024_01: 8724507 },
  { id: 3, equityItem: 'Non - Project Cost Equity Contribution', amount: 3767202, m_2024_02: 239637, m_2024_03: 415299, m_2024_04: 239637 },
  { id: 4, equityItem: 'Equity Repatriation', amount: -2284701 },
  { id: 5, equityItem: 'Return Capital', amount: -18426798 },
  { id: 6, equityItem: 'Manual Input', amount: 0 },
  { id: 7, equityItem: 'Closing Balance', amount: 0 },
  { id: 8, equityItem: 'Profit release', amount: 0 },
  { id: 9, equityItem: 'Cashflow', amount: -5241240 },
];

const highlightedRows = new Set(['Profit release', 'Cashflow']);

// Monthly columns: Aug 2023 – Oct 2026 (39 months)
const ts = timeSeries({
  start: '2023-08-01',
  end: '2026-10-01',
  locale: 'en-AU',
  columnWidth: 85,
});

const valueCellStyle = (v: unknown, row: FundingRow) => {
  const base: Record<string, string> = {};
  if (highlightedRows.has(row.equityItem)) {
    base.fontWeight = '700';
    base.background = '#f0f4ff';
  }
  if (typeof v === 'number' && v !== 0) {
    base.color = v < 0 ? '#dc2626' : '#16a34a';
  }
  return Object.keys(base).length > 0 ? base : undefined;
};

export function FsbtFunding() {
  const columns = useMemo<ColumnDef<FundingRow>[]>(
    () => [
      {
        id: 'equityItem',
        accessorKey: 'equityItem',
        header: 'Equity',
        width: 460,
        cellStyle: (_v: unknown, row: FundingRow) => {
          if (highlightedRows.has(row.equityItem)) {
            return { fontWeight: '700', background: '#f0f4ff' };
          }
          return undefined;
        },
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        header: 'Amount',
        width: 150,
        cellType: 'currency' as const,
        precision: 0,
        align: 'right' as const,
        cellStyle: valueCellStyle,
      },
      ...ts.columns.map(c => ({
        ...c,
        cellType: 'currency' as const,
        precision: 0,
        hideZero: true,
        align: 'center' as const,
        editable: true,
        cellStyle: valueCellStyle,
      })),
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick', precision: 0 }),
      cellRenderers(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-funding' }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<FundingRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 2,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    selection: { mode: 'range' as const },
    headerHeight: 44,
    rowHeight: 44,
  });

  const handleUndo = useCallback(() => grid.plugins.undoRedo?.undo(), [grid]);
  const handleRedo = useCallback(() => grid.plugins.undoRedo?.redo(), [grid]);
  const handleExportCsv = useCallback(() => grid.plugins.export?.exportToCsv(), [grid]);
  const handleExportExcel = useCallback(() => grid.plugins.export?.exportToExcel(), [grid]);

  const btnStyle = { padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 } as const;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>FSBT Funding</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleUndo} style={btnStyle}>Undo</button>
          <button onClick={handleRedo} style={btnStyle}>Redo</button>
          <button onClick={handleExportCsv} style={btnStyle}>CSV</button>
          <button onClick={handleExportExcel} style={btnStyle}>Excel</button>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Equity structure with monthly drawdown, repatriation, and capital return schedules.
      </p>
      <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#1e3a5f' }}>
        Equity Peak: $22,809,333
      </div>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, cellRenderers, clipboard, undoRedo, export &bull;
        <strong> Core:</strong> frozenLeftColumns, selection
      </div>
      <div
        ref={containerRef}
        style={{
          height: 520,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          
          borderRadius: 12,
        }}
      />
    </div>
  );
}
