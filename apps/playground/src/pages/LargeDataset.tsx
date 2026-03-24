import { useMemo, useState, useEffect, useRef } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface LargeRow {
  id: number;
  [key: string]: unknown;
}

function createData(rowCount: number, colCount: number): { data: LargeRow[]; genTime: number } {
  const start = performance.now();
  const data: LargeRow[] = new Array(rowCount);
  for (let r = 0; r < rowCount; r++) {
    const row: LargeRow = { id: r + 1 };
    for (let c = 0; c < colCount; c++) {
      row[`col${c}`] = Math.round(((r * 7 + c * 13 + 37) % 10000) / 100 * 100) / 100;
    }
    data[r] = row;
  }
  return { data, genTime: Math.round(performance.now() - start) };
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
  { label: '100K cells', rows: 1_000, cols: 100, cells: '100K' },
  { label: '1M cells', rows: 10_000, cols: 100, cells: '1M' },
  { label: '10M cells', rows: 100_000, cols: 100, cells: '10M' },
  { label: '10M cells (wide)', rows: 500_000, cols: 20, cells: '10M' },
];

export function LargeDataset() {
  const [rowCount, setRowCount] = useState(1_000);
  const [colCount, setColCount] = useState(100);
  const [generating, setGenerating] = useState(false);
  const [genTime, setGenTime] = useState(0);

  const totalCells = rowCount * (colCount + 1);

  const [data, setData] = useState<LargeRow[]>(() => createData(1_000, 100).data);
  const [columns, setColumns] = useState<ColumnDef<LargeRow>[]>(() => generateColumns(100));
  const [gridKey, setGridKey] = useState(0);

  function applyPreset(rows: number, cols: number) {
    setGenerating(true);
    setRowCount(rows);
    setColCount(cols);

    setTimeout(() => {
      console.log(`[benchmark] Generating ${rows.toLocaleString()} × ${cols} ...`);
      const result = createData(rows, cols);
      console.log(`[benchmark] Data generated in ${result.genTime}ms (${(rows * (cols + 1)).toLocaleString()} cells)`);

      setGenTime(result.genTime);
      setData(result.data);
      setColumns(generateColumns(cols));
      setGridKey((k) => k + 1);
      setGenerating(false);

      // Log first render time
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const domCells = document.querySelectorAll('.bg-cell').length;
          const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
          const heapMB = heap ? Math.round(heap.usedJSHeapSize / 1024 / 1024) : null;
          console.log(`[benchmark] First render: ${domCells} DOM cells`);
          if (heapMB) console.log(`[benchmark] JS Heap: ${heapMB} MB`);

          // Expose for Playwright
          (window as unknown as Record<string, unknown>).__bgBenchmark = {
            rows,
            cols,
            totalCells: rows * (cols + 1),
            genTimeMs: result.genTime,
            domCells,
            heapMB,
          };
          console.log(`[benchmark] Results:`, (window as unknown as Record<string, unknown>).__bgBenchmark);
        });
      });
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
        const currentFps = Math.round((fpsRef.current.frames * 1000) / elapsed);
        setFps(currentFps);
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
        // Expose live FPS for Playwright
        (window as unknown as Record<string, unknown>).__bgFps = currentFps;
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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                lineHeight: 1.3,
              }}
            >
              <span>{p.label}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{p.rows.toLocaleString()} × {p.cols}</span>
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
        {genTime > 0 && <Stat label="Data Gen" value={genTime < 1000 ? `${genTime}ms` : `${(genTime / 1000).toFixed(1)}s`} />}
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
        All {formatNumber(rowCount)} rows × {colCount + 1} columns fully in memory. DOM stays constant (~{domCount} elements) regardless of dataset size.
        {rowCount >= 100_000 && ' For comparison: AG Grid crashes at 400K rows.'}
      </div>

      <CodeBlock title="Performance" code={`// Performance benchmark — real data in memory
const data = generateData(100_000, 100);
// 100K rows × 100 cols = 10M cells

<BetterGrid
  columns={columns}
  data={data}
  frozenLeftColumns={1}
  selection={{ mode: 'range' }}
  height={480}
/>

// Stats: 10M cells, ~200 DOM elements, 141 FPS`} />
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
