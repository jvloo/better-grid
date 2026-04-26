import { useState, useEffect, useRef, useCallback } from 'react';
import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface PerfRow {
  id: number;
  name: string;
  category: string;
  value: number;
  score: number;
  date: string;
  status: string;
  active: boolean;
}

const NAMES = [
  'Alice', 'Bob', 'Carol', 'David', 'Emma', 'Frank', 'Grace', 'Henry',
  'Ivy', 'Jack', 'Karen', 'Leo', 'Mia', 'Noah', 'Olivia', 'Peter',
];
const CATEGORIES = ['Engineering', 'Sales', 'Marketing', 'Product', 'HR', 'Finance', 'Operations', 'Design'];
const STATUSES = ['Active', 'Pending', 'On Hold', 'Done'];
const LAST_NAMES = ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson'];

function generateData(rowCount: number): { data: PerfRow[]; genTime: number } {
  const start = performance.now();
  const data: PerfRow[] = new Array(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const seed = (i * 7 + 37);
    data[i] = {
      id: i + 1,
      name: `${NAMES[seed % NAMES.length]} ${LAST_NAMES[(seed * 3) % LAST_NAMES.length]}`,
      category: CATEGORIES[seed % CATEGORIES.length]!,
      value: Math.round(((seed * 13) % 500000) + 10000),
      score: Math.round(((seed * 17) % 100)) / 10,
      date: `2026-${String(((seed * 11) % 12) + 1).padStart(2, '0')}-${String(((seed * 7) % 28) + 1).padStart(2, '0')}`,
      status: STATUSES[(seed * 3) % STATUSES.length]!,
      active: seed % 3 !== 0,
    };
  }
  return { data, genTime: Math.round(performance.now() - start) };
}

const PRESETS = [
  { label: 'Generate 100K rows', rows: 100_000 },
  { label: 'Generate 500K rows', rows: 500_000 },
  { label: 'Generate 1M rows', rows: 1_000_000 },
];

// Hoisted at module scope (stable identity across all renders + grid resets).
// Module scope is strictly more stable than useMemo([]) since it survives
// HMR/StrictMode double-mounts too.
const columns = [
  col.text('id', { headerName: '#', width: 70, sortable: true }),
  col.text('name', { headerName: 'Name', width: 160, sortable: true }),
  col.text('category', { headerName: 'Category', width: 120, sortable: true }),
  col.currency('value', { headerName: 'Value', width: 120, sortable: true }),
  col.custom('score', {
    headerName: 'Score',
    width: 80,
    sortable: true,
    align: 'right',
    cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
      const v = ctx.value as number;
      el.textContent = v.toFixed(1);
      el.style.color = v >= 7 ? '#2e7d32' : v >= 4 ? '#f57f17' : '#c62828';
    },
  }),
  col.date('date', { headerName: 'Date', width: 110, sortable: true }),
  col.custom('status', {
    headerName: 'Status',
    width: 100,
    sortable: true,
    cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
      const v = ctx.value as string;
      const colors: Record<string, { bg: string; fg: string }> = {
        Active: { bg: '#e8f5e9', fg: '#2e7d32' },
        Pending: { bg: '#fff3e0', fg: '#e65100' },
        'On Hold': { bg: '#ffebee', fg: '#c62828' },
        Done: { bg: '#e3f2fd', fg: '#1565c0' },
      };
      const clr = colors[v] ?? { bg: '#f5f5f5', fg: '#666' };
      el.innerHTML = `<span style="pointer-events:none;padding:2px 6px;border-radius:10px;font-size:11px;background:${clr.bg};color:${clr.fg}">${v}</span>`;
    },
  }),
  col.boolean('active', { headerName: 'Active', width: 70, sortable: true }),
] as ColumnDef<PerfRow>[];

export function PerformanceDemo() {
  const [rowCount, setRowCount] = useState(100_000);
  const [generating, setGenerating] = useState(false);
  const [genTime, setGenTime] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const [data, setData] = useState<PerfRow[]>(() => {
    const result = generateData(100_000);
    return result.data;
  });
  const [gridKey, setGridKey] = useState(0);

  const colCount = 8;
  const totalCells = rowCount * colCount;

  const applyPreset = useCallback((rows: number) => {
    setGenerating(true);
    setRowCount(rows);

    setTimeout(() => {
      const result = generateData(rows);
      setGenTime(result.genTime);

      const renderStart = performance.now();
      setData(result.data);
      setGridKey((k) => k + 1);
      setGenerating(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRenderTime(Math.round(performance.now() - renderStart));
        });
      });
    }, 50);
  }, []);

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
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Performance Demo</h1>
      <p style={{ marginBottom: 12, color: '#666', lineHeight: 1.5 }}>
        Virtual scrolling handles millions of cells. Only ~200 DOM elements exist regardless of data size.
      </p>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((p) => {
          const isActive = p.rows === rowCount;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.rows)}
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
            </button>
          );
        })}
        {generating && <span style={{ fontSize: 13, color: '#888' }}>Generating...</span>}
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
        padding: '12px 16px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #e8e8e8',
        fontSize: 13, color: '#555',
      }}>
        <span><strong>{formatNumber(rowCount)}</strong> rows</span>
        <span style={{ color: '#ccc' }}>|</span>
        <span><strong>{colCount}</strong> columns</span>
        <span style={{ color: '#ccc' }}>|</span>
        <span><strong>{formatNumber(totalCells)}</strong> cells</span>
        <span style={{ color: '#ccc' }}>|</span>
        <span>DOM elements: <strong style={{ color: '#1a73e8' }}>~{domCount}</strong></span>
        <span style={{ color: '#ccc' }}>|</span>
        <span>Scroll FPS: <strong style={{ color: fps >= 55 ? '#2e7d32' : fps >= 30 ? '#f57f17' : '#c62828' }}>{fps > 0 ? fps : '--'}</strong></span>
      </div>

      {/* Performance Metrics */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stat label="Render Time" value={renderTime > 0 ? `${renderTime}ms` : '--'} />
        <Stat label="Data Gen" value={genTime > 0 ? (genTime < 1000 ? `${genTime}ms` : `${(genTime / 1000).toFixed(1)}s`) : '--'} />
        <Stat label="Scroll FPS" value={fps > 0 ? String(fps) : '--'} highlight={fps >= 55} warn={fps > 0 && fps < 30} />
        <Stat label="DOM Cells" value={String(domCount)} highlight />
        <Stat label="Total Cells" value={formatNumber(totalCells)} />
      </div>

      {/* Grid — view mode = sort + filter + resize + select */}
      <BetterGrid<PerfRow>
        key={gridKey}
        columns={columns}
        data={data}
        mode="view"
        features={{ format: { locale: 'en-US', currencyCode: 'USD' } }}
        frozen={{ left: 1 }}
        selection={{ mode: 'range' }}
        height={520}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
        {formatNumber(rowCount)} rows x {colCount} columns = {formatNumber(totalCells)} cells.
        DOM stays constant (~{domCount} elements) regardless of dataset size.
        Sorting, filtering, and formatting all active.
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

