import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, sorting, filtering, validation } from '@better-grid/plugins';
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
      { id: 'id', header: '#', width: 40, editable: false, sortable: true},
      { id: 'name', header: 'Name', width: 150, required: true, sortable: true },
      {
        id: 'category',
        header: 'Category',
        width: 100,
        options: ['Revenue', 'Cost', 'Expense', 'Other'],
        sortable: true,
      },
      {
        id: 'amount',
        header: 'Amount',
        width: 130,
        cellType: 'currency',
        sortable: true,
        rules: [{ validate: (v) => typeof v === 'number' || 'Must be a number' }],
      },
      { id: 'date', header: 'Date', width: 120, cellType: 'date', sortable: true },
      {
        id: 'active',
        header: 'Active',
        width: 80,
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? 'Yes' : 'No';
          container.style.color = ctx.value ? '#2e7d32' : '#c62828';
          container.style.textAlign = 'center';
        },
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }),
      editing({ editTrigger: 'dblclick' }),
      sorting(),
      filtering(),
      validation({ validateOn: 'commit' }),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Free Plugins — All 5 Active</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        All free plugins enabled: formatting, editing, sorting, filtering, validation.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Try:</strong> Double-click to edit &bull; Click header to sort &bull;
        Right-click header for sort/filter menu &bull; Category has dropdown &bull;
        Active has Yes/No toggle &bull; Name is required (clear it to see error) &bull;
        Amount validates as number
      </div>
      <BetterGrid<SampleRow>
        columns={columns}
        data={sampleData}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={440}
      />
    </div>
  );
}
