import { useMemo } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, clipboard, cellRenderers, validation } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface DataRow {
  id: number;
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  growth: number;
}

const data: DataRow[] = [
  { id: 1, month: 'January', revenue: 100000, cost: 62000, profit: 38000, growth: 0.00 },
  { id: 2, month: 'February', revenue: 110000, cost: 65000, profit: 45000, growth: 0.10 },
  { id: 3, month: 'March', revenue: 120000, cost: 68000, profit: 52000, growth: 0.09 },
  { id: 4, month: 'April', revenue: 130000, cost: 72000, profit: 58000, growth: 0.08 },
  { id: 5, month: 'May', revenue: 140000, cost: 75000, profit: 65000, growth: 0.08 },
  { id: 6, month: 'June', revenue: 150000, cost: 79000, profit: 71000, growth: 0.07 },
  { id: 7, month: 'July', revenue: 160000, cost: 83000, profit: 77000, growth: 0.07 },
  { id: 8, month: 'August', revenue: 170000, cost: 88000, profit: 82000, growth: 0.06 },
  { id: 9, month: 'September', revenue: 180000, cost: 92000, profit: 88000, growth: 0.06 },
  { id: 10, month: 'October', revenue: 190000, cost: 97000, profit: 93000, growth: 0.06 },
];

export function ClipboardFill() {
  const columns = useMemo<ColumnDef<DataRow>[]>(
    () => [
      { id: 'month', header: 'Month', width: 120, editable: true, sortable: true },
      { id: 'revenue', header: 'Revenue', width: 130, cellType: 'currency', editable: true },
      { id: 'cost', header: 'Cost', width: 130, cellType: 'currency', editable: true },
      { id: 'profit', header: 'Profit', width: 130, cellType: 'currency', editable: true },
      { id: 'growth', header: 'Growth', width: 110, cellType: 'percent', editable: true },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      cellRenderers(),
      editing({ editTrigger: 'dblclick', editorMode: 'inline' }),
      validation({ validateOn: 'commit' }),
      clipboard(),
    ],
    [],
  );

  const { containerRef } = useGrid<DataRow>({
    data,
    columns,
    plugins,
    rowHeight: 36,
    selection: { mode: 'range' },
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Clipboard & Fill Handle</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Copy, paste, fill-down, and fill-series. Select a range of revenue cells (100K&ndash;120K),
        then drag the fill handle down to auto-continue the series.
      </p>

      <div style={{
        marginBottom: 16, padding: 12, background: '#f8f9fa', borderRadius: 8,
        border: '1px solid #e0e0e0', fontSize: 13, color: '#555', lineHeight: 1.8,
      }}>
        <strong style={{ color: '#333' }}>Keyboard Shortcuts</strong>
        <br />
        <strong>Clipboard:</strong> Select cells &rarr; <code>Ctrl+C</code> copy, <code>Ctrl+V</code> paste, <code>Ctrl+X</code> cut
        <br />
        <strong>Fill Down:</strong> Select range &rarr; <code>Ctrl+D</code> fills first row&apos;s values down
        <br />
        <strong>Fill Series:</strong> Select range &rarr; <code>Ctrl+Shift+D</code> detects number patterns and continues
        <br />
        <strong>Fill Handle:</strong> Drag the blue square at bottom-right of selection to fill
      </div>

      <div
        ref={containerRef}
        style={{
          height: 420,
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
