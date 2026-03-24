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
    { id: 'id', accessorKey: 'id', header: 'ID', width: 70 },
  ];
  for (let c = 0; c < colCount; c++) {
    cols.push({
      id: `col${c}`,
      accessorKey: `col${c}` as keyof LargeRow & string,
      header: `Column ${c + 1}`,
      width: 100,
    });
  }
  return cols;
}

export function LargeDataset() {
  const rowCount = 10_000;
  const colCount = 50;

  const data = useMemo(() => generateData(rowCount, colCount), []);
  const columns = useMemo(() => generateColumns(colCount), []);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Large Dataset</h1>
      <p style={{ marginBottom: 16, color: '#666' }}>
        {rowCount.toLocaleString()} rows x {colCount} columns — virtual scrolling handles the performance.
      </p>
      <BetterGrid<LargeRow>
        columns={columns}
        data={data}
        frozenLeftColumns={1}
        selection={{ mode: 'range' }}
        height={600}
      />
    </div>
  );
}
