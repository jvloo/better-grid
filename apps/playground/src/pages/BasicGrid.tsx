import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing } from '@better-grid/plugins';
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

export function BasicGrid() {
  const columns = useMemo<ColumnDef<SampleRow>[]>(
    () => [
      { id: 'id', accessorKey: 'id', header: 'ID', width: 60 },
      { id: 'name', accessorKey: 'name', header: 'Name', width: 200 },
      { id: 'category', accessorKey: 'category', header: 'Category', width: 120 },
      { id: 'amount', accessorKey: 'amount', header: 'Amount', width: 150, cellType: 'currency' },
      { id: 'date', accessorKey: 'date', header: 'Date', width: 150, cellType: 'date' },
      {
        id: 'active',
        accessorKey: 'active',
        header: 'Active',
        width: 80,
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? 'Yes' : 'No';
          container.style.color = ctx.value ? '#2e7d32' : '#c62828';
        },
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick' }),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Basic Grid</h1>
      <p style={{ marginBottom: 16, color: '#666' }}>
        Formatting + editing plugins. Click to select, arrow keys to navigate, double-click or Enter to edit.
      </p>
      <BetterGrid<SampleRow>
        columns={columns}
        data={sampleData}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={400}
      />
    </div>
  );
}
