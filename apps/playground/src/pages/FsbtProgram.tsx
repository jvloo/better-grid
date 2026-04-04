import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, hierarchy, cellRenderers, clipboard, undoRedo, exportPlugin, gantt } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface ProgramRow {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  duration: number;
  start: string;
  end: string;
  status: string;
  custom: boolean;
  startColumn: number;
  endColumn: number;
  [key: string]: string | number | boolean | null;
}

const data: ProgramRow[] = [
  // Pre-Development (parent)
  { id: 1, parentId: null, code: '1', name: 'Pre-Development', duration: 12, start: '2025-07-01', end: '2026-06-30', status: '', custom: false, startColumn: 0, endColumn: 11 },
  { id: 2, parentId: 1, code: '1.1', name: 'Due Diligence', duration: 3, start: '2025-07-01', end: '2025-09-30', status: 'Done', custom: false, startColumn: 0, endColumn: 2 },
  { id: 3, parentId: 1, code: '1.2', name: 'DA Lodgement', duration: 2, start: '2025-10-01', end: '2025-11-30', status: 'Done', custom: false, startColumn: 3, endColumn: 4 },
  { id: 4, parentId: 1, code: '1.3', name: 'DA Approval', duration: 4, start: '2025-12-01', end: '2026-03-31', status: 'On Time', custom: false, startColumn: 5, endColumn: 8 },
  { id: 5, parentId: 1, code: '1.4', name: 'CC Approval', duration: 3, start: '2026-04-01', end: '2026-06-30', status: 'On Time', custom: false, startColumn: 9, endColumn: 11 },

  // Construction (parent)
  { id: 6, parentId: null, code: '2', name: 'Construction', duration: 18, start: '2026-07-01', end: '2027-12-31', status: '', custom: false, startColumn: 12, endColumn: 29 },
  { id: 7, parentId: 6, code: '2.1', name: 'Demolition & Excavation', duration: 3, start: '2026-07-01', end: '2026-09-30', status: 'On Time', custom: false, startColumn: 12, endColumn: 14 },
  { id: 8, parentId: 6, code: '2.2', name: 'Substructure', duration: 4, start: '2026-10-01', end: '2027-01-31', status: 'On Time', custom: false, startColumn: 15, endColumn: 18 },
  { id: 9, parentId: 6, code: '2.3', name: 'Superstructure', duration: 6, start: '2027-02-01', end: '2027-07-31', status: 'On Time', custom: false, startColumn: 19, endColumn: 24 },
  { id: 10, parentId: 6, code: '2.4', name: 'Finishes & Fitout', duration: 4, start: '2027-08-01', end: '2027-11-30', status: 'On Time', custom: false, startColumn: 25, endColumn: 28 },
  { id: 11, parentId: 6, code: '2.5', name: 'Landscaping & Handover', duration: 1, start: '2027-12-01', end: '2027-12-31', status: 'On Time', custom: false, startColumn: 29, endColumn: 29 },

  // Sales & Settlement (parent)
  { id: 12, parentId: null, code: '3', name: 'Sales & Settlement', duration: 12, start: '2027-07-01', end: '2028-06-30', status: '', custom: false, startColumn: 24, endColumn: 35 },
  { id: 13, parentId: 12, code: '3.1', name: 'Pre-Sales Launch', duration: 6, start: '2027-07-01', end: '2027-12-31', status: 'On Time', custom: false, startColumn: 24, endColumn: 29 },
  { id: 14, parentId: 12, code: '3.2', name: 'Construction Sales', duration: 3, start: '2028-01-01', end: '2028-03-31', status: 'On Time', custom: false, startColumn: 30, endColumn: 32 },
  { id: 15, parentId: 12, code: '3.3', name: 'Settlement Period', duration: 3, start: '2028-04-01', end: '2028-06-30', status: 'On Time', custom: false, startColumn: 33, endColumn: 35 },
];

const months: { key: string; label: string }[] = [];
for (let i = 0; i < 36; i++) {
  const d = new Date(2025, 6 + i);
  const key = `m_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleString('en-AU', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  months.push({ key, label });
}

export function FsbtProgram() {
  const columns = useMemo<ColumnDef<ProgramRow>[]>(
    () => [
      {
        id: 'actions', header: '', width: 50,
        cellRenderer: (container) => {
          container.textContent = '';
          container.style.display = 'flex';
          container.style.alignItems = 'center';
          container.style.justifyContent = 'center';
          container.style.cursor = 'grab';
          container.style.color = '#999';
          container.style.fontSize = '14px';
          container.style.letterSpacing = '2px';
          container.style.userSelect = 'none';
          container.innerHTML = '<span style="pointer-events:none;line-height:1">&#x22EE;&#x22EE;</span>';
        },
      },
      { id: 'code', accessorKey: 'code', header: 'Code', width: 40, align: 'right' as const },
      { id: 'name', accessorKey: 'name', header: 'Phase', width: 236 },
      { id: 'duration', accessorKey: 'duration', header: 'Duration (months)', width: 110, align: 'right' as const },
      { id: 'start', accessorKey: 'start', header: 'Start', width: 110, align: 'center' as const, cellType: 'date' as const, dateFormat: 'month-year' as const },
      { id: 'end', accessorKey: 'end', header: 'End', width: 110, align: 'center' as const, cellType: 'date' as const, dateFormat: 'month-year' as const },
      {
        id: 'status', accessorKey: 'status', header: '', width: 55,
        cellRenderer: (container, ctx) => {
          container.textContent = '';
          const val = ctx.value as string;
          if (!val) return;
          const pill = document.createElement('span');
          pill.textContent = val;
          pill.style.display = 'inline-block';
          pill.style.padding = '2px 8px';
          pill.style.borderRadius = '12px';
          pill.style.fontSize = '10px';
          pill.style.fontWeight = '500';
          pill.style.whiteSpace = 'nowrap';
          pill.style.lineHeight = 'normal';
          if (val === 'Done') {
            pill.style.backgroundColor = '#dcfce7';
            pill.style.color = '#166534';
          } else if (val === 'On Time') {
            pill.style.backgroundColor = '#e0f2fe';
            pill.style.color = '#0c4a6e';
            pill.style.border = '1px solid #7dd3fc';
          } else if (val === 'Delayed') {
            pill.style.backgroundColor = '#fee2e2';
            pill.style.color = '#991b1b';
          }
          container.appendChild(pill);
        },
      },
      ...months.map(m => ({
        id: m.key,
        accessorKey: m.key,
        header: m.label,
        width: 80,
        cellType: 'gantt' as const,
      })),
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', dateFormat: 'month-year' }),
      editing({ editTrigger: 'dblclick' }),
      hierarchy({ expandColumn: 'name', indentSize: 22 }),
      cellRenderers(),
      gantt({ dateColumnPrefix: 'm_', startColumnField: 'startColumn', endColumnField: 'endColumn', colors: { neutral: '#86D9FC', ahead: '#86D9FC', late: '#86D9FC' }, parentColor: '#518BAA', barHeight: 0.43 }),
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
    hierarchy: {
      getRowId: (row: ProgramRow) => row.id,
      getParentId: (row: ProgramRow) => row.parentId,
      defaultExpanded: true,
    },
    selection: { mode: 'range' as const },
    rowHeight: 56,
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
    const api = grid.getPlugin<{ undo: () => void }>('undoRedo');
    api?.undo();
  }, [grid]);
  const handleRedo = useCallback(() => {
    const api = grid.getPlugin<{ redo: () => void }>('undoRedo');
    api?.redo();
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
        Feasibility project program timeline with Gantt chart visualization. Drag bars to adjust phase dates, resize from edges to extend/shorten phases.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, hierarchy, cellRenderers, gantt, clipboard, undoRedo, export &bull;
        <strong> Core:</strong> frozenLeftColumns, hierarchy
      </div>
      <div
        ref={containerRef}
        style={{
          height: 540,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          
          borderRadius: 12,
        }}
      />
    </div>
  );
}
