import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface LargeRow {
  id: number;
  [key: string]: unknown;
}

function generateData(rowCount: number, colCount: number): LargeRow[] {
  const data: LargeRow[] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: LargeRow = { id: r + 1 };
    for (let c = 0; c < colCount; c++) {
      row[`col${c}`] = Math.round(Math.random() * 10000) / 100;
    }
    data.push(row);
  }
  return data;
}

function generateColumns(colCount: number): ColumnDef<LargeRow>[] {
  const cols: ColumnDef<LargeRow>[] = [
    { id: 'id', header: 'ID', width: 70 },
  ];
  for (let c = 0; c < colCount; c++) {
    cols.push({
      id: `col${c}`,
      header: `Column ${c + 1}`,
      width: 100,
    });
  }
  return cols;
}

export function LargeDataset() {
  const rowCount = 10_000;
  const colCount = 50;
  const totalCells = rowCount * (colCount + 1); // +1 for ID column

  const data = useMemo(() => generateData(rowCount, colCount), []);
  const columns = useMemo(() => generateColumns(colCount), []);

  // Approximate visible cells (14 rows × 15 cols visible)
  const visibleRows = 14;
  const visibleCols = 15;
  const renderedCells = visibleRows * visibleCols;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Large Dataset — Virtual Scrolling</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        {rowCount.toLocaleString()} rows × {colCount + 1} columns. Only visible cells are rendered in the DOM.
      </p>

      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 16,
        fontSize: 13,
      }}>
        <Stat label="Total Cells" value={totalCells.toLocaleString()} />
        <Stat label="Rendered DOM" value={`~${renderedCells}`} highlight />
        <Stat label="Virtualized" value={`${((1 - renderedCells / totalCells) * 100).toFixed(2)}%`} />
        <Stat label="Frozen Column" value="ID" />
      </div>

      <BetterGrid<LargeRow>
        columns={columns}
        data={data}
        frozenLeftColumns={1}
        selection={{ mode: 'range' }}
        height={500}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa' }}>
        Scroll vertically and horizontally to see virtualization in action. The grid only renders ~{renderedCells} DOM elements out of {totalCells.toLocaleString()} total cells.
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '8px 16px',
      background: highlight ? '#e8f0fe' : '#f8f9fa',
      borderRadius: 8,
      border: highlight ? '1px solid #d0e0f0' : '1px solid #e8e8e8',
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: highlight ? '#1a73e8' : '#333' }}>{value}</div>
    </div>
  );
}
