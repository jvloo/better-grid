import { useMemo, useState, useCallback } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, Selection } from '@better-grid/core';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface SampleRow {
  id: number;
  name: string;
  department: string;
  salary: number;
  startDate: string;
  active: boolean;
}

const sampleData: SampleRow[] = [
  { id: 1, name: 'Alice Chen', department: 'Engineering', salary: 125000, startDate: '2024-03-15', active: true },
  { id: 2, name: 'Bob Martinez', department: 'Design', salary: 95000, startDate: '2023-07-01', active: true },
  { id: 3, name: 'Carol Johnson', department: 'Engineering', salary: 145000, startDate: '2022-01-10', active: true },
  { id: 4, name: 'David Kim', department: 'Marketing', salary: 88000, startDate: '2025-01-20', active: false },
  { id: 5, name: 'Emma Wilson', department: 'Engineering', salary: 135000, startDate: '2023-11-05', active: true },
  { id: 6, name: 'Frank Lee', department: 'Sales', salary: 92000, startDate: '2024-06-18', active: true },
  { id: 7, name: 'Grace Park', department: 'Design', salary: 105000, startDate: '2022-09-01', active: true },
  { id: 8, name: 'Henry Taylor', department: 'Marketing', salary: 78000, startDate: '2025-02-15', active: false },
  { id: 9, name: 'Ivy Zhang', department: 'Engineering', salary: 155000, startDate: '2021-04-20', active: true },
  { id: 10, name: 'Jack Brown', department: 'Sales', salary: 97000, startDate: '2024-08-30', active: true },
];

export function CoreOnly() {
  const [selectionInfo, setSelectionInfo] = useState('Click a cell to select');

  const columns = useMemo<ColumnDef<SampleRow>[]>(
    () => [
      { id: 'id', header: 'ID', width: 50 },
      { id: 'name', header: 'Name', width: 160 },
      { id: 'department', header: 'Department', width: 120 },
      { id: 'salary', header: 'Salary', width: 120 },
      { id: 'startDate', header: 'Start Date', width: 120 },
      { id: 'active', header: 'Active', width: 80 },
    ],
    [],
  );

  const handleSelectionChange = useCallback((selection: Selection) => {
    if (!selection.active) {
      setSelectionInfo('Click a cell to select');
      return;
    }
    const { rowIndex, colIndex } = selection.active;
    const range = selection.ranges[0];
    if (range && (range.startRow !== range.endRow || range.startCol !== range.endCol)) {
      const rows = range.endRow - range.startRow + 1;
      const cols = range.endCol - range.startCol + 1;
      setSelectionInfo(`Range: ${rows}×${cols} cells (Row ${range.startRow + 1}–${range.endRow + 1}, Col ${range.startCol + 1}–${range.endCol + 1})`);
    } else {
      setSelectionInfo(`Cell: Row ${rowIndex + 1}, Col ${colIndex + 1}`);
    }
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Core Only — Zero Plugins</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        No plugins loaded. Raw values, no formatting, no editing, no sorting.
        This is what the core engine provides out of the box.
      </p>

      <div style={{ marginBottom: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: 13 }}>
        <strong>Try these:</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginTop: 8, color: '#555' }}>
          <div>1. Click any cell → select it</div>
          <div>2. Shift+click another → range select</div>
          <div>3. Arrow keys → navigate</div>
          <div>4. Shift+Arrow → extend range</div>
          <div>5. Drag header border → resize column</div>
          <div>6. Tab / Shift+Tab → move right/left</div>
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, padding: '6px 12px', background: '#e8f0fe', borderRadius: 6, color: '#1a73e8', fontWeight: 500 }}>
        {selectionInfo}
      </div>

      <BetterGrid<SampleRow>
        columns={columns}
        data={sampleData}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        onSelectionChange={handleSelectionChange}
        height={440}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa' }}>
        Notice: salary shows "125000" not "$125,000.00" · dates show "2024-03-15" not "Mar 15, 2024" · active shows "true" not "Yes" — plugins add formatting.
      </div>

      <CodeBlock title="Core Only" code={`import { BetterGrid } from '@better-grid/react';
import '@better-grid/core/styles.css';

// No plugins — just the core engine
// Raw values: 125000 (not $125,000), "2024-03-15" (not Mar 15, 2024)
<BetterGrid
  columns={[
    { id: 'id', header: 'ID', width: 50 },
    { id: 'name', header: 'Name', width: 160 },
    { id: 'department', header: 'Department', width: 120 },
    { id: 'salary', header: 'Salary', width: 120 },
    { id: 'startDate', header: 'Start Date', width: 120 },
    { id: 'active', header: 'Active', width: 80 },
  ]}
  data={employees}
  frozenLeftColumns={2}
  selection={{ mode: 'range' }}
  onSelectionChange={handleSelectionChange}
  height={440}
/>`} />
    </div>
  );
}
