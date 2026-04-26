import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { BadgeOption, ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface Employee {
  id: number;
  name: string;
  email: string;
  department: string;
  role: string;
  location: string;
  startDate: string;
  salary: number;
  active: boolean;
  rating: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const rng = seededRandom(777);
const firstNames = ['Emma', 'Liam', 'Sophia', 'Noah', 'Olivia', 'James', 'Ava', 'William', 'Isabella', 'Logan', 'Mia', 'Benjamin', 'Charlotte', 'Mason', 'Amelia', 'Ethan', 'Harper', 'Lucas', 'Evelyn', 'Alexander'];
const lastNames = ['Smith', 'Johnson', 'Brown', 'Williams', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const departments = ['Engineering', 'Marketing', 'Sales', 'Operations', 'HR', 'Finance', 'Legal', 'Design'];
const roles = ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'VP'];
const locations = ['New York', 'San Francisco', 'London', 'Singapore', 'Berlin', 'Tokyo', 'Sydney', 'Toronto'];

const data: Employee[] = Array.from({ length: 60 }, (_, i) => {
  const first = firstNames[Math.floor(rng() * firstNames.length)]!;
  const last = lastNames[Math.floor(rng() * lastNames.length)]!;
  const dept = departments[Math.floor(rng() * departments.length)]!;
  const role = roles[Math.floor(rng() * roles.length)]!;
  const year = 2018 + Math.floor(rng() * 8);
  const month = String(Math.floor(rng() * 12) + 1).padStart(2, '0');
  return {
    id: i + 1,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@company.com`,
    department: dept,
    role: `${role} ${dept === 'Engineering' ? 'Engineer' : dept === 'Design' ? 'Designer' : dept === 'Marketing' ? 'Marketer' : 'Analyst'}`,
    location: locations[Math.floor(rng() * locations.length)]!,
    startDate: `${year}-${month}-${String(Math.floor(rng() * 28) + 1).padStart(2, '0')}`,
    salary: Math.round((50000 + rng() * 150000) / 1000) * 1000,
    active: rng() > 0.15,
    rating: Math.floor(rng() * 5) + 1,
  };
});

const columns = [
  col.text('id', { headerName: '#', width: 50, align: 'center' }),
  col.text('name', { headerName: 'Name', width: 160, sortable: true }),
  col.text('email', { headerName: 'Email', width: 220, sortable: true }),
  col.badge('department', {
    headerName: 'Department',
    width: 120,
    sortable: true,
    options: departments.map((d) => ({ label: d, value: d, color: '#1a1a1a', bg: '#f0f0f0' })) as BadgeOption[],
  }),
  col.text('role', { headerName: 'Role', width: 150, sortable: true }),
  col.text('location', { headerName: 'Location', width: 120, sortable: true }),
  col.date('startDate', { headerName: 'Start Date', width: 110, sortable: true }),
  col.currency('salary', { headerName: 'Salary', width: 110, sortable: true, precision: 0 }),
  col.boolean('active', { headerName: 'Active', width: 70 }),
  col.rating('rating', { headerName: 'Rating', width: 110 }),
] as ColumnDef<Employee>[];

export function HRDirectory() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>HR Directory</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Employee directory with 60 records. Ctrl+F to search, paginated at 15 rows per page.
        Column types declared via <code>col.&lt;type&gt;()</code> builders.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Mode:</strong> view (sort/filter/resize/select) &bull;
        <strong> Features:</strong> format, edit, search, export, pagination &bull;
        <strong> Selection:</strong> range
      </div>

      <BetterGrid<Employee>
        columns={columns}
        data={data}
        mode="view"
        features={{
          format: { locale: 'en-US', currencyCode: 'USD' },
          edit: { editTrigger: 'dblclick' },
          search: { caseSensitive: false },
          export: { filename: 'employee-directory' },
          pagination: { pageSize: 15 },
        }}
        selection={{ mode: 'range' }}
        height={560}
      />
    </div>
  );
}

