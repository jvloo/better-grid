import { useState } from 'react';
import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface CostRow {
  id: number;
  item: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  notes: string;
}

const initial: CostRow[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  item: `Line item ${i + 1}`,
  qty: (i + 1) * 10,
  unitCost: Math.round((i + 1) * 123.45 * 100) / 100,
  totalCost: 0,
  notes: '',
}));
initial.forEach((r) => { r.totalCost = r.qty * r.unitCost; });

const columns = [
  col.text('item', { header: 'Item', width: 180 }),
  col.number('qty', {
    header: 'Qty',
    width: 100,
    align: 'right',
    alwaysInput: true,
    precision: 0,
  }),
  col.currency('unitCost', {
    header: 'Unit Cost',
    width: 140,
    align: 'right',
    alwaysInput: true,
    precision: 2,
  }),
  col.currency('totalCost', {
    header: 'Total',
    width: 160,
    align: 'right',
    editable: false,
    valueFormatter: (v: unknown) => typeof v === 'number'
      ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '',
  }),
  col.text('notes', {
    header: 'Notes',
    width: 220,
    alwaysInput: (row) => (row as CostRow).qty > 50,
    placeholder: 'Add a note…',
  }),
] as ColumnDef<CostRow>[];

export function AlwaysInputDemo() {
  const [data, setData] = useState(initial);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Always-Input Cells</h1>
      <p style={{ marginBottom: 12, color: '#666', lineHeight: 1.5 }}>
        Per-column <code>alwaysInput</code> renders a real <code>&lt;input&gt;</code> permanently in
        every visible cell — no double-click required. Wiseway parity for finance sheets.
      </p>
      <ul style={{ marginBottom: 16, color: '#666', fontSize: 13, lineHeight: 1.7 }}>
        <li><strong>Qty</strong> &amp; <strong>Unit Cost</strong>: <code>alwaysInput: true</code> on every row.</li>
        <li><strong>Notes</strong>: <code>alwaysInput: (row) =&gt; row.qty &gt; 50</code> — only rows with qty &gt; 50 get the live input.</li>
        <li><strong>Total</strong>: derived (computed on commit), not editable.</li>
      </ul>

      <BetterGrid<CostRow>
        columns={columns}
        data={data}
        mode="view"
        features={{
          format: { locale: 'en-US', currencyCode: 'USD' },
          edit: { editTrigger: 'dblclick' },
        }}
        selection={{ mode: 'range', fillHandle: false }}
        onCellChange={(changes) => {
          setData((prev) => {
            const next = [...prev];
            for (const change of changes) {
              const row = { ...(change.row as CostRow) };
              row.totalCost = row.qty * row.unitCost;
              next[change.rowIndex] = row;
            }
            return next;
          });
        }}
        height={460}
      />

      <p style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
        Open the console to see the perf-gate warning if cell count exceeds the threshold
        (configurable via <code>features.edit.alwaysInputThreshold</code>, default 1000).
      </p>
    </div>
  );
}
