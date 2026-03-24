import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, sorting, filtering } from '@better-grid/plugins';
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

export function SortFilter() {
  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40, editable: false, sortable: true },
      { id: 'name', header: 'Name', width: 140, sortable: true },
      { id: 'department', header: 'Dept', width: 110, sortable: true },
      { id: 'role', header: 'Role', width: 90, sortable: true },
      { id: 'salary', header: 'Salary', width: 110, cellType: 'currency', sortable: true },
      { id: 'experience', header: 'Exp (yrs)', width: 90, sortable: true },
      {
        id: 'rating',
        header: 'Rating',
        width: 80,
        sortable: true,
        cellRenderer: (container, ctx) => {
          const val = ctx.value as number;
          container.textContent = val.toFixed(1);
          container.style.textAlign = 'center';
          container.style.color = val >= 4.5 ? '#2e7d32' : val >= 4.0 ? '#f57f17' : '#c62828';
          container.style.fontWeight = '500';
        },
      },
      { id: 'location', header: 'Location', width: 120, sortable: true },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      sorting(),
      filtering(),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Sorting & Filtering</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        <code>sorting()</code> + <code>filtering()</code> plugins. 20 employees — explore the data.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Sort:</strong> Click any header to sort (asc → desc → none)
        <br />
        <strong>Filter:</strong> Right-click any header → "Filter..." → type a value (e.g., "Engineering" on Dept)
        <br />
        <strong>Combine:</strong> Filter by department, then sort by salary to find top earners per team
      </div>

      <BetterGrid<EmployeeRow>
        columns={columns}
        data={data}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={500}
      />
    </div>
  );
}
