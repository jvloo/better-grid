import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, cellRenderers, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface FundingRow {
  id: number;
  equityItem: string;
  amount: number;
  [key: string]: string | number | null;
}

const data: FundingRow[] = [
  { id: 1, equityItem: 'Opening Balance', amount: 0 },
  { id: 2, equityItem: 'Cash Equity Injection', amount: 48500000, m_2025_07: 42000000, m_2026_04: 2000000, m_2026_07: 2000000, m_2027_01: 1500000, m_2027_07: 1000000 },
  { id: 3, equityItem: 'Non - Project Cost Equity Contribution', amount: 1200000, m_2025_07: 600000, m_2026_01: 300000, m_2026_07: 300000 },
  { id: 4, equityItem: 'Equity Repatriation', amount: -15000000, m_2028_01: -5000000, m_2028_02: -5000000, m_2028_03: -5000000 },
  { id: 5, equityItem: 'Return Capital', amount: -34700000, m_2028_04: -11566667, m_2028_05: -11566667, m_2028_06: -11566666 },
  { id: 6, equityItem: 'Manual Input', amount: 0 },
  { id: 7, equityItem: 'Closing Balance', amount: 0 },
  { id: 8, equityItem: 'Profit release', amount: 0 },
  { id: 9, equityItem: 'Cashflow', amount: 0 },
];

const highlightedRows = new Set(['Profit release', 'Cashflow']);

const months: { key: string; label: string }[] = [];
for (let i = 0; i < 36; i++) {
  const d = new Date(2025, 6 + i);
  const key = `m_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('en-AU', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  months.push({ key, label });
}

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
      ...months.map(m => ({
        id: m.key,
        accessorKey: m.key,
        header: m.label,
        width: 85,
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

  const handleUndo = useCallback(() => {
    const api = grid.getPlugin<{ undo: () => void }>('undoRedo');
    api?.undo();
  }, [grid]);
  const handleRedo = useCallback(() => {
    const api = grid.getPlugin<{ redo: () => void }>('undoRedo');
    api?.redo();
  }, [grid]);
  const handleExportCsv = useCallback(() => {
    grid.getPlugin<{ exportToCsv: () => void }>('export')?.exportToCsv();
  }, [grid]);
  const handleExportExcel = useCallback(() => {
    grid.getPlugin<{ exportToExcel: () => void }>('export')?.exportToExcel();
  }, [grid]);

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
        Equity Peak: $52,400,000
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
