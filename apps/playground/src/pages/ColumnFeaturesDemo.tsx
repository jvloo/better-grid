import { useState } from 'react';
import { BetterGrid, useGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface Row { id: number; name: string; qty: number; rate: number; status: string }

const columns: ColumnDef<Row>[] = [
  col.text('id', { headerName: 'ID', width: 60, hide: true }),                           // hidden by default
  col.text('name', { headerName: 'Name', width: 180, flex: 2, headerAlign: 'left' }),    // flex grow
  col.number('qty', { headerName: 'Qty', width: 80, align: 'right', headerAlign: 'right' }),
  col.percent('rate', { headerName: 'Rate', width: 100, align: 'right' }),
  col.text('status', {
    headerName: 'Status',
    width: 120,
    headerRenderer: (container) => {                                                     // custom DOM header
      const span = document.createElement('span');
      span.textContent = '⚙ Status';
      span.style.cssText = 'font-weight:700;color:#065986';
      container.replaceChildren(span);
    },
  }),
];

const seed: Row[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  qty: (i + 1) * 10,
  rate: (i + 1) * 0.01,
  status: i % 2 === 0 ? 'open' : 'closed',
}));

export function ColumnFeaturesDemo() {
  const [data] = useState(seed);
  const grid = useGrid<Row>({
    columns,
    data,
    mode: 'view',
    selection: { mode: 'cell' },
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Column features: hide / flex / headerAlign / headerRenderer</h1>
      <p style={{ marginBottom: 12, color: '#666', lineHeight: 1.5 }}>
        ID column is hidden via <code>hide: true</code>. Name column is <code>flex: 2</code>. Qty/Rate are <code>align: 'right'</code>.
        Status uses a custom <code>headerRenderer</code> (DOM mutator).
      </p>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => grid.api.setColumnHidden('id', false)}>Show ID</button>
        <button onClick={() => grid.api.setColumnHidden('id', true)}>Hide ID</button>
      </div>
      <BetterGrid grid={grid} height={500} />
    </div>
  );
}
