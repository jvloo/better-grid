import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface SampleRow {
  id: number;
  name: string;
  category: string;
  amount: number;
  date: string;
  active: boolean;
}

const sampleData: SampleRow[] = [
  { id: 1, name: 'Project Alpha', category: 'Revenue', amount: 125000, date: '2026-01-15', active: true },
  { id: 2, name: 'Project Beta', category: 'Cost', amount: -45000, date: '2026-02-01', active: true },
  { id: 3, name: 'Project Gamma', category: 'Revenue', amount: 89000, date: '2026-03-10', active: false },
  { id: 4, name: 'Project Delta', category: 'Cost', amount: -23000, date: '2026-04-22', active: true },
  { id: 5, name: 'Project Epsilon', category: 'Revenue', amount: 210000, date: '2026-05-05', active: true },
  { id: 6, name: 'Project Zeta', category: 'Cost', amount: -67000, date: '2026-06-18', active: false },
  { id: 7, name: 'Project Eta', category: 'Revenue', amount: 340000, date: '2026-07-01', active: true },
  { id: 8, name: 'Project Theta', category: 'Cost', amount: -12000, date: '2026-08-15', active: true },
  { id: 9, name: 'Project Iota', category: 'Revenue', amount: 56000, date: '2026-09-20', active: false },
  { id: 10, name: 'Project Kappa', category: 'Cost', amount: -98000, date: '2026-10-30', active: true },
];

export function CoreOnly() {
  const columns = useMemo<ColumnDef<SampleRow>[]>(
    () => [
      { id: 'id', header: 'ID', width: 60 },
      { id: 'name', header: 'Name', width: 200 },
      { id: 'category', header: 'Category', width: 120 },
      { id: 'amount', header: 'Amount', width: 150 },
      { id: 'date', header: 'Date', width: 150 },
      { id: 'active', header: 'Active', width: 80 },
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Core Only — No Plugins</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Zero plugins. This is what the core engine provides out of the box.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>What you get:</strong> Virtual scrolling &bull; Frozen columns &bull;
        Cell selection (click) &bull; Range selection (Shift+click/arrows) &bull;
        Keyboard navigation (Arrow/Tab/Enter/Escape) &bull; Column resizing (drag header border) &bull;
        CSS theming (--bg-* custom properties)
        <br />
        <strong>What you don't get:</strong> No formatting (raw values) &bull; No editing &bull;
        No sorting &bull; No filtering &bull; No validation &bull; No context menu
      </div>
      <BetterGrid<SampleRow>
        columns={columns}
        data={sampleData}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        height={440}
      />
    </div>
  );
}
