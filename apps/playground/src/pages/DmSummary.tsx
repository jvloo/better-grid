import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, sorting, cellRenderers, clipboard, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface SummaryRow {
  id: number;
  type: 'title' | 'item' | 'accumulation';
  description: string;
  actualAmount: number;
  forecastAmount: number;
  totalAmount: number;
  [key: string]: string | number | null;
}

const data: SummaryRow[] = [
  // Project Margin section
  { id: 1, type: 'title', description: 'Project Margin', actualAmount: 0, forecastAmount: 0, totalAmount: 0 },
  { id: 2, type: 'item', description: 'Net Sales Revenue - BTS', actualAmount: -62500000, forecastAmount: -124710000, totalAmount: -187210000, m_2028_01: -31201667, m_2028_02: -31201667, m_2028_03: -31201667, m_2028_04: -31201667, m_2028_05: -31201667, m_2028_06: -31201665 },
  { id: 3, type: 'item', description: 'Net Rental Revenue', actualAmount: -4000000, forecastAmount: -8000000, totalAmount: -12000000, m_2028_01: -2000000, m_2028_02: -2000000, m_2028_03: -2000000, m_2028_04: -2000000, m_2028_05: -2000000, m_2028_06: -2000000 },
  { id: 4, type: 'item', description: 'Development Cost excl Finance', actualAmount: 42000000, forecastAmount: 2310000, totalAmount: 44310000, m_2025_07: 42810000, m_2025_08: 1500000 },
  { id: 5, type: 'item', description: 'Less: Construction Costs', actualAmount: 28000000, forecastAmount: 58530000, totalAmount: 86530000, m_2026_07: 2403611, m_2026_08: 2403611, m_2026_09: 2403611, m_2026_10: 2403611, m_2026_11: 2403611, m_2026_12: 2403611, m_2027_01: 4571111, m_2027_02: 4571111, m_2027_03: 6428968, m_2027_04: 6428968, m_2027_05: 8286468, m_2027_06: 8286468, m_2027_07: 8286468, m_2027_08: 5706468, m_2027_09: 5706468, m_2027_10: 5265278, m_2027_11: 1652778, m_2027_12: 1416666 },
  { id: 6, type: 'item', description: 'Less: Professional Fees', actualAmount: 3400000, forecastAmount: 5100000, totalAmount: 8500000, m_2025_10: 1122016, m_2025_11: 161905, m_2025_12: 161905, m_2026_01: 252778, m_2026_02: 252778, m_2026_03: 252778, m_2026_04: 536238, m_2026_05: 536238, m_2026_06: 536238, m_2026_07: 520794, m_2026_08: 509683, m_2026_09: 509683, m_2026_10: 509683, m_2026_11: 509683, m_2026_12: 509683, m_2027_01: 509683, m_2027_02: 509683, m_2027_03: 509683, m_2027_04: 509683, m_2027_05: 509683, m_2027_06: 509678, m_2027_07: 158333, m_2027_08: 47222, m_2027_09: 158333, m_2027_10: 158334, m_2027_11: 47222, m_2027_12: 47226 },
  { id: 7, type: 'item', description: 'Less: Statutory Costs', actualAmount: 4250000, forecastAmount: 850000, totalAmount: 5100000, m_2025_10: 850000, m_2025_12: 3400000, m_2026_04: 283333, m_2026_05: 283333, m_2026_06: 283334 },
  { id: 8, type: 'item', description: 'Less: Marketing', actualAmount: 0, forecastAmount: 3200000, totalAmount: 3200000, m_2027_04: 466667, m_2027_05: 466667, m_2027_06: 466666, m_2027_07: 200000, m_2027_08: 200000, m_2027_09: 200000, m_2027_10: 200000, m_2027_11: 200000, m_2027_12: 200000, m_2028_01: 200000, m_2028_02: 200000, m_2028_03: 200000 },
  { id: 9, type: 'item', description: 'Less: Contingency', actualAmount: 1200000, forecastAmount: 3060000, totalAmount: 4260000, m_2026_07: 236667, m_2026_08: 236667, m_2026_09: 236667, m_2026_10: 236667, m_2026_11: 236667, m_2026_12: 236667, m_2027_01: 236667, m_2027_02: 236667, m_2027_03: 236667, m_2027_04: 236667, m_2027_05: 236667, m_2027_06: 236667, m_2027_07: 236667, m_2027_08: 236667, m_2027_09: 236667, m_2027_10: 236667, m_2027_11: 236667, m_2027_12: 236661 },
  { id: 10, type: 'accumulation', description: 'Margin', actualAmount: 12450000, forecastAmount: -59660000, totalAmount: -47210000 },

  // Funding section
  { id: 11, type: 'title', description: 'Funding', actualAmount: 0, forecastAmount: 0, totalAmount: 0 },
  { id: 12, type: 'item', description: 'Senior Debt Drawdown', actualAmount: 30000000, forecastAmount: 38000000, totalAmount: 68000000, m_2026_07: 5000000, m_2026_08: 5000000, m_2026_09: 5000000, m_2026_10: 5000000, m_2026_11: 5000000, m_2026_12: 5000000, m_2027_01: 5000000, m_2027_02: 5000000, m_2027_03: 4000000, m_2027_04: 4000000, m_2027_05: 4000000, m_2027_06: 4000000, m_2027_07: 3000000, m_2027_08: 3000000, m_2027_09: 3000000, m_2027_10: 3000000 },
  { id: 13, type: 'item', description: 'Senior Debt Repayment', actualAmount: 0, forecastAmount: -68000000, totalAmount: -68000000, m_2027_11: -10000000, m_2027_12: -10000000, m_2028_01: -12000000, m_2028_02: -12000000, m_2028_03: -12000000, m_2028_04: -12000000 },
  { id: 14, type: 'item', description: 'Senior Interest Paid', actualAmount: -2125000, forecastAmount: -6035000, totalAmount: -8160000, m_2026_07: -283333, m_2026_08: -311667, m_2026_09: -340000, m_2026_10: -368333, m_2026_11: -396667, m_2026_12: -425000, m_2027_01: -453333, m_2027_02: -481667, m_2027_03: -504167, m_2027_04: -526667, m_2027_05: -549167, m_2027_06: -571667, m_2027_07: -588333, m_2027_08: -605000, m_2027_09: -621667, m_2027_10: -638333, m_2027_11: -495000 },
  { id: 15, type: 'item', description: 'Mezzanine Drawdown', actualAmount: 0, forecastAmount: 0, totalAmount: 0 },
  { id: 16, type: 'item', description: 'Mezzanine Repayment', actualAmount: 0, forecastAmount: 0, totalAmount: 0 },
  { id: 17, type: 'accumulation', description: 'Net Funding', actualAmount: 27875000, forecastAmount: -36035000, totalAmount: -8160000 },

  // Equity section
  { id: 18, type: 'title', description: 'Equity', actualAmount: 0, forecastAmount: 0, totalAmount: 0 },
  { id: 19, type: 'item', description: 'Equity Injection', actualAmount: 48500000, forecastAmount: 0, totalAmount: 48500000, m_2025_07: 42000000, m_2026_04: 2000000, m_2026_07: 2000000, m_2027_01: 1500000, m_2027_07: 1000000 },
  { id: 20, type: 'item', description: 'Equity Repatriation', actualAmount: 0, forecastAmount: -49700000, totalAmount: -49700000, m_2028_01: -5000000, m_2028_02: -5000000, m_2028_03: -5000000, m_2028_04: -11566667, m_2028_05: -11566667, m_2028_06: -11566666 },
  { id: 21, type: 'accumulation', description: 'Net Equity / Cashflow', actualAmount: 48500000, forecastAmount: -49700000, totalAmount: -1200000 },

  // Final
  { id: 22, type: 'title', description: '', actualAmount: 0, forecastAmount: 0, totalAmount: 0 },
  { id: 23, type: 'accumulation', description: 'Cumulative Cashflow', actualAmount: 88825000, forecastAmount: -145395000, totalAmount: -56570000 },
];

// 36 months: Jul 2025 – Jun 2028
const months: { key: string; label: string }[] = [];
for (let i = 0; i < 36; i++) {
  const d = new Date(2025, 6 + i);
  const key = `m_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('en-AU', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  months.push({ key, label });
}

// Shared cellStyle for row-type styling + negative value coloring
const rowStyleFn = (v: unknown, row: unknown) => {
  const r = row as SummaryRow;
  const style: Record<string, string> = {};
  if (r.type === 'title') { style.background = '#D0D5DD'; style.color = '#101828'; style.fontWeight = '700'; }
  else if (r.type === 'accumulation') { style.fontWeight = '700'; style.background = '#f0f0f0'; }
  if (typeof v === 'number' && v < 0) style.color = r.type === 'title' ? '#fff' : '#16a34a';
  return Object.keys(style).length > 0 ? style : undefined;
};

// Description column has its own style (no negative-value coloring on text)
const descriptionStyleFn = (v: unknown, row: unknown) => {
  const r = row as SummaryRow;
  if (r.type === 'title') return { fontWeight: '700', color: '#101828', background: '#D0D5DD' };
  if (r.type === 'accumulation') return { fontWeight: '700', background: '#f0f0f0' };
  return undefined;
};

export function DmSummary() {
  const columns = useMemo<ColumnDef<SummaryRow>[]>(
    () => [
      {
        id: 'description',
        accessorKey: 'description',
        header: 'Description',
        width: 500,
        cellStyle: descriptionStyleFn,
      },
      {
        id: 'actualAmount',
        accessorKey: 'actualAmount',
        header: 'Actual to Date',
        width: 150,
        cellType: 'currency' as const,
        precision: 0,
        align: 'center' as const,
        cellStyle: rowStyleFn,
        hideZero: true,
      },
      {
        id: 'forecastAmount',
        accessorKey: 'forecastAmount',
        header: 'Forecast to Go',
        width: 150,
        cellType: 'currency' as const,
        precision: 0,
        align: 'center' as const,
        cellStyle: rowStyleFn,
        hideZero: true,
      },
      {
        id: 'totalAmount',
        accessorKey: 'totalAmount',
        header: 'Total Amount',
        width: 150,
        cellType: 'currency' as const,
        precision: 0,
        align: 'center' as const,
        cellStyle: rowStyleFn,
        hideZero: true,
      },
      ...months.map(m => ({
        id: m.key,
        accessorKey: m.key,
        header: m.label,
        width: 90,
        cellType: 'currency' as const,
        precision: 0,
        hideZero: true,
        cellStyle: rowStyleFn,
      })),
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      sorting(),
      cellRenderers(),
      clipboard(),
      exportPlugin({ filename: 'dm-summary-cashflow' }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<SummaryRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 4,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    selection: { mode: 'range' as const },
    headerHeight: 44,
    rowHeight: 44,
  });

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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>DM Summary Cashflow</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleExportCsv} style={btnStyle}>CSV</button>
          <button onClick={handleExportExcel} style={btnStyle}>Excel</button>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Read-only cashflow summary with project margin, funding, and equity sections. Section headers and subtotals are visually grouped.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, sorting, cellRenderers, clipboard, export &bull;
        <strong> Core:</strong> frozenLeftColumns
      </div>
      <div
        ref={containerRef}
        style={{
          height: 640,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          
          borderRadius: 12,
        }}
      />
    </div>
  );
}
