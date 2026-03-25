import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, GridPlugin, HeaderRow } from '@better-grid/core';
import { formatting, editing, sorting, filtering, validation } from '@better-grid/plugins';
import { CodeBlock } from '../components/CodeBlock';
import DataWorker from '../dataWorker?worker';
import '@better-grid/core/styles.css';

interface LargeRow {
  id: number;
  [key: string]: unknown;
}

const NAMES = ['Alice','Bob','Carol','David','Emma','Frank','Grace','Henry','Ivy','Jack','Karen','Leo','Mia','Noah','Olivia'];
const DEPTS = ['Engineering','Sales','Marketing','Product','HR','Finance','Operations','Design'];
const STATUSES = ['Active','Pending','On Hold','Done'];

function createData(rowCount: number, colCount: number, rich = false): { data: LargeRow[]; genTime: number } {
  const start = performance.now();
  const data: LargeRow[] = new Array(rowCount);
  for (let r = 0; r < rowCount; r++) {
    const row: LargeRow = { id: r + 1 };
    if (rich) {
      const TYPES = ['currency', 'percent', 'number', 'text', 'date', 'status', 'boolean', 'rating'];
      for (let c = 0; c < colCount; c++) {
        const type = TYPES[c % TYPES.length];
        const seed = (r * 7 + c * 13 + 37);
        switch (type) {
          case 'currency': row[`col${c}`] = Math.round((seed % 500000) + 10000); break;
          case 'percent': row[`col${c}`] = Math.round((seed % 95) + 1) / 100; break;
          case 'number': row[`col${c}`] = (seed % 9999) + 1; break;
          case 'text': row[`col${c}`] = NAMES[seed % NAMES.length] + ' ' + DEPTS[seed % DEPTS.length]; break;
          case 'date': row[`col${c}`] = `2026-${String((seed % 12) + 1).padStart(2, '0')}-${String((seed % 28) + 1).padStart(2, '0')}`; break;
          case 'status': row[`col${c}`] = STATUSES[seed % STATUSES.length]; break;
          case 'boolean': row[`col${c}`] = seed % 3 !== 0; break;
          case 'rating': row[`col${c}`] = Math.round(((seed % 50) / 10 + 1) * 10) / 10; break;
        }
      }
    } else {
      for (let c = 0; c < colCount; c++) {
        row[`col${c}`] = Math.round(((r * 7 + c * 13 + 37) % 10000) / 100 * 100) / 100;
      }
    }
    data[r] = row;
  }
  return { data, genTime: Math.round(performance.now() - start) };
}

function generateColumns(colCount: number, rich = false): ColumnDef<LargeRow>[] {
  const cols: ColumnDef<LargeRow>[] = [
    { id: 'id', header: '#', width: 40 },
  ];
  if (rich) {
    // Generate 100 meaningful columns with varied types
    const TYPES = ['currency', 'percent', 'number', 'text', 'date', 'status', 'boolean', 'rating'] as const;
    for (let c = 0; c < colCount; c++) {
      const type = TYPES[c % TYPES.length];
      const colId = `col${c}`;
      const group = Math.floor(c / TYPES.length) + 1;
      switch (type) {
        case 'currency':
          cols.push({ id: colId, header: `Rev G${group}`, width: 110, cellType: 'currency', sortable: true });
          break;
        case 'percent':
          cols.push({ id: colId, header: `Rate G${group}`, width: 90, cellType: 'percent', sortable: true });
          break;
        case 'number':
          cols.push({ id: colId, header: `Qty G${group}`, width: 80, align: 'right', sortable: true });
          break;
        case 'text':
          cols.push({ id: colId, header: `Note G${group}`, width: 155, sortable: true });
          break;
        case 'date':
          cols.push({ id: colId, header: `Date G${group}`, width: 115, cellType: 'date', sortable: true });
          break;
        case 'status':
          cols.push({
            id: colId, header: `Status G${group}`, width: 100, sortable: true,
            options: STATUSES,
            cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
              const v = ctx.value as string;
              const colors: Record<string, { bg: string; fg: string }> = {
                Active: { bg: '#e8f5e9', fg: '#2e7d32' }, Pending: { bg: '#fff3e0', fg: '#e65100' },
                'On Hold': { bg: '#ffebee', fg: '#c62828' }, Done: { bg: '#e3f2fd', fg: '#1565c0' },
              };
              const clr = colors[v] ?? { bg: '#f5f5f5', fg: '#666' };
              el.innerHTML = `<span style="pointer-events:none;padding:2px 6px;border-radius:10px;font-size:11px;background:${clr.bg};color:${clr.fg}">${v}</span>`;
            },
          });
          break;
        case 'boolean':
          cols.push({
            id: colId, header: `Flag G${group}`, width: 75, sortable: true,
            cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
              el.textContent = ctx.value ? '✓' : '✗';
              el.style.color = ctx.value ? '#2e7d32' : '#c62828';
              el.style.textAlign = 'center';
            },
          });
          break;
        case 'rating':
          cols.push({
            id: colId, header: `Score G${group}`, width: 85, sortable: true,
            cellRenderer: (el: HTMLElement, ctx: { value: unknown }) => {
              const v = ctx.value as number;
              el.textContent = v.toFixed(1);
              el.style.color = v >= 4 ? '#2e7d32' : v >= 3 ? '#f57f17' : '#c62828';
              el.style.textAlign = 'center';
            },
          });
          break;
      }
    }
  } else {
    for (let c = 0; c < colCount; c++) {
      cols.push({ id: `col${c}`, header: `Col ${c + 1}`, width: 90 });
    }
  }
  return cols;
}

function generateHeaderRows(colCount: number, rich: boolean): HeaderRow[] | undefined {
  if (!rich) return undefined;

  const TYPES_PER_GROUP = 8;
  const groupCount = Math.ceil(colCount / TYPES_PER_GROUP);

  // Row 1: ID (rowSpan:2) + groups spanning 8 cols each
  const groupCells: HeaderRow['cells'] = [
    { id: 'g-id', content: '#', rowSpan: 2 },
  ];
  for (let g = 0; g < groupCount; g++) {
    const remaining = colCount - g * TYPES_PER_GROUP;
    const span = Math.min(TYPES_PER_GROUP, remaining);
    groupCells.push({
      id: `g-${g}`,
      content: `Group ${g + 1}`,
      colSpan: span,
    });
  }

  // Row 2: column headers (ID is skipped — rowSpan from above)
  const colCells: HeaderRow['cells'] = [];
  const LABELS = ['Rev', 'Rate', 'Qty', 'Note', 'Date', 'Status', 'Flag', 'Score'];
  for (let c = 0; c < colCount; c++) {
    const label = LABELS[c % LABELS.length];
    const group = Math.floor(c / TYPES_PER_GROUP) + 1;
    colCells.push({
      id: `h-col${c}`,
      content: `${label} G${group}`,
      columnId: `col${c}`,
    });
  }

  return [
    { id: 'groups', height: 30, cells: groupCells },
    { id: 'columns', height: 30, cells: colCells },
  ];
}

const PRESETS = [
  { label: '1,000 rows', rows: 1_000, cols: 100 },
  { label: '10,000 rows', rows: 10_000, cols: 100 },
  { label: '100,000 rows', rows: 100_000, cols: 100 },
  { label: '200,000 rows', rows: 200_000, cols: 100 },
  { label: '400,000 rows', rows: 400_000, cols: 100 },
  { label: '1,000,000 rows', rows: 1_000_000, cols: 100 },
];

export function LargeDataset() {
  const [rowCount, setRowCount] = useState(1_000);
  const [colCount, setColCount] = useState(100);
  const [generating, setGenerating] = useState(false);
  const [genTime, setGenTime] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const [memoryMB, setMemoryMB] = useState<string>('N/A');

  const totalCells = rowCount * (colCount + 1);

  const [data, setData] = useState<LargeRow[]>(() => createData(1_000, 100, true).data);
  const [columns, setColumns] = useState<ColumnDef<LargeRow>[]>(() => generateColumns(100, true));
  const [headerRows, setHeaderRows] = useState<HeaderRow[] | undefined>(() => generateHeaderRows(100, true));
  const [gridKey, setGridKey] = useState(0);

  const plugins = useMemo<GridPlugin[]>(() => [
    formatting({ locale: 'en-US', currencyCode: 'USD' }),
    editing({ editTrigger: 'dblclick' }),
    sorting(),
    filtering(),
    validation({ validateOn: 'commit' }),
  ], []);

  // Memory measurement
  useEffect(() => {
    const id = setInterval(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      if (mem) setMemoryMB((mem.usedJSHeapSize / 1024 / 1024).toFixed(2));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  function applyPreset(rows: number, cols: number) {
    setGenerating(true);
    setRowCount(rows);
    setColCount(cols);

    // Generate data in a web worker to avoid blocking the main thread
    const worker = new DataWorker();
    worker.onmessage = (event) => {
      const { rows: generatedRows, genTime: gt } = event.data;
      worker.terminate();

      console.log(`[benchmark] Data generated in ${gt}ms (${(rows * (cols + 1)).toLocaleString()} cells)`);

      const renderStart = performance.now();
      setGenTime(gt);
      setData(generatedRows);
      setColumns(generateColumns(cols, true));
      setHeaderRows(generateHeaderRows(cols, true));
      setGridKey((k) => k + 1);
      setGenerating(false);

      // Measure render time
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRenderTime(Math.round(performance.now() - renderStart));
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
            genTimeMs: gt,
            domCells,
            heapMB,
          };
          console.log(`[benchmark] Results:`, (window as unknown as Record<string, unknown>).__bgBenchmark);
        });
      });
    };
    worker.postMessage({ rowsNumber: rows, colsNumber: cols });
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
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Performance</h1>
      <p style={{ marginBottom: 12, color: '#666', lineHeight: 1.5 }}>
        Rich content with all plugins enabled. Only visible cells exist in the DOM.
      </p>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map(p => {
          const isActive = p.rows === rowCount;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.rows, p.cols)}
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
                {p.rows.toLocaleString()} × {p.cols}
              </span>
            </button>
          );
        })}
        {generating && <span style={{ fontSize: 13, color: '#888' }}>Generating...</span>}
      </div>

      {/* Performance Metrics */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Stat label="Render Time" value={renderTime > 0 ? `${renderTime}ms` : '—'} />
        <Stat label="Scroll FPS" value={fps > 0 ? String(fps) : '—'} highlight={fps >= 55} warn={fps > 0 && fps < 30} />
        <Stat label="Memory" value={memoryMB !== 'N/A' ? `${memoryMB} MB` : '—'} />
        <Stat label="DOM Cells" value={String(domCount)} highlight />
        <Stat label="Total Cells" value={formatNumber(totalCells)} />
        {genTime > 0 && <Stat label="Data Gen" value={genTime < 1000 ? `${genTime}ms` : `${(genTime / 1000).toFixed(1)}s`} />}
      </div>

      {/* Grid */}
      <BetterGrid<LargeRow>
        key={gridKey}
        columns={columns}
        data={data}
        headerRows={headerRows}
        frozenLeftColumns={1}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={600}
      />

      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
        {formatNumber(rowCount)} rows × {colCount + 1} columns. All plugins active.
        DOM stays constant (~{domCount} elements) regardless of dataset size.
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
