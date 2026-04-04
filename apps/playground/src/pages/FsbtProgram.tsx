import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, hierarchy, cellRenderers, clipboard, undoRedo, exportPlugin, gantt, rowActions, RowActionIcons } from '@better-grid/plugins';
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

let nextId = 100; // custom rows start at 100+

/** Generate 3 empty custom rows for a parent */
function customRows(parentId: number, parentCode: string, startIndex: number): ProgramRow[] {
  const rows: ProgramRow[] = [];
  for (let i = 0; i < 3; i++) {
    rows.push({
      id: nextId++,
      parentId,
      code: `${parentCode}.${startIndex + i}`,
      name: '',
      duration: null,
      start: '',
      end: '',
      custom: true,
      startColumn: -1,
      endColumn: -1,
    });
  }
  return rows;
}

const data: ProgramRow[] = [
  // ── Phase 1: Acquisition ──────────────────────────────────────────────
  { id: 1, parentId: null, code: '1', name: 'Acquisition', duration: 3, start: '2025-07-01', end: '2025-09-30', custom: false, startColumn: 0, endColumn: 2 },
  { id: 2, parentId: 1, code: '1.1', name: 'Due Diligence', duration: 1, start: '2025-07-01', end: '2025-07-31', custom: false, startColumn: 0, endColumn: 0 },
  { id: 3, parentId: 1, code: '1.2', name: 'Deposit', duration: 1, start: '2025-08-01', end: '2025-08-31', custom: false, startColumn: 1, endColumn: 1 },
  { id: 4, parentId: 1, code: '1.3', name: 'Settlement', duration: 1, start: '2025-09-01', end: '2025-09-30', custom: false, startColumn: 2, endColumn: 2 },
  ...customRows(1, '1', 4),

  // ── Phase 2: Planning And Design ──────────────────────────────────────
  { id: 5, parentId: null, code: '2', name: 'Planning And Design', duration: 18, start: '2025-10-01', end: '2027-03-31', custom: false, startColumn: 3, endColumn: 20 },
  { id: 6, parentId: 5, code: '2.1', name: 'Design Prep', duration: 4, start: '2025-10-01', end: '2026-01-31', custom: false, startColumn: 3, endColumn: 6 },
  { id: 7, parentId: 5, code: '2.2', name: 'Planning Assessment', duration: 7, start: '2026-02-01', end: '2026-08-31', custom: false, startColumn: 7, endColumn: 13 },
  { id: 8, parentId: 5, code: '2.6', name: '50% Detail Design', duration: 2, start: '2026-09-01', end: '2026-10-31', custom: false, startColumn: 14, endColumn: 15 },
  { id: 9, parentId: 5, code: '2.7', name: '70% Detail Design', duration: 2, start: '2026-11-01', end: '2026-12-31', custom: false, startColumn: 16, endColumn: 17 },
  { id: 10, parentId: 5, code: '2.8', name: '100% Detail Design', duration: 3, start: '2027-01-01', end: '2027-03-31', custom: false, startColumn: 18, endColumn: 20 },
  ...customRows(5, '2', 3),

  // ── Phase 3: Construction And Building Works ──────────────────────────
  { id: 11, parentId: null, code: '3', name: 'Construction And Building Works', duration: 18, start: '2027-04-01', end: '2028-09-30', custom: false, startColumn: 21, endColumn: 38 },
  { id: 12, parentId: 11, code: '3.1', name: 'Demolition', duration: 3, start: '2027-04-01', end: '2027-06-30', custom: false, startColumn: 21, endColumn: 23 },
  { id: 13, parentId: 11, code: '3.2', name: 'Excavation', duration: 3, start: '2027-07-01', end: '2027-09-30', custom: false, startColumn: 24, endColumn: 26 },
  { id: 14, parentId: 11, code: '3.3', name: 'Main Works', duration: 12, start: '2027-10-01', end: '2028-09-30', custom: false, startColumn: 27, endColumn: 38 },
  ...customRows(11, '3', 4),

  // ── Phase 4: Marketing And Sales ──────────────────────────────────────
  { id: 15, parentId: null, code: '4', name: 'Marketing And Sales', duration: 15, start: '2027-07-01', end: '2028-09-30', custom: false, startColumn: 24, endColumn: 38 },
  { id: 16, parentId: 15, code: '4.1', name: 'Marketing Prep', duration: 2, start: '2027-07-01', end: '2027-08-31', custom: false, startColumn: 24, endColumn: 25 },
  { id: 17, parentId: 15, code: '4.2', name: 'Marketing Activity', duration: 6, start: '2027-09-01', end: '2028-02-28', custom: false, startColumn: 26, endColumn: 31 },
  { id: 18, parentId: 15, code: '4.3', name: 'Sales Period', duration: 6, start: '2028-03-01', end: '2028-08-31', custom: false, startColumn: 32, endColumn: 37 },
  { id: 19, parentId: 15, code: '4.4', name: 'Settlement Management', duration: 1, start: '2028-09-01', end: '2028-09-30', custom: false, startColumn: 38, endColumn: 38 },
  ...customRows(15, '4', 5),

  // ── Phase 5: Operation/Asset Management ───────────────────────────────
  { id: 20, parentId: null, code: '5', name: 'Operation/Asset Management', duration: 43, start: '2028-10-01', end: '2032-04-30', custom: false, startColumn: 39, endColumn: 81 },
  { id: 21, parentId: 20, code: '5.1', name: 'Lease Up Period', duration: 6, start: '2028-10-01', end: '2029-03-31', custom: false, startColumn: 39, endColumn: 44 },
  { id: 22, parentId: 20, code: '5.2', name: 'Holding Period', duration: 36, start: '2029-04-01', end: '2032-03-31', custom: false, startColumn: 45, endColumn: 80 },
  { id: 23, parentId: 20, code: '5.3', name: 'Termination', duration: 1, start: '2032-04-01', end: '2032-04-30', custom: false, startColumn: 81, endColumn: 81 },
  ...customRows(20, '5', 4),
];

// Generate 48 monthly columns (Jul 2025 - Jun 2029) with short month headers
const months: { key: string; label: string }[] = [];
for (let i = 0; i < 48; i++) {
  const d = new Date(2025, 6 + i);
  const key = `m_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('en-AU', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  months.push({ key, label });
}

/** Format date as "Mon yy" (e.g. "Apr 26") */
function formatMonYY(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-AU', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
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
      id: 'name', accessorKey: 'name', header: 'Phase', width: 236,
      editable: ((row: ProgramRow) => row.parentId !== null && row.custom) as any,
      cellRenderer: (container, ctx) => {
        const row = ctx.row as ProgramRow;
        const isParent = row.parentId === null;
        container.textContent = row.name || '';
        container.style.fontSize = '12px';
        container.style.fontWeight = isParent ? '500' : '400';
        container.style.color = '#101828';
        container.style.backgroundColor = isParent ? '#F8F8F8' : '';
        container.style.paddingLeft = isParent ? '8px' : '28px';
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
      id: 'start', accessorKey: 'start', header: 'Start', width: 110, placeholder: 'MM/YY',
      valueModifier: {
        format: (v: unknown) => {
          if (!v || typeof v !== 'string') return '';
          const d = new Date(v as string);
          return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2);
        },
        parse: (v: string) => {
          if (!v || !v.includes('/')) return v;
          const [mm, yy] = v.split('/');
          const year = 2000 + parseInt(yy || '0', 10);
          const month = parseInt(mm || '1', 10) - 1;
          return new Date(year, month, 1).toISOString().split('T')[0];
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
      id: 'end', accessorKey: 'end', header: 'End', width: 110, editable: false,
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
        barHeight: 0.43,
        parentRowBackground: '#F8F8F8',
      }),
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
