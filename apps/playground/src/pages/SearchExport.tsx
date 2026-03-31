import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import {
  formatting, cellRenderers,
  search, exportPlugin, pagination,
} from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface EmployeeRow {
  id: number;
  name: string;
  department: string;
  role: string;
  salary: number;
  startDate: string;
  location: string;
  active: boolean;
}

const data: EmployeeRow[] = [
  { id: 1, name: 'Alice Chen', department: 'Engineering', role: 'Senior', salary: 145000, startDate: '2021-03-15', location: 'New York', active: true },
  { id: 2, name: 'Bob Martinez', department: 'Design', role: 'Lead', salary: 125000, startDate: '2020-06-01', location: 'San Francisco', active: true },
  { id: 3, name: 'Carol Johnson', department: 'Engineering', role: 'Staff', salary: 175000, startDate: '2019-01-10', location: 'Remote', active: true },
  { id: 4, name: 'David Kim', department: 'Marketing', role: 'Junior', salary: 72000, startDate: '2024-09-20', location: 'New York', active: true },
  { id: 5, name: 'Emma Wilson', department: 'Engineering', role: 'Senior', salary: 155000, startDate: '2020-11-05', location: 'London', active: true },
  { id: 6, name: 'Frank Lee', department: 'Sales', role: 'Lead', salary: 130000, startDate: '2019-07-22', location: 'Singapore', active: true },
  { id: 7, name: 'Grace Park', department: 'Design', role: 'Senior', salary: 115000, startDate: '2021-08-14', location: 'San Francisco', active: true },
  { id: 8, name: 'Henry Taylor', department: 'Marketing', role: 'Mid', salary: 88000, startDate: '2023-02-28', location: 'Remote', active: true },
  { id: 9, name: 'Ivy Zhang', department: 'Engineering', role: 'Principal', salary: 195000, startDate: '2017-05-01', location: 'New York', active: true },
  { id: 10, name: 'Jack Brown', department: 'Sales', role: 'Senior', salary: 118000, startDate: '2020-04-12', location: 'London', active: true },
  { id: 11, name: 'Karen White', department: 'Engineering', role: 'Mid', salary: 120000, startDate: '2022-10-01', location: 'Remote', active: true },
  { id: 12, name: 'Leo Garcia', department: 'Design', role: 'Junior', salary: 78000, startDate: '2025-01-15', location: 'San Francisco', active: true },
  { id: 13, name: 'Mia Davis', department: 'Sales', role: 'Mid', salary: 95000, startDate: '2022-06-18', location: 'Singapore', active: false },
  { id: 14, name: 'Noah Clark', department: 'Finance', role: 'Senior', salary: 140000, startDate: '2019-12-03', location: 'New York', active: true },
  { id: 15, name: 'Olivia Moore', department: 'Engineering', role: 'Senior', salary: 160000, startDate: '2020-02-14', location: 'London', active: true },
  { id: 16, name: 'Peter Hall', department: 'Operations', role: 'Mid', salary: 92000, startDate: '2023-05-22', location: 'Remote', active: true },
  { id: 17, name: 'Quinn Adams', department: 'Sales', role: 'Junior', salary: 68000, startDate: '2025-03-01', location: 'New York', active: true },
  { id: 18, name: 'Rachel Scott', department: 'Engineering', role: 'Lead', salary: 180000, startDate: '2018-09-10', location: 'San Francisco', active: true },
  { id: 19, name: 'Sam Turner', department: 'Marketing', role: 'Lead', salary: 125000, startDate: '2020-01-07', location: 'London', active: true },
  { id: 20, name: 'Tina Robinson', department: 'Design', role: 'Staff', salary: 142000, startDate: '2019-04-20', location: 'Remote', active: false },
  { id: 21, name: 'Uma Patel', department: 'Finance', role: 'Lead', salary: 155000, startDate: '2018-11-12', location: 'Singapore', active: true },
  { id: 22, name: 'Victor Nguyen', department: 'Engineering', role: 'Mid', salary: 125000, startDate: '2022-07-01', location: 'Berlin', active: true },
  { id: 23, name: 'Wendy Foster', department: 'Operations', role: 'Senior', salary: 110000, startDate: '2021-01-20', location: 'New York', active: true },
  { id: 24, name: 'Xander Brooks', department: 'Sales', role: 'Senior', salary: 122000, startDate: '2020-08-15', location: 'London', active: true },
  { id: 25, name: 'Yuki Tanaka', department: 'Engineering', role: 'Senior', salary: 150000, startDate: '2021-05-10', location: 'Remote', active: true },
  { id: 26, name: 'Zara Hussein', department: 'Marketing', role: 'Senior', salary: 115000, startDate: '2020-10-25', location: 'Berlin', active: true },
  { id: 27, name: 'Aaron Wright', department: 'Finance', role: 'Mid', salary: 98000, startDate: '2023-03-14', location: 'New York', active: true },
  { id: 28, name: 'Bella Cooper', department: 'Design', role: 'Mid', salary: 95000, startDate: '2022-12-01', location: 'San Francisco', active: false },
  { id: 29, name: 'Carlos Rivera', department: 'Operations', role: 'Lead', salary: 130000, startDate: '2019-06-18', location: 'Singapore', active: true },
  { id: 30, name: 'Diana Evans', department: 'Engineering', role: 'Staff', salary: 170000, startDate: '2018-03-22', location: 'London', active: true },
];

export function SearchExport() {
  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      { id: 'id', header: '#', width: 50, sortable: true },
      { id: 'name', header: 'Name', width: 150, sortable: true },
      { id: 'department', header: 'Department', width: 120, sortable: true },
      { id: 'role', header: 'Role', width: 100, sortable: true },
      { id: 'salary', header: 'Salary', width: 120, cellType: 'currency', sortable: true },
      { id: 'startDate', header: 'Start Date', width: 120, cellType: 'date', sortable: true },
      { id: 'location', header: 'Location', width: 120, sortable: true },
      { id: 'active', header: 'Active', width: 80, cellType: 'boolean', sortable: true },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      cellRenderers(),
      search(),
      exportPlugin({ filename: 'employees' }),
      pagination({ pageSize: 10 }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<EmployeeRow>({
    data,
    columns,
    plugins,
    rowHeight: 36,
    selection: { mode: 'range' },
  });

  const handleExportCsv = useCallback(() => {
    grid.getPlugin<{ exportToCsv: () => void }>('export')?.exportToCsv();
  }, [grid]);
  const handleExportExcel = useCallback(() => {
    grid.getPlugin<{ exportToExcel: () => void }>('export')?.exportToExcel();
  }, [grid]);

  const handleSearch = useCallback(() => {
    // Ctrl+F is handled by the search plugin; this button triggers it programmatically
    const container = (containerRef as unknown as { current: HTMLElement | null }).current
      ?? document.querySelector('[data-grid]');
    if (container) {
      const event = new KeyboardEvent('keydown', {
        key: 'f', ctrlKey: true, bubbles: true,
      });
      container.dispatchEvent(event);
    }
  }, [containerRef]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Search, Export & Pagination</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Find data with <code>Ctrl+F</code>, export to CSV, and navigate pages.
        Try searching for &ldquo;Engineering&rdquo; &mdash; matches highlight in yellow.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={handleExportCsv}
          style={{
            padding: '8px 16px', border: '1px solid #d0d0d0', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          CSV
        </button>
        <button
          onClick={handleExportExcel}
          style={{
            padding: '8px 16px', border: '1px solid #d0d0d0', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          Excel
        </button>
        <button
          onClick={handleSearch}
          style={{
            padding: '8px 16px', border: '1px solid #d0d0d0', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          Search (Ctrl+F)
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          height: 500,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          borderRadius: '8px 8px 0 0',
        }}
      />
    </div>
  );
}
