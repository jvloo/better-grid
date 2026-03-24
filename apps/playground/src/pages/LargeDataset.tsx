import { useMemo, useState, useEffect, useRef } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface LargeRow {
  id: number;
  [key: string]: unknown;
}

function generateData(rowCount: number, colCount: number): LargeRow[] {
  const start = performance.now();
  const data: LargeRow[] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: LargeRow = { id: r + 1 };
    for (let c = 0; c < colCount; c++) {
      row[`col${c}`] = Math.round(Math.random() * 10000) / 100;
    }
    data.push(row);
  }
  const elapsed = performance.now() - start;
  return data;
}

function generateColumns(colCount: number): ColumnDef<LargeRow>[] {
  const cols: ColumnDef<LargeRow>[] = [
    { id: 'id', header: 'ID', width: 80 },
  ];
  for (let c = 0; c < colCount; c++) {
    cols.push({
      id: `col${c}`,
      header: `Col ${c + 1}`,
      width: 90,
    });
  }
  return cols;
}

const PRESETS = [
  { label: '1K × 20', rows: 1_000, cols: 20 },
  { label: '10K × 50', rows: 10_000, cols: 50 },
  { label: '100K × 50', rows: 100_000, cols: 50 },
  { label: '500K × 50', rows: 500_000, cols: 50 },
  { label: '1M × 50', rows: 1_000_000, cols: 50 },
];

export function LargeDataset() {
  const [rowCount, setRowCount] = useState(10_000);
  const [colCount, setColCount] = useState(50);
  const [generating, setGenerating] = useState(false);
  const [genTime, setGenTime] = useState(0);

  const totalCells = rowCount * (colCount + 1);

  const [data, setData] = useState<LargeRow[]>(() => generateData(10_000, 50));
  const [columns, setColumns] = useState<ColumnDef<LargeRow>[]>(() => generateColumns(50));
  const [gridKey, setGridKey] = useState(0);

  function applyPreset(rows: number, cols: number) {
    setGenerating(true);
    setRowCount(rows);
    setColCount(cols);

    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      const start = performance.now();
      const newData = generateData(rows, cols);
      const elapsed = performance.now() - start;
      setGenTime(Math.round(elapsed));
      setData(newData);
      setColumns(generateColumns(cols));
      setGridKey((k) => k + 1);
      setGenerating(false);
    }, 50);
  }

  // Live DOM count and FPS
  const [domCount, setDomCount] = useState(0);
  const [fps, setFps] = useState(0);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

  useEffect(() => {
    let running = true;

    function measure() {
      if (!running) return;

      const cells = document.querySelectorAll('.bg-cell');
      setDomCount(cells.length);

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

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Virtual Scrolling — Performance Benchmark</h1>
      <p style={{ marginBottom: 12, color: '#666', lineHeight: 1.5 }}>
        Only visible cells exist in the DOM. Try different scales — stats update live as you scroll.
      </p>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {PRESETS.map((p) => {
          const isActive = p.rows === rowCount && p.cols === colCount;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.rows, p.cols)}
              disabled={generating}
              style={{
                padding: '6px 14px',
                border: `1px solid ${isActive ? '#1a73e8' : '#d0d0d0'}`,
                borderRadius: 6,
                background: isActive ? '#1a73e8' : '#fff',
                color: isActive ? '#fff' : '#333',
                cursor: generating ? 'wait' : 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                opacity: generating ? 0.6 : 1,
              }}
            >
              {p.label}
              {p.rows >= 1_000_000 && !isActive && ' 🔥'}
            </button>
          );
        })}
        {generating && <span style={{ fontSize: 13, color: '#888', alignSelf: 'center' }}>Generating data...</span>}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stat label="Total Cells" value={totalCells.toLocaleString()} />
        <Stat label="In DOM" value={domCount.toLocaleString()} highlight />
        <Stat
          label="DOM Reduction"
          value={domCount > 0 ? `${((1 - domCount / totalCells) * 100).toFixed(2)}%` : '—'}
        />
        <Stat
          label="FPS"
          value={fps > 0 ? String(fps) : '—'}
          highlight={fps >= 55}
          warn={fps > 0 && fps < 30}
        />
        {genTime > 0 && <Stat label="Data Gen" value={`${genTime}ms`} />}
      </div>

      {/* Grid */}
      <BetterGrid<LargeRow>
        key={gridKey}
        columns={columns}
        data={data}
        frozenLeftColumns={1}
        selection={{ mode: 'range' }}
        height={480}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa' }}>
        Scroll vertically and horizontally — DOM count and FPS update live.
        {rowCount >= 100_000 && ' AG Grid crashes at 400K rows. RevoGrid claims 400K. Try 1M here.'}
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
