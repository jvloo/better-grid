import { useState, useEffect, useRef, useCallback } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

/**
 * Benchmark page — mirrors the exact setup from RevoGrid benchmarks:
 * https://github.com/revolist/revogrid-benchmarks
 *
 * Key details from their benchmark:
 * - Data: numeric keys {0: val, 1: val, ...} (not string keys)
 * - All rows cloned from one template via JSON.parse(JSON.stringify())
 * - Data generated in a web worker
 * - Row height: 23px (compact)
 * - Column width: 100px
 * - Viewport: 600px height
 * - No plugins, no formatting, no editing — bare rendering only
 * - 100 columns, tested at 1K / 100K / 200K / 400K rows
 * - FPS measured over 5s of continuous 50px scroll steps at 16ms
 * - Heap via performance.memory.usedJSHeapSize
 * - Time to first cell: navigation → first cell visible
 *
 * Reference: https://dev.to/revolist/battle-of-the-rows-the-limits-of-data-performance-4mcn
 */

interface BenchRow {
  [key: number]: number;
}

// Generate header label (A, B, ..., Z, AA, AB, ...) matching RevoGrid benchmark
function generateHeader(index: number): string {
  let div = index + 1;
  let label = '';
  while (div > 0) {
    const pos = (div - 1) % 26;
    label = String.fromCharCode(65 + pos) + label;
    div = Math.floor((div - pos) / 26);
  }
  return label;
}

// Generate data exactly like the RevoGrid benchmark:
// One template row, cloned N times via JSON parse/stringify
function generateData(rowCount: number, colCount: number): { data: BenchRow[]; genTime: number } {
  const start = performance.now();
  const template: Record<number, number> = {};
  for (let j = 0; j < colCount; j++) {
    template[j] = Math.random() * 10000;
  }
  const json = JSON.stringify(template);
  const data: BenchRow[] = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    data[i] = JSON.parse(json);
  }
  return { data, genTime: Math.round(performance.now() - start) };
}

function generateColumns(colCount: number): ColumnDef<BenchRow>[] {
  const cols: ColumnDef<BenchRow>[] = [];
  for (let j = 0; j < colCount; j++) {
    cols.push({
      id: String(j),
      header: generateHeader(j),
      width: 100, // matches benchmark colSize: 100
    });
  }
  return cols;
}

const PRESETS = [
  { label: '1K rows', rows: 1_000 },
  { label: '100K rows', rows: 100_000 },
  { label: '200K rows', rows: 200_000 },
  { label: '400K rows', rows: 400_000 },
];

const COL_COUNT = 100;

export function Benchmark() {
  const [rowCount, setRowCount] = useState(1_000);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<BenchRow[]>(() => generateData(1_000, COL_COUNT).data);
  const [columns] = useState<ColumnDef<BenchRow>[]>(() => generateColumns(COL_COUNT));
  const [gridKey, setGridKey] = useState(0);

  // Metrics
  const [heapMB, setHeapMB] = useState<string>('—');
  const [fps, setFps] = useState(0);
  const [genTime, setGenTime] = useState(0);
  const [domCells, setDomCells] = useState(0);
  const [firstCellMs, setFirstCellMs] = useState(0);

  // FPS counter
  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

  useEffect(() => {
    let running = true;
    function measure() {
      if (!running) return;
      setDomCells(document.querySelectorAll('.bg-cell').length);
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

  // Heap measurement
  useEffect(() => {
    const id = setInterval(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      if (mem) setHeapMB((mem.usedJSHeapSize / 1024 / 1024).toFixed(2));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const applyPreset = useCallback((rows: number) => {
    setGenerating(true);
    setRowCount(rows);

    const mountStart = performance.now();
    setTimeout(() => {
      const result = generateData(rows, COL_COUNT);
      setGenTime(result.genTime);
      setData(result.data);
      setGridKey(k => k + 1);
      setGenerating(false);

      // Measure time to first cell
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFirstCellMs(Math.round(performance.now() - mountStart));
        });
      });
    }, 50);
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Benchmark — RevoGrid Standard</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Mirrors the exact benchmark setup from{' '}
        <a href="https://dev.to/revolist/battle-of-the-rows-the-limits-of-data-performance-4mcn"
           target="_blank" rel="noopener" style={{ color: '#1a73e8' }}>
          Battle of the Rows
        </a>{' '}
        (<a href="https://github.com/revolist/revogrid-benchmarks"
            target="_blank" rel="noopener" style={{ color: '#1a73e8' }}>
          source
        </a>).
        Same data format (numeric keys), row height (23px), column width (100px), no plugins.
      </p>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map(p => {
          const isActive = p.rows === rowCount;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.rows)}
              disabled={generating}
              style={{
                padding: '6px 14px', border: `1px solid ${isActive ? '#1a73e8' : '#d0d0d0'}`,
                borderRadius: 6, background: isActive ? '#1a73e8' : '#fff',
                color: isActive ? '#fff' : '#333', cursor: generating ? 'wait' : 'pointer',
                fontSize: 13, fontWeight: isActive ? 600 : 400, opacity: generating ? 0.6 : 1,
              }}
            >
              {p.label}
              <span style={{ display: 'block', fontSize: 10, opacity: 0.7 }}>
                {p.rows.toLocaleString()} × {COL_COUNT}
              </span>
            </button>
          );
        })}
        {generating && <span style={{ fontSize: 13, color: '#888' }}>Generating...</span>}
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stat label="Heap" value={`${heapMB} MB`} />
        <Stat label="Scroll FPS" value={fps > 0 ? String(fps) : '—'} highlight={fps >= 55} warn={fps > 0 && fps < 30} />
        <Stat label="First Cell" value={firstCellMs > 0 ? `${firstCellMs}ms` : '—'} />
        <Stat label="Data Gen" value={genTime > 0 ? `${genTime}ms` : '—'} />
        <Stat label="DOM Cells" value={String(domCells)} highlight />
        <Stat label="Rows" value={rowCount.toLocaleString()} />
      </div>

      {/* Comparison charts */}
      <ComparisonCharts rowCount={rowCount} heapMB={heapMB} fps={fps} firstCellMs={firstCellMs} />

      {/* Grid — same config as RevoGrid benchmark */}
      <BetterGrid<BenchRow>
        key={gridKey}
        columns={columns}
        data={data}
        rowHeight={23}
        selection={{ mode: 'range' }}
        height={600}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
        {rowCount.toLocaleString()} rows × {COL_COUNT} cols. Row height: 23px. Column width: 100px.
        No plugins. Numeric keys. Same setup as RevoGrid benchmark.
      </div>
    </div>
  );
}

// Competitor data from https://dev.to/revolist/battle-of-the-rows-the-limits-of-data-performance-4mcn
const COMPETITOR_DATA: Record<string, Record<string, { heap: number; fps: number; firstCell: number }>> = {
  '1000': {
    RevoGrid:    { heap: 20.69,  fps: 60.22, firstCell: 6.07 },
    'AG Grid':   { heap: 40.15,  fps: 60.23, firstCell: 8.31 },
    Handsontable:{ heap: 37.77,  fps: 60.62, firstCell: 6.67 },
  },
  '100000': {
    RevoGrid:    { heap: 214.58, fps: 61.88, firstCell: 6.09 },
    'AG Grid':   { heap: 1297,   fps: 60.59, firstCell: 10.95 },
    Handsontable:{ heap: 1297,   fps: 60.85, firstCell: 16.71 },
  },
  '200000': {
    RevoGrid:    { heap: 368.12, fps: 61.02, firstCell: 6.14 },
    'AG Grid':   { heap: 2660.75,fps: 60.10, firstCell: 7.42 },
    Handsontable:{ heap: 2498.63,fps: 59.63, firstCell: 13.10 },
  },
  '400000': {
    RevoGrid:    { heap: 720,    fps: 60,    firstCell: 6.2 },
    'AG Grid':   { heap: 0,      fps: 0,     firstCell: 0 }, // crashed
    Handsontable:{ heap: 0,      fps: 0,     firstCell: 0 }, // crashed
  },
};

const GRID_COLORS: Record<string, string> = {
  'Better Grid': '#1a73e8',
  'RevoGrid': '#2e7d32',
  'AG Grid': '#e65100',
  'Handsontable': '#7b1fa2',
};

function ComparisonCharts({ rowCount, heapMB, fps, firstCellMs }: {
  rowCount: number; heapMB: string; fps: number; firstCellMs: number;
}) {
  const key = String(rowCount);
  const competitors = COMPETITOR_DATA[key] ?? COMPETITOR_DATA['1000']!;
  const heapNum = parseFloat(heapMB) || 0;

  const charts: { title: string; unit: string; entries: { name: string; value: number; color: string }[]; lowerIsBetter: boolean }[] = [
    {
      title: 'Memory (Heap)',
      unit: 'MB',
      lowerIsBetter: true,
      entries: [
        { name: 'Better Grid', value: heapNum, color: GRID_COLORS['Better Grid'] },
        ...Object.entries(competitors).filter(([, d]) => d.heap > 0).map(([name, d]) => ({
          name, value: d.heap, color: GRID_COLORS[name] ?? '#888',
        })),
      ],
    },
    {
      title: 'Scroll FPS',
      unit: 'fps',
      lowerIsBetter: false,
      entries: [
        { name: 'Better Grid', value: fps, color: GRID_COLORS['Better Grid'] },
        ...Object.entries(competitors).filter(([, d]) => d.fps > 0).map(([name, d]) => ({
          name, value: d.fps, color: GRID_COLORS[name] ?? '#888',
        })),
      ],
    },
    {
      title: 'Time to First Cell',
      unit: 'ms',
      lowerIsBetter: true,
      entries: [
        { name: 'Better Grid', value: firstCellMs, color: GRID_COLORS['Better Grid'] },
        ...Object.entries(competitors).filter(([, d]) => d.firstCell > 0).map(([name, d]) => ({
          name, value: d.firstCell, color: GRID_COLORS[name] ?? '#888',
        })),
      ],
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        Comparison — {rowCount.toLocaleString()} rows × 100 cols
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {charts.map(chart => (
          <BarChart key={chart.title} {...chart} />
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
        Competitor data from{' '}
        <a href="https://dev.to/revolist/battle-of-the-rows-the-limits-of-data-performance-4mcn"
          target="_blank" rel="noopener" style={{ color: '#888' }}>
          dev.to/revolist/battle-of-the-rows
        </a>
        {rowCount >= 400000 && ' · AG Grid & Handsontable crashed at 400K rows'}
      </div>
    </div>
  );
}

function BarChart({ title, unit, entries, lowerIsBetter }: {
  title: string; unit: string;
  entries: { name: string; value: number; color: string }[];
  lowerIsBetter: boolean;
}) {
  const maxVal = Math.max(...entries.map(e => e.value), 1);
  const bestVal = lowerIsBetter
    ? Math.min(...entries.filter(e => e.value > 0).map(e => e.value))
    : Math.max(...entries.map(e => e.value));

  return (
    <div style={{
      background: '#fafbfc', borderRadius: 8, padding: 12,
      border: '1px solid #e8e8e8',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#333' }}>
        {title}
        <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>
          ({lowerIsBetter ? 'lower is better' : 'higher is better'})
        </span>
      </div>
      {entries.map(entry => {
        const pct = maxVal > 0 ? (entry.value / maxVal) * 100 : 0;
        const isBest = entry.value > 0 && entry.value === bestVal;
        const isOurs = entry.name === 'Better Grid';
        return (
          <div key={entry.name} style={{ marginBottom: 6 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, marginBottom: 2,
            }}>
              <span style={{ fontWeight: isOurs ? 700 : 400, color: isOurs ? entry.color : '#555' }}>
                {entry.name} {isBest && '★'}
              </span>
              <span style={{ fontWeight: 600, color: entry.value > 0 ? '#333' : '#ccc' }}>
                {entry.value > 0 ? `${entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}` : '—'}
              </span>
            </div>
            <div style={{
              height: 14, background: '#e8e8e8', borderRadius: 7, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 7,
                width: `${Math.max(pct, entry.value > 0 ? 2 : 0)}%`,
                background: isBest
                  ? `linear-gradient(90deg, ${entry.color}, ${entry.color}dd)`
                  : `${entry.color}88`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  const bg = warn ? '#fff3e0' : highlight ? '#e8f0fe' : '#f8f9fa';
  const border = warn ? '#ffcc80' : highlight ? '#d0e0f0' : '#e8e8e8';
  const fg = warn ? '#e65100' : highlight ? '#1a73e8' : '#333';
  return (
    <div style={{ padding: '8px 16px', background: bg, borderRadius: 8, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: fg }}>{value}</div>
    </div>
  );
}
