import { useMemo } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, sorting, cellRenderers } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface SampleRow {
  id: number;
  name: string;
  department: string;
  amount: number;
  status: string;
}

const data: SampleRow[] = [
  { id: 1, name: 'Alice Chen', department: 'Engineering', amount: 125000, status: 'Active' },
  { id: 2, name: 'Bob Martinez', department: 'Design', amount: 98000, status: 'Active' },
  { id: 3, name: 'Carol Williams', department: 'Marketing', amount: 112000, status: 'On Leave' },
  { id: 4, name: 'David Kim', department: 'Engineering', amount: 135000, status: 'Active' },
  { id: 5, name: 'Eva Nguyen', department: 'Sales', amount: 105000, status: 'Active' },
  { id: 6, name: 'Frank Johnson', department: 'Design', amount: 92000, status: 'Inactive' },
];

const columns: ColumnDef<SampleRow>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name', width: 160 },
  { id: 'department', accessorKey: 'department', header: 'Department', width: 130 },
  { id: 'amount', accessorKey: 'amount', header: 'Salary', width: 120, cellType: 'currency', align: 'right' },
  { id: 'status', accessorKey: 'status', header: 'Status', width: 100 },
];

const plugins = [
  formatting({ locale: 'en-AU', currencyCode: 'AUD' }),
  editing({ editTrigger: 'dblclick' }),
  sorting(),
  cellRenderers(),
];

type TableStyle = 'bordered' | 'borderless' | 'striped';

function StyleGrid({ style, label }: { style?: TableStyle; label: string }) {
  const { containerRef } = useGrid<SampleRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 1,
    rowHeight: 36,
    tableStyle: style,
    selection: { mode: 'cell' as const },
  });

  return (
    <div>
      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{label}</h3>
      <div
        ref={containerRef}
        style={{ height: 280, width: '100%', borderRadius: 8, overflow: 'hidden' }}
      />
    </div>
  );
}

function StripedNoBg() {
  const { containerRef } = useGrid<SampleRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 1,
    rowHeight: 36,
    tableStyle: 'striped',
    selection: { mode: 'cell' as const },
  });

  return (
    <div>
      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>
        Striped (no bg) <code style={{ fontSize: 11, color: '#888' }}>--bg-stripe-bg: #fff</code>
      </h3>
      <div
        ref={containerRef}
        style={{
          height: 280,
          width: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          // @ts-expect-error CSS custom property
          '--bg-stripe-bg': '#fff',
        }}
      />
    </div>
  );
}

export function TableStyles() {
  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600 }}>Table Styles</h1>
      <p style={{ margin: '0 0 24px', color: '#666', fontSize: 13 }}>
        Four table style variants via the <code>tableStyle</code> prop. Stripe color customizable with <code>--bg-stripe-bg</code>.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <StyleGrid label="Bordered (default)" />
        <StyleGrid style="borderless" label="Borderless" />
        <StyleGrid style="striped" label="Striped" />
        <StripedNoBg />
      </div>
    </div>
  );
}
