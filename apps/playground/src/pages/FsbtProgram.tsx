import { useMemo, useCallback, useRef, useState } from 'react';
import { useGrid } from '@better-grid/react';
import type { CellChange, ColumnDef } from '@better-grid/core';
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
// Data from QA app project 4288: https://qa-app.wiseway.ai/projects/4288/program
// Base month: Aug 2023 (month index 0). 39 months total (Aug 2023 – Oct 2026).
// ---------------------------------------------------------------------------

const BASE_YEAR = 2023;
const BASE_MONTH = 7; // August (0-indexed)

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

const INITIAL_PROGRAM_DATA: ProgramRow[] = [
  // ── Phase 1: Acquisition (Aug 23 – Jan 24, 6 months) ─────────────────
  r(1, null, '1', 'Acquisition', 6, 'Aug 23', 'Jan 24'),
  r(2, 1, '1.1', 'Due Diligence', 4, 'Aug 23', 'Nov 23'),
  r(3, 1, '1.2', 'Deposit', 1, 'Aug 23', 'Aug 23'),
  r(4, 1, '1.3', 'Settlement', 1, 'Jan 24', 'Jan 24'),
  ...customRows(1, '1', 4),

  // ── Phase 2: Planning And Design (Aug 23 – Mar 25, 20 months) ────────
  r(5, null, '2', 'Planning And Design', 20, 'Aug 23', 'Mar 25'),
  r(6, 5, '2.1', 'Design Prep To Lodgement', 3, 'Aug 23', 'Oct 23'),
  r(7, 5, '2.2', 'Planning Assessment', 3, 'Nov 23', 'Jan 24'),
  r(8, 5, '2.3', 'Civil And Administrative Tribunal', 6, 'Nov 23', 'Apr 24'),
  r(9, 5, '2.4', 'Prepare Design Amendment', 3, 'May 24', 'July 24'),
  r(10, 5, '2.5', 'Amendment Approval', 2, 'Aug 24', 'Sept 24'),
  r(11, 5, '2.6', '50% Detail Design', 2, 'Oct 24', 'Nov 24'),
  r(12, 5, '2.7', '70% Detail Design', 2, 'Dec 24', 'Jan 25'),
  r(13, 5, '2.8', '100% Detail Design', 2, 'Feb 25', 'Mar 25'),

  // ── Phase 3: Construction And Building Works (Oct 24 – Sept 26, 24 months) ──
  r(14, null, '3', 'Construction And Building Works', 24, 'Oct 24', 'Sept 26'),
  r(15, 14, '3.1', 'Demolition', 3, 'Oct 24', 'Dec 24'),
  r(16, 14, '3.2', 'Early Work/Excavation', 6, 'Jan 25', 'June 25'),
  r(17, 14, '3.3', 'Main Works', 18, 'Apr 25', 'Sept 26'),

  // ── Phase 4: Marketing And Sales (Mar 25 – Oct 26, 20 months) ────────
  r(18, null, '4', 'Marketing And Sales', 20, 'Mar 25', 'Oct 26'),
  r(19, 18, '4.1', 'Marketing Prep', 6, 'Mar 25', 'Aug 25'),
  r(20, 18, '4.2', 'Marketing Activity', 13, 'Sep 25', 'Sept 26'),
  r(21, 18, '4.3', 'Sales/Leasing Period', 13, 'Sep 25', 'Sept 26'),
  r(22, 18, '4.4', 'Settlement Management', 1, 'Oct 26', 'Oct 26'),

  // ── Phase 5: Operation/Asset Management (Oct 26, 1 month) ────────────
  r(23, null, '5', 'Operation/Asset Management', 1, 'Oct 26', 'Oct 26'),
  r(24, 23, '5.1', 'Lease Up Period', 1, 'Oct 26', 'Oct 26'),
  r(25, 23, '5.2', 'Holding Period', 1, 'Oct 26', 'Oct 26'),
  r(26, 23, '5.3', 'Termination', 1, 'Oct 26', 'Oct 26'),
];

const MAX_CUSTOM_ROWS_PER_PARENT = 3;

// Generate monthly columns covering full project range (Aug 2023 – Oct 2026 = 39 months)
const MONTH_COUNT = 39;
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

function columnToDate(colIndex: number): string {
  const y = BASE_YEAR + Math.floor((BASE_MONTH + colIndex) / 12);
  const m = (BASE_MONTH + colIndex) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

function coerceDuration(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function normalizeProgramRows(rows: ProgramRow[]): ProgramRow[] {
  const next = rows.map(row => ({ ...row }));

  for (const row of next) {
    if (row.parentId === null) continue;

    const duration = coerceDuration(row.duration);
    if (!row.start || duration == null) {
      row.duration = duration;
      row.end = '';
      row.startColumn = row.start ? toColIndex(row.start) : -1;
      row.endColumn = -1;
      continue;
    }

    const startColumn = toColIndex(row.start);
    row.duration = duration;
    row.startColumn = startColumn;
    row.endColumn = startColumn >= 0 ? startColumn + duration - 1 : -1;
    row.end = row.endColumn >= 0 ? columnToDate(row.endColumn) : '';
  }

  for (const parent of next.filter(row => row.parentId === null)) {
    const scheduledChildren = next.filter(row =>
      row.parentId === parent.id && row.startColumn >= 0 && row.endColumn >= row.startColumn,
    );
    if (scheduledChildren.length === 0) continue;

    const startColumn = Math.min(...scheduledChildren.map(row => row.startColumn));
    const endColumn = Math.max(...scheduledChildren.map(row => row.endColumn));
    parent.startColumn = startColumn;
    parent.endColumn = endColumn;
    parent.start = columnToDate(startColumn);
    parent.end = columnToDate(endColumn);
    parent.duration = endColumn - startColumn + 1;
  }

  return next;
}

function renumberCustomChildren(rows: ProgramRow[], parentId: number): ProgramRow[] {
  const parent = rows.find(row => row.id === parentId);
  if (!parent) return rows;

  const regularSuffixes = rows
    .filter(row => row.parentId === parentId && !row.custom)
    .map(row => Number(row.code.split('.').at(-1)))
    .filter(Number.isFinite);
  let nextSuffix = Math.max(0, ...regularSuffixes) + 1;

  return rows.map(row => {
    if (row.parentId !== parentId || !row.custom) return row;
    return { ...row, code: `${parent.code}.${nextSuffix++}` };
  });
}

function insertCustomRow(rows: ProgramRow[], sourceRow: ProgramRow): ProgramRow[] {
  const parentId = sourceRow.parentId ?? sourceRow.id;
  const parent = rows.find(row => row.id === parentId);
  if (!parent) return rows;

  const customCount = rows.filter(row => row.parentId === parentId && row.custom).length;
  if (customCount >= MAX_CUSTOM_ROWS_PER_PARENT) return rows;

  const nextId = Math.max(...rows.map(row => row.id)) + 1;
  const children = rows.filter(row => row.parentId === parentId);
  const lastChildIndex = Math.max(...children.map(child => rows.findIndex(row => row.id === child.id)));
  const insertIndex = lastChildIndex >= 0 ? lastChildIndex + 1 : rows.findIndex(row => row.id === parentId) + 1;
  const row: ProgramRow = {
    id: nextId,
    parentId,
    code: `${parent.code}.0`,
    name: '',
    duration: null,
    start: '',
    end: '',
    custom: true,
    startColumn: -1,
    endColumn: -1,
  };

  const next = [...rows.slice(0, insertIndex), row, ...rows.slice(insertIndex)];
  return normalizeProgramRows(renumberCustomChildren(next, parentId));
}

function deleteCustomRow(rows: ProgramRow[], sourceRow: ProgramRow): ProgramRow[] {
  if (!sourceRow.custom || sourceRow.parentId == null) return rows;
  const next = rows.filter(row => row.id !== sourceRow.id);
  return normalizeProgramRows(renumberCustomChildren(next, sourceRow.parentId));
}

export function FsbtProgram() {
  const [rows, setRows] = useState(() => normalizeProgramRows(INITIAL_PROGRAM_DATA));
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const handleProgramDataChange = useCallback((changes: CellChange<ProgramRow>[]) => {
    setRows(prevRows => {
      let changed = false;
      const byId = new Map(changes.map(change => [change.row.id, change.row]));
      const nextRows = prevRows.map(row => {
        const updated = byId.get(row.id);
        if (!updated) return row;
        changed = true;
        return { ...row, ...updated };
      });

      return changed ? normalizeProgramRows(nextRows) : prevRows;
    });
  }, []);

  const handleRowAction = useCallback((actionId: string, row: unknown) => {
    const sourceRow = row as ProgramRow;
    setRows(prevRows => {
      if (actionId === 'add') return insertCustomRow(prevRows, sourceRow);
      if (actionId === 'delete') return deleteCustomRow(prevRows, sourceRow);
      return prevRows;
    });
  }, []);

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
      id: 'duration', accessorKey: 'duration', cellType: 'number' as const, min: 1, max: 999,
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
          const parent = rowsRef.current.find(d => d.id === r.parentId);
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
          const digits = v.replace(/\D/g, '').slice(0, 4);
          if (digits.length === 0) return '';
          if (digits.length < 4) return undefined;

          const month = digits.slice(0, 2);
          const yearSuffix = digits.slice(2, 4);
          if (!/^(0[1-9]|1[0-2])$/.test(month)) return undefined;

          const year = 2000 + Number(yearSuffix);
          return `${year}-${month}-01`;
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
          const customCount = rowsRef.current.filter(candidate => candidate.parentId === r.parentId && candidate.custom).length;
          const actions: RowAction[] = [
            {
              id: 'add',
              label: 'Add',
              icon: RowActionIcons.plus,
              disabled: customCount >= MAX_CUSTOM_ROWS_PER_PARENT,
              disabledTooltip: `Maximum ${MAX_CUSTOM_ROWS_PER_PARENT} custom rows reached`,
            },
          ];
          if (r.custom) {
            actions.push({ id: 'delete', label: 'Delete', icon: RowActionIcons.trash });
          }
          return actions;
        },
        onAction: handleRowAction,
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
        columnToDate,
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
    [handleRowAction],
  );

  const { grid, containerRef } = useGrid<ProgramRow>({
    data: rows,
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
    onDataChange: handleProgramDataChange,
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
    <div className="fsbt-program-demo">
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
