import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, hierarchy, cellRenderers, clipboard, undoRedo, exportPlugin, gantt, rowActions, RowActionIcons, validation } from '@better-grid/plugins';
import type { RowAction } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface ProgramRow {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  duration: number | null;
  start: string;
  end: string;
  custom: boolean;
  startColumn: number;
  endColumn: number;
  [key: string]: string | number | boolean | null;
}

// ---------------------------------------------------------------------------
// Exact Wiseway default program phases (5 parents + 19 children + custom rows)
// Dates computed sequentially from Jul 2025 base to create realistic Gantt
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Data from QA app project 4369: https://qa-app.wiseway.ai/projects/4369/program
// Base month: Sep 2018 (month index 0). 218 months total (Sep 2018 – Oct 2036).
// ---------------------------------------------------------------------------

const BASE_YEAR = 2018;
const BASE_MONTH = 8; // September (0-indexed)

/** Convert "Mon YY" (e.g. "Sep 18", "Mar 25") to YYYY-MM-01 date string (no timezone issues) */
function parseMonYY(s: string): string {
  if (!s) return '';
  const months: Record<string, number> = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, June:6, Jun:6, July:7, Jul:7, Aug:8, Sept:9, Sep:9, Oct:10, Nov:11, Dec:12 };
  const parts = s.split(' ');
  const m = months[parts[0]!] ?? 1;
  const y = 2000 + parseInt(parts[1] || '0', 10);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/** Convert YYYY-MM-DD to month column index (relative to BASE Sep 2018) */
function toColIndex(dateStr: string): number {
  if (!dateStr) return -1;
  const [yStr, mStr] = dateStr.split('-');
  const y = parseInt(yStr!, 10);
  const m = parseInt(mStr!, 10) - 1; // 0-indexed
  return (y - BASE_YEAR) * 12 + m - BASE_MONTH;
}

let nextId = 100;
function customRows(parentId: number, parentCode: string, startIndex: number): ProgramRow[] {
  const rows: ProgramRow[] = [];
  for (let i = 0; i < 3; i++) {
    rows.push({ id: nextId++, parentId, code: `${parentCode}.${startIndex + i}`, name: '', duration: null, start: '', end: '', custom: true, startColumn: -1, endColumn: -1 });
  }
  return rows;
}

/** Helper to build a row from QA app data */
function r(id: number, parentId: number | null, code: string, name: string, dur: number | null, start: string, end: string, custom = false): ProgramRow {
  const startIso = parseMonYY(start);
  const endIso = parseMonYY(end);
  return { id, parentId, code, name, duration: dur, start: startIso, end: endIso, custom, startColumn: toColIndex(startIso), endColumn: toColIndex(endIso) };
}

const data: ProgramRow[] = [
  // ── Phase 1: Acquisition (Sep 18 – Mar 25, 79 months) ────────────────
  r(1, null, '1', 'Acquisition', 79, 'Sep 18', 'Mar 25'),
  r(2, 1, '1.1', 'Due Diligence', 3, 'Sep 18', 'Nov 18'),
  r(3, 1, '1.2', 'Deposit', 1, 'Nov 24', 'Nov 24'),
  r(4, 1, '1.3', 'Settlement', 4, 'Dec 24', 'Mar 25'),
  ...customRows(1, '1', 4),

  // ── Phase 2: Planning And Design (Sep 24 – May 26, 21 months) ────────
  r(5, null, '2', 'Planning And Design', 21, 'Sep 24', 'May 26'),
  r(6, 5, '2.1', 'Design Prep To Lodgement', 4, 'Sep 24', 'Dec 24'),
  r(7, 5, '2.2', 'Planning Assessment', 4, 'Dec 24', 'Mar 25'),
  r(8, 5, '2.3', 'Civil And Administrative Tribunal', null, '', ''),
  r(9, 5, '2.4', 'Prepare Design Amendment', 4, 'Mar 25', 'June 25'),
  r(10, 5, '2.5', 'Amendment Approval', 4, 'June 25', 'Sept 25'),
  r(11, 5, '2.6', '50% Detail Design', 4, 'Mar 25', 'June 25'),
  r(12, 5, '2.7', '70% Detail Design', 2, 'June 25', 'July 25'),
  r(13, 5, '2.8', '100% Detail Design', 11, 'July 25', 'May 26'),

  // ── Phase 3: Construction And Building Works (Mar 25 – Sept 26, 19 months) ──
  r(14, null, '3', 'Construction And Building Works', 19, 'Mar 25', 'Sept 26'),
  r(15, 14, '3.1', 'Demolition', null, 'Mar 25', 'May 25'),
  r(16, 14, '3.2', 'Early Work/Excavation', null, 'May 25', 'Oct 25'),
  r(17, 14, '3.3', 'Main Works', null, 'Oct 25', 'Sept 26'),

  // ── Phase 4: Marketing And Sales (Dec 24 – Oct 26, 23 months) ────────
  r(18, null, '4', 'Marketing And Sales', 23, 'Dec 24', 'Oct 26'),
  r(19, 18, '4.1', 'Marketing Prep', null, 'Dec 24', 'Feb 25'),
  r(20, 18, '4.2', 'Marketing Activity', null, 'Feb 25', 'Sept 26'),
  r(21, 18, '4.3', 'Sales/Leasing Period', null, 'Feb 25', 'Sept 26'),
  r(22, 18, '4.4', 'Settlement Management', null, 'Sept 26', 'Oct 26'),

  // ── Phase 5: Operation/Asset Management (Oct 26 – Oct 36, 121 months) ──
  r(23, null, '5', 'Operation/Asset Management', 121, 'Oct 26', 'Oct 36'),
  r(24, 23, '5.1', 'Lease Up Period', null, 'Oct 26', 'Dec 26'),
  r(25, 23, '5.2', 'Holding Period', null, 'Dec 26', 'Oct 36'),
  r(26, 23, '5.3', 'Termination', null, 'Oct 36', 'Oct 36'),
];

// Generate monthly columns covering full project range (Sep 2018 – Oct 2036 = 218 months)
const MONTH_COUNT = 218;
const months: { key: string; label: string }[] = [];
for (let i = 0; i < MONTH_COUNT; i++) {
  const d = new Date(BASE_YEAR, BASE_MONTH + i);
  const key = `m_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('en-AU', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  months.push({ key, label });
}

/** Format YYYY-MM-DD to "Mon yy" (e.g. "Sept 18") — timezone-safe */
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','June','July','Aug','Sept','Oct','Nov','Dec'];
function formatMonYY(dateStr: string): string {
  if (!dateStr) return '';
  const [yStr, mStr] = dateStr.split('-');
  if (!yStr || !mStr) return dateStr;
  const m = parseInt(mStr, 10) - 1;
  return `${MONTH_NAMES[m] ?? mStr} ${yStr.slice(2)}`;
}

export function FsbtProgram() {
  const columns = useMemo<ColumnDef<ProgramRow>[]>(() => [
    // ── Col 0: Menu (handled by rowActions plugin) ──────────────────────
    {
      id: 'actions', header: '', width: 50, editable: false,
      cellRenderer: (container, ctx) => {
        // Background only — rowActions plugin wraps this to add menu button
        const row = ctx.row as ProgramRow;
        container.style.backgroundColor = row.parentId === null ? '#F8F8F8' : '';
      },
    },
    // ── Col 1: Code (right-aligned with left gap) ───────────────────────
    {
      id: 'code', accessorKey: 'code', header: 'Code', width: 55, align: 'right' as const, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as ProgramRow;
        const isParent = row.parentId === null;
        container.textContent = row.code;
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.color = isParent ? '#101828' : '#282F3D';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        container.style.padding = '8.4px 6px';
        container.style.justifyContent = 'flex-end';
      },
    },
    // ── Col 2: Phase (indented name) ────────────────────────────────────
    {
      id: 'name', accessorKey: 'name', header: (() => { const el = document.createElement('span'); el.textContent = 'Phase'; el.style.paddingLeft = '8px'; return el; }) as any, width: 236,
      editable: ((row: ProgramRow) => row.parentId !== null && row.custom) as any,
      rules: [{ validate: (v: unknown) => !v || String(v).trim().length >= 3 || 'Name is too short. Please re-enter.', message: 'Min 3 characters' }],
      cellRenderer: (container, ctx) => {
        const row = ctx.row as ProgramRow;
        const isParent = row.parentId === null;
        container.textContent = row.name || '';
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.color = '#101828';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        container.style.paddingLeft = row.custom ? '' : '14px';
      },
    },
    // ── Col 3: Duration (center-aligned, wrapping header) ─────────────
    {
      id: 'duration', accessorKey: 'duration',
      header: (() => {
        const el = document.createElement('span');
        el.textContent = 'Duration (months)';
        el.style.whiteSpace = 'normal';
        el.style.lineHeight = '1.4';
        el.style.textAlign = 'center';
        el.style.display = 'block';
        return el;
      }) as any,
      width: 90, align: 'center' as const,
      editable: ((row: ProgramRow) => row.parentId !== null) as any,
      rules: [{ validate: (v: unknown) => { if (v == null || v === '') return true; const n = Number(v); return (Number.isInteger(n) && n >= 1 && n <= 999) || 'Duration must be 1-999'; } }],
      cellRenderer: (container, ctx) => {
        const row = ctx.row as ProgramRow;
        const isParent = row.parentId === null;
        container.textContent = row.duration != null ? String(row.duration) : '';
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.color = '#101828';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
      },
    },
    // ── Col 4: Start (left-aligned) ─────────────────────────────────────
    {
      id: 'start', accessorKey: 'start', header: (() => { const el = document.createElement('span'); el.textContent = 'Start'; el.style.paddingLeft = '8px'; return el; }) as any, width: 110, placeholder: 'MM/YY',
      editor: 'masked' as const, mask: 'MM/YY',
      rules: [
        { validate: (v: unknown) => { if (!v || v === '') return true; const s = String(v); return /^\d{4}-\d{2}-\d{2}$/.test(s) || 'Invalid date'; } },
        { validate: (_v: unknown, row: unknown) => {
          const r = row as ProgramRow;
          if (!r.start || !r.parentId) return true;
          const parent = data.find(d => d.id === r.parentId);
          if (!parent?.start || !parent?.end) return true;
          const childCol = toColIndex(r.start);
          const parentStartCol = toColIndex(parent.start);
          const parentEndCol = toColIndex(parent.end);
          if (childCol < parentStartCol) return `Start before parent (${formatMonYY(parent.start)})`;
          if (childCol > parentEndCol) return `Start after parent end (${formatMonYY(parent.end)})`;
          return true;
        }},
      ],
      valueModifier: {
        format: (v: unknown) => {
          if (!v || typeof v !== 'string') return '';
          const s = v as string;
          const [yStr, mStr] = s.split('-');
          if (!yStr || !mStr) return '';
          return `${mStr}/${yStr.slice(2)}`;
        },
        parse: (v: string) => {
          if (!v || !v.includes('/')) return v;
          const [mm, yy] = v.split('/');
          const year = 2000 + parseInt(yy || '0', 10);
          const month = parseInt(mm || '1', 10);
          return `${year}-${String(month).padStart(2, '0')}-01`;
        },
      },
      editable: ((row: ProgramRow) => row.parentId !== null) as any,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as ProgramRow;
        const isParent = row.parentId === null;
        container.textContent = row.start ? formatMonYY(row.start) : '';
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.color = '#282F3D';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        if (isParent) container.style.paddingLeft = '14px';
      },
    },
    // ── Col 5: End (left-aligned, always read-only) ───────────────────
    {
      id: 'end', accessorKey: 'end', header: (() => { const el = document.createElement('span'); el.textContent = 'End'; el.style.paddingLeft = '8px'; return el; }) as any, width: 110, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as ProgramRow;
        const isParent = row.parentId === null;
        container.textContent = formatMonYY(row.end);
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.color = isParent ? '#101828' : '#282F3D';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        container.style.paddingLeft = '14px';
      },
    },
    // ── Col 6: Collapse/expand arrow (handled by hierarchy plugin) ────
    {
      id: 'collapse', header: '', width: 55, editable: false,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as ProgramRow;
        container.style.backgroundColor = row.parentId === null ? '#F8F8F8' : '';
      },
    },
    // ── Monthly Gantt columns (100px each) ────────────────────────────
    ...months.map(m => ({
      id: m.key,
      accessorKey: m.key,
      header: m.label,
      align: 'center' as const,
      width: 111,
      cellType: 'gantt' as const,
      editable: false,
    })),
  ], []);

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', dateFormat: 'month-year' }),
      editing({ editTrigger: 'click', inputStyle: true }),
      hierarchy({ toggleColumn: 'collapse', toggleStyle: 'chevron' }),
      rowActions({
        column: 'actions',
        getActions: (row): RowAction[] | undefined => {
          const r = row as ProgramRow;
          if (r.parentId === null) return undefined; // no menu for parents
          const actions: RowAction[] = [
            { id: 'add', label: 'Add', icon: RowActionIcons.plus },
          ];
          if (r.custom) {
            actions.push({ id: 'delete', label: 'Delete', icon: RowActionIcons.trash });
          }
          return actions;
        },
        onAction: (actionId, row, _rowIndex) => {
          const r = row as ProgramRow;
          if (actionId === 'add') {
            console.log('Add child under parent', r.parentId);
          } else if (actionId === 'delete') {
            console.log('Delete custom row', r.id, r.code);
          }
        },
      }),
      cellRenderers(),
      gantt({
        dateColumnPrefix: 'm_',
        startColumnField: 'startColumn',
        endColumnField: 'endColumn',
        colors: { neutral: '#86D9FC', ahead: '#86D9FC', late: '#86D9FC' },
        parentColor: '#518BAA',
        barHeight: 0.55,
        parentRowBackground: '#F8F8F8',
        // Drag updates Start, Duration, End fields
        startDateField: 'start',
        durationField: 'duration',
        endDateField: 'end',
        columnToDate: (colIndex: number) => {
          const y = BASE_YEAR + Math.floor((BASE_MONTH + colIndex) / 12);
          const m = (BASE_MONTH + colIndex) % 12;
          return `${y}-${String(m + 1).padStart(2, '0')}-01`;
        },
        columnsToDuration: (startCol: number, endCol: number) => endCol - startCol + 1,
        formatDate: (dateStr: string) => {
          if (!dateStr) return '';
          return formatMonYY(dateStr);
        },
      }),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-program' }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<ProgramRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 7,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    headerHeight: 44,
    hierarchy: {
      getRowId: (row: ProgramRow) => row.id,
      getParentId: (row: ProgramRow) => row.parentId,
      defaultExpanded: true,
    },
    rowHeight: 44,
  });

  const handleExpandAll = useCallback(() => grid.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.collapseAll(), [grid]);
  const handleExportCsv = useCallback(() => {
    grid.getPlugin<{ exportToCsv: () => void }>('export')?.exportToCsv();
  }, [grid]);
  const handleExportExcel = useCallback(() => {
    grid.getPlugin<{ exportToExcel: () => void }>('export')?.exportToExcel();
  }, [grid]);
  const handleUndo = useCallback(() => {
    grid.getPlugin<{ undo: () => void }>('undoRedo')?.undo();
  }, [grid]);
  const handleRedo = useCallback(() => {
    grid.getPlugin<{ redo: () => void }>('undoRedo')?.redo();
  }, [grid]);

  const btnStyle = { padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 } as const;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>FSBT Program</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleExpandAll} style={btnStyle}>Expand All</button>
          <button onClick={handleCollapseAll} style={btnStyle}>Collapse All</button>
          <button onClick={handleUndo} style={btnStyle}>Undo</button>
          <button onClick={handleRedo} style={btnStyle}>Redo</button>
          <button onClick={handleExportCsv} style={btnStyle}>CSV</button>
          <button onClick={handleExportExcel} style={btnStyle}>Excel</button>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Feasibility project program timeline with Gantt chart visualization.
      </p>
      <div
        ref={containerRef}
        style={{
          height: 700,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 12,
        }}
      />
    </div>
  );
}
