import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, sorting, filtering, cellRenderers, autoDetect, search, exportPlugin, pagination, editing } from '@better-grid/plugins';
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

const columns: ColumnDef<Employee>[] = [
  { id: 'id', header: '#', width: 50, align: 'center' },
  { id: 'name', header: 'Name', width: 160, sortable: true },
  { id: 'email', header: 'Email', width: 220, sortable: true },
  {
    id: 'department', header: 'Department', width: 120, sortable: true,
    cellType: 'badge',
    options: departments.map(d => ({ label: d, value: d, color: '#1a1a1a', bg: '#f0f0f0' })),
  },
  { id: 'role', header: 'Role', width: 150, sortable: true },
  { id: 'location', header: 'Location', width: 120, sortable: true },
  { id: 'startDate', header: 'Start Date', width: 110, cellType: 'date', sortable: true },
  { id: 'salary', header: 'Salary', width: 110, cellType: 'currency', sortable: true, precision: 0 },
  { id: 'active', header: 'Active', width: 70, cellType: 'boolean' },
  { id: 'rating', header: 'Rating', width: 110, cellType: 'rating' },
];

export function HRDirectory() {
  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      autoDetect({ sampleSize: 10, autoAlign: true }),
      sorting(),
      filtering(),
      cellRenderers(),
      editing({ editTrigger: 'dblclick' }),
      search({ caseSensitive: false }),
      exportPlugin({ filename: 'employee-directory' }),
      pagination({ pageSize: 15 }),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>HR Directory</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Employee directory with 60 records. Ctrl+F to search, paginated at 15 rows per page. Auto-detected column types.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, autoDetect, sorting, filtering, cellRenderers, editing, search, export, pagination &bull;
        <strong> Core:</strong> selection (range)
      </div>

      <BetterGrid<Employee>
        columns={columns}
        data={data}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={560}
      />
    </div>
  );
}
