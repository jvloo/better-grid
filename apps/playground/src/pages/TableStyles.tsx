import type React from 'react';
import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
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

const columns = [
  col.text('name', { headerName: 'Name', width: 160 }),
  col.text('department', { headerName: 'Department', width: 130 }),
  col.currency('amount', { headerName: 'Salary', width: 120 }),
  col.text('status', { headerName: 'Status', width: 100 }),
] as ColumnDef<SampleRow>[];

const SHARED_FEATURES = {
  format: { locale: 'en-AU', currencyCode: 'AUD' },
  edit: { editTrigger: 'dblclick' as const },
};

function StyleGrid({
  bordered,
  striped,
  label,
  stripeBg,
}: {
  bordered?: boolean;
  striped?: boolean;
  label: string;
  stripeBg?: string;
}) {
  return (
    <div>
      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{label}</h3>
      <BetterGrid<SampleRow>
        columns={columns}
        data={data}
        mode="view"
        features={SHARED_FEATURES}
        frozen={{ left: 1 }}
        rowHeight={36}
        bordered={bordered}
        striped={striped}
        selection={{ mode: 'cell' }}
        height={280}
        style={{
          borderRadius: 8,
          ...(stripeBg ? { '--bg-stripe-bg': stripeBg } as React.CSSProperties : {}),
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
        Table style variants via <code>bordered</code> and <code>striped</code> boolean props.
        Combine them freely. Stripe color customizable with <code>--bg-stripe-bg</code>.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <StyleGrid bordered={false} label="Plain (bordered=false, striped=false)" />
        <StyleGrid label="Bordered only (bordered=true, striped=false) — default" />
        <StyleGrid bordered={false} striped label="Striped only (bordered=false, striped=true)" />
        <StyleGrid striped label="Bordered + striped (bordered=true, striped=true)" />
        <StyleGrid striped stripeBg="#FEF3C7" label="Custom stripe color (--bg-stripe-bg: #FEF3C7)" />
      </div>
    </div>
  );
}
