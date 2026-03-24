import { useMemo, useState, useEffect, useRef } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface LargeRow {
  id: number;
  [key: string]: unknown;
}

/**
 * For small datasets (≤1M), generate all data upfront.
 * For large datasets (>1M), use a lazy proxy that generates rows on access.
 * This avoids allocating gigabytes of memory for 10M/100M row arrays.
 */
function createData(rowCount: number, colCount: number): { data: LargeRow[]; genTime: number; lazy: boolean } {
  const start = performance.now();

  if (rowCount <= 1_000_000) {
    // Eager: generate all rows
    const data: LargeRow[] = [];
    for (let r = 0; r < rowCount; r++) {
      const row: LargeRow = { id: r + 1 };
      for (let c = 0; c < colCount; c++) {
        row[`col${c}`] = Math.round(((r * 7 + c * 13 + 37) % 10000) / 100 * 100) / 100;
      }
      data.push(row);
    }
    return { data, genTime: Math.round(performance.now() - start), lazy: false };
  }

  // Lazy: use a Proxy-backed sparse array — rows generated on demand
  const cache = new Map<number, LargeRow>();
  const data = new Proxy([] as LargeRow[], {
    get(target, prop) {
      if (prop === 'length') return rowCount;
      if (prop === Symbol.iterator) {
        return function* () {
          for (let i = 0; i < rowCount; i++) yield getRow(i);
        };
      }
      const idx = Number(prop);
      if (!isNaN(idx) && idx >= 0 && idx < rowCount) {
        return getRow(idx);
      }
      return (target as Record<string | symbol, unknown>)[prop];
    },
  });

  function getRow(idx: number): LargeRow {
    let row = cache.get(idx);
    if (!row) {
      row = { id: idx + 1 } as LargeRow;
      for (let c = 0; c < colCount; c++) {
        row[`col${c}`] = Math.round(((idx * 7 + c * 13 + 37) % 10000) / 100 * 100) / 100;
      }
      cache.set(idx, row);
      // Keep cache bounded to ~10K rows to avoid memory growth
      if (cache.size > 10000) {
        const first = cache.keys().next().value;
        if (first !== undefined) cache.delete(first);
      }
    }
    return row;
  }

  return { data, genTime: Math.round(performance.now() - start), lazy: true };
}

function generateColumns(colCount: number): ColumnDef<LargeRow>[] {
  const cols: ColumnDef<LargeRow>[] = [
    { id: 'id', header: 'ID', width: 90 },
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
  { label: '1K × 20', rows: 1_000, cols: 20, note: 'Typical form' },
  { label: '10K × 50', rows: 10_000, cols: 50, note: 'Large report' },
  { label: '100K × 50', rows: 100_000, cols: 50, note: 'Analytics' },
  { label: '1M × 50', rows: 1_000_000, cols: 50, note: 'Stress test' },
  { label: '10M × 20', rows: 10_000_000, cols: 20, note: 'Synthetic', lazy: true },
  { label: '100M × 10', rows: 100_000_000, cols: 10, note: 'Synthetic', lazy: true },
];

export function LargeDataset() {
  const [rowCount, setRowCount] = useState(10_000);
  const [colCount, setColCount] = useState(50);
  const [generating, setGenerating] = useState(false);
  const [genTime, setGenTime] = useState(0);
  const [isLazy, setIsLazy] = useState(false);

  const totalCells = rowCount * (colCount + 1);

  const [data, setData] = useState<LargeRow[]>(() => createData(10_000, 50).data);
  const [columns, setColumns] = useState<ColumnDef<LargeRow>[]>(() => generateColumns(50));
  const [gridKey, setGridKey] = useState(0);

  function applyPreset(rows: number, cols: number) {
    setGenerating(true);
    setRowCount(rows);
    setColCount(cols);

    setTimeout(() => {
      const result = createData(rows, cols);
      setGenTime(result.genTime);
      setIsLazy(result.lazy);
      setData(result.data);
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((p) => {
          const isActive = p.rows === rowCount && p.cols === colCount;
          const isExtreme = p.rows >= 10_000_000;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.rows, p.cols)}
              disabled={generating}
              style={{
                padding: '6px 14px',
                border: `1px solid ${isActive ? '#1a73e8' : isExtreme ? '#c62828' : '#d0d0d0'}`,
                borderRadius: 6,
                background: isActive ? '#1a73e8' : '#fff',
                color: isActive ? '#fff' : isExtreme ? '#c62828' : '#333',
                cursor: generating ? 'wait' : 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 600 : isExtreme ? 500 : 400,
                opacity: generating ? 0.6 : 1,
              }}
            >
              {p.label}
              {isExtreme && !isActive && ' 🔥'}
            </button>
          );
        })}
        {generating && <span style={{ fontSize: 13, color: '#888' }}>Generating...</span>}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stat label="Total Cells" value={formatNumber(totalCells)} />
        <Stat label="In DOM" value={domCount.toLocaleString()} highlight />
        <Stat
          label="FPS"
          value={fps > 0 ? String(fps) : '—'}
          highlight={fps >= 55}
          warn={fps > 0 && fps < 30}
        />
        {genTime > 0 && <Stat label="Init Time" value={genTime < 1000 ? `${genTime}ms` : `${(genTime / 1000).toFixed(1)}s`} />}
        {isLazy && <Stat label="Mode" value="Lazy" highlight />}
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

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
        {isLazy
          ? '⚠️ Synthetic test: rows generated on-demand (lazy proxy). Real-world datasets >1M should use server-side pagination.'
          : `All ${formatNumber(rowCount)} rows in memory. DOM stays constant (~${domCount} elements) regardless of dataset size.`}
        {rowCount >= 100_000 && rowCount <= 1_000_000 && ' For comparison: AG Grid crashes at 400K rows.'}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
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
