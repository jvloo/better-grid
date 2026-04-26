import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface EmployeeRow {
  id: number;
  name: string;
  department: string;
  role: string;
  salary: number;
  experience: number;
  rating: number;
  location: string;
}

const data: EmployeeRow[] = [
  { id: 1, name: 'Alice Chen', department: 'Engineering', role: 'Senior', salary: 145000, experience: 8, rating: 4.8, location: 'New York' },
  { id: 2, name: 'Bob Martinez', department: 'Design', role: 'Lead', salary: 125000, experience: 10, rating: 4.5, location: 'San Francisco' },
  { id: 3, name: 'Carol Johnson', department: 'Engineering', role: 'Staff', salary: 175000, experience: 12, rating: 4.9, location: 'Remote' },
  { id: 4, name: 'David Kim', department: 'Marketing', role: 'Junior', salary: 72000, experience: 2, rating: 3.8, location: 'New York' },
  { id: 5, name: 'Emma Wilson', department: 'Engineering', role: 'Senior', salary: 155000, experience: 7, rating: 4.6, location: 'London' },
  { id: 6, name: 'Frank Lee', department: 'Sales', role: 'Lead', salary: 130000, experience: 9, rating: 4.2, location: 'Singapore' },
  { id: 7, name: 'Grace Park', department: 'Design', role: 'Senior', salary: 115000, experience: 6, rating: 4.7, location: 'San Francisco' },
  { id: 8, name: 'Henry Taylor', department: 'Marketing', role: 'Mid', salary: 88000, experience: 4, rating: 4.0, location: 'Remote' },
  { id: 9, name: 'Ivy Zhang', department: 'Engineering', role: 'Principal', salary: 195000, experience: 15, rating: 5.0, location: 'New York' },
  { id: 10, name: 'Jack Brown', department: 'Sales', role: 'Senior', salary: 118000, experience: 8, rating: 4.3, location: 'London' },
  { id: 11, name: 'Karen White', department: 'Engineering', role: 'Mid', salary: 120000, experience: 5, rating: 4.4, location: 'Remote' },
  { id: 12, name: 'Leo Garcia', department: 'Design', role: 'Junior', salary: 78000, experience: 1, rating: 3.5, location: 'San Francisco' },
  { id: 13, name: 'Mia Davis', department: 'Sales', role: 'Mid', salary: 95000, experience: 5, rating: 4.1, location: 'Singapore' },
  { id: 14, name: 'Noah Clark', department: 'Marketing', role: 'Senior', salary: 110000, experience: 7, rating: 4.5, location: 'New York' },
  { id: 15, name: 'Olivia Moore', department: 'Engineering', role: 'Senior', salary: 160000, experience: 9, rating: 4.7, location: 'London' },
  { id: 16, name: 'Peter Hall', department: 'Design', role: 'Mid', salary: 98000, experience: 4, rating: 4.2, location: 'Remote' },
  { id: 17, name: 'Quinn Adams', department: 'Sales', role: 'Junior', salary: 68000, experience: 1, rating: 3.6, location: 'New York' },
  { id: 18, name: 'Rachel Scott', department: 'Engineering', role: 'Lead', salary: 180000, experience: 11, rating: 4.8, location: 'San Francisco' },
  { id: 19, name: 'Sam Turner', department: 'Marketing', role: 'Lead', salary: 125000, experience: 8, rating: 4.6, location: 'London' },
  { id: 20, name: 'Tina Robinson', department: 'Design', role: 'Staff', salary: 140000, experience: 10, rating: 4.9, location: 'Remote' },
];

const columns = [
  col.text('id', { headerName: '#', width: 40, editable: false, sortable: true }),
  col.text('name', { headerName: 'Name', width: 140, sortable: true }),
  col.text('department', { headerName: 'Dept', width: 110, sortable: true }),
  col.text('role', { headerName: 'Role', width: 90, sortable: true }),
  col.currency('salary', { headerName: 'Salary', width: 110, sortable: true }),
  col.number('experience', { headerName: 'Exp (yrs)', width: 90, sortable: true }),
  col.number('rating', {
    headerName: 'Rating',
    width: 80,
    sortable: true,
    cellRenderer: (container, ctx) => {
      const val = ctx.value as number;
      container.textContent = val.toFixed(1);
      container.style.textAlign = 'center';
      container.style.color = val >= 4.5 ? '#2e7d32' : val >= 4.0 ? '#f57f17' : '#c62828';
      container.style.fontWeight = '500';
    },
  }),
  col.text('location', { headerName: 'Location', width: 120, sortable: true }),
] as ColumnDef<EmployeeRow>[];

export function SortFilter() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Sorting & Filtering</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        <code>mode="view"</code> includes sort + filter + resize + select. 20 employees — explore the data.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Sort:</strong> Click any header to sort (asc → desc → none)
        <br />
        <strong>Filter:</strong> Click the filter icon (funnel) in any header, or right-click → "Filter..." → type a value (e.g., "Engineering" on Dept)
        <br />
        <strong>Combine:</strong> Filter by department, then sort by salary to find top earners per team
      </div>

      <BetterGrid<EmployeeRow>
        columns={columns}
        data={data}
        mode="view"
        features={{ format: { locale: 'en-US', currencyCode: 'USD' } }}
        frozen={{ left: 2 }}
        selection={{ mode: 'range' }}
        height={500}
      />

      <CodeBlock title="Sort & Filter" code={`import { BetterGrid, defineColumn as col } from '@better-grid/react';

// Click header to sort (asc → desc → none)
// Right-click header → Filter... / Clear Filter

const columns = [
  col.text('id', { headerName: '#', width: 40, editable: false, sortable: true }),
  col.text('name', { headerName: 'Name', width: 140, sortable: true }),
  col.text('department', { headerName: 'Dept', width: 110, sortable: true }),
  col.text('role', { headerName: 'Role', width: 90, sortable: true }),
  col.currency('salary', { headerName: 'Salary', width: 110, sortable: true }),
  col.number('experience', { headerName: 'Exp (yrs)', width: 90, sortable: true }),
  col.number('rating', { headerName: 'Rating', width: 80, sortable: true,
    cellRenderer: (el, ctx) => {
      el.textContent = ctx.value.toFixed(1);
      el.style.color = ctx.value >= 4.5 ? '#2e7d32'
                      : ctx.value >= 4.0 ? '#f57f17' : '#c62828';
    },
  }),
  col.text('location', { headerName: 'Location', width: 120, sortable: true }),
];

<BetterGrid
  columns={columns}
  data={employees}
  mode="view"   // sort + filter + resize + select
  features={{ format: { locale: 'en-US', currencyCode: 'USD' } }}
  frozen={{ left: 2 }}
/>`} />
    </div>
  );
}

