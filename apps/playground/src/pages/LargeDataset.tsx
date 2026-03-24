import { useMemo, useState, useEffect, useRef } from 'react';
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
  const totalCells = rowCount * (colCount + 1);

  const data = useMemo(() => generateData(rowCount, colCount), []);
  const columns = useMemo(() => generateColumns(colCount), []);

  // Track live DOM element count
  const [domCount, setDomCount] = useState(0);
  const [fps, setFps] = useState(0);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

  useEffect(() => {
    let running = true;

    function measure() {
      if (!running) return;

      // Count actual DOM cells
      const cells = document.querySelectorAll('.bg-cell');
      setDomCount(cells.length);

      // FPS counter
      fpsRef.current.frames++;
      const now = performance.now();
      const elapsed = now - fpsRef.current.lastTime;
      if (elapsed >= 1000) {
        setFps(Math.round((fpsRef.current.frames * 1000) / elapsed));
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
      }

      requestAnimationFrame(measure);
    }

    requestAnimationFrame(measure);
    return () => { running = false; };
  }, []);

  const memSaved = ((1 - domCount / totalCells) * 100);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Large Dataset — Virtual Scrolling</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        {rowCount.toLocaleString()} rows × {colCount + 1} columns.
        The grid only creates DOM elements for cells you can see — not all 500K.
        Scroll to watch the stats update live.
      </p>

      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 16,
        fontSize: 13,
        flexWrap: 'wrap',
      }}>
        <Stat label="Total Cells" value={totalCells.toLocaleString()} />
        <Stat label="In DOM" value={domCount.toLocaleString()} highlight />
        <Stat label="DOM Reduction" value={domCount > 0 ? `${memSaved.toFixed(1)}%` : '—'} />
        <Stat label="FPS" value={fps > 0 ? String(fps) : '—'} highlight={fps >= 55} warn={fps > 0 && fps < 30} />
        <Stat label="Frozen" value="ID column" />
      </div>

      <BetterGrid<LargeRow>
        columns={columns}
        data={data}
        frozenLeftColumns={1}
        selection={{ mode: 'range' }}
        height={500}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa' }}>
        Scroll vertically and horizontally — DOM count and FPS update live.
        Only ~{Math.round(domCount / totalCells * 10000) / 100}% of cells exist in the DOM at any time.
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  const bg = warn ? '#fff3e0' : highlight ? '#e8f0fe' : '#f8f9fa';
  const border = warn ? '#ffcc80' : highlight ? '#d0e0f0' : '#e8e8e8';
  const fg = warn ? '#e65100' : highlight ? '#1a73e8' : '#333';

  return (
    <div style={{
      padding: '8px 16px',
      background: bg,
      borderRadius: 8,
      border: `1px solid ${border}`,
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: fg }}>{value}</div>
    </div>
  );
}
