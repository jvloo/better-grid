import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, editing, hierarchy, cellRenderers, clipboard, undoRedo, exportPlugin, gantt } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface TimelineRow {
  id: number;
  parentId: number | null;
  code: string;
  parentCode: string;
  isParent: boolean;
  phase: string;
  duration: number;
  start: string;
  end: string;
  variance: number;
  status: string;
  isCustom: boolean;
  collapsed: boolean;
  startColumn: number;
  endColumn: number;
  [key: string]: string | number | boolean | null;
}

const data: TimelineRow[] = [
  // Pre-Development
  { id: 1, parentId: null, code: '1', parentCode: '', isParent: true, phase: 'Pre-Development', duration: 18, start: '2025-01-01', end: '2026-06-30', variance: 0, status: '', isCustom: false, collapsed: false, startColumn: 0, endColumn: 17 },
  { id: 2, parentId: 1, code: '1.1', parentCode: '1', isParent: false, phase: 'Site Acquisition', duration: 3, start: '2025-01-01', end: '2025-03-31', variance: 0, status: 'Done', isCustom: false, collapsed: false, startColumn: 0, endColumn: 2 },
  { id: 3, parentId: 1, code: '1.2', parentCode: '1', isParent: false, phase: 'Due Diligence', duration: 4, start: '2025-04-01', end: '2025-07-31', variance: 1, status: 'Done', isCustom: false, collapsed: false, startColumn: 3, endColumn: 6 },
  { id: 4, parentId: 1, code: '1.3', parentCode: '1', isParent: false, phase: 'Planning Approval', duration: 8, start: '2025-08-01', end: '2026-03-31', variance: -2, status: 'Delayed', isCustom: false, collapsed: false, startColumn: 7, endColumn: 14 },
  { id: 5, parentId: 1, code: '1.4', parentCode: '1', isParent: false, phase: 'Pre-Construction', duration: 3, start: '2026-04-01', end: '2026-06-30', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 15, endColumn: 17 },

  // Design
  { id: 6, parentId: null, code: '2', parentCode: '', isParent: true, phase: 'Design', duration: 14, start: '2025-04-01', end: '2026-05-31', variance: 0, status: '', isCustom: false, collapsed: false, startColumn: 3, endColumn: 16 },
  { id: 7, parentId: 6, code: '2.1', parentCode: '2', isParent: false, phase: 'Concept Design', duration: 3, start: '2025-04-01', end: '2025-06-30', variance: 0, status: 'Done', isCustom: false, collapsed: false, startColumn: 3, endColumn: 5 },
  { id: 8, parentId: 6, code: '2.2', parentCode: '2', isParent: false, phase: 'Schematic Design', duration: 4, start: '2025-07-01', end: '2025-10-31', variance: 0, status: 'Done', isCustom: false, collapsed: false, startColumn: 6, endColumn: 9 },
  { id: 9, parentId: 6, code: '2.3', parentCode: '2', isParent: false, phase: 'Design Development', duration: 4, start: '2025-11-01', end: '2026-02-28', variance: -1, status: 'Delayed', isCustom: false, collapsed: false, startColumn: 10, endColumn: 13 },
  { id: 10, parentId: 6, code: '2.4', parentCode: '2', isParent: false, phase: 'Construction Documentation', duration: 3, start: '2026-03-01', end: '2026-05-31', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 14, endColumn: 16 },

  // Construction
  { id: 11, parentId: null, code: '3', parentCode: '', isParent: true, phase: 'Construction', duration: 24, start: '2026-07-01', end: '2028-06-30', variance: -1, status: '', isCustom: false, collapsed: false, startColumn: 18, endColumn: 41 },
  { id: 12, parentId: 11, code: '3.1', parentCode: '3', isParent: false, phase: 'Early Works & Demolition', duration: 3, start: '2026-07-01', end: '2026-09-30', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 18, endColumn: 20 },
  { id: 13, parentId: 11, code: '3.2', parentCode: '3', isParent: false, phase: 'Structure', duration: 8, start: '2026-10-01', end: '2027-05-31', variance: -1, status: 'Delayed', isCustom: false, collapsed: false, startColumn: 21, endColumn: 28 },
  { id: 14, parentId: 11, code: '3.3', parentCode: '3', isParent: false, phase: 'Facade & Envelope', duration: 6, start: '2027-04-01', end: '2027-09-30', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 27, endColumn: 32 },
  { id: 15, parentId: 11, code: '3.4', parentCode: '3', isParent: false, phase: 'Fitout & Services', duration: 8, start: '2027-08-01', end: '2028-03-31', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 31, endColumn: 38 },
  { id: 16, parentId: 11, code: '3.5', parentCode: '3', isParent: false, phase: 'Defects Liability', duration: 3, start: '2028-04-01', end: '2028-06-30', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 39, endColumn: 41 },

  // Sales & Settlement
  { id: 17, parentId: null, code: '4', parentCode: '', isParent: true, phase: 'Sales & Settlement', duration: 18, start: '2027-07-01', end: '2028-12-31', variance: 1, status: '', isCustom: false, collapsed: false, startColumn: 30, endColumn: 47 },
  { id: 18, parentId: 17, code: '4.1', parentCode: '4', isParent: false, phase: 'Pre-Sales Campaign', duration: 6, start: '2027-07-01', end: '2027-12-31', variance: 1, status: 'On Time', isCustom: false, collapsed: false, startColumn: 30, endColumn: 35 },
  { id: 19, parentId: 17, code: '4.2', parentCode: '4', isParent: false, phase: 'Settlement Period', duration: 12, start: '2028-01-01', end: '2028-12-31', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 36, endColumn: 47 },

  // Post-Completion
  { id: 20, parentId: null, code: '5', parentCode: '', isParent: true, phase: 'Post-Completion', duration: 12, start: '2029-01-01', end: '2029-12-31', variance: 0, status: '', isCustom: false, collapsed: false, startColumn: 48, endColumn: 59 },
  { id: 21, parentId: 20, code: '5.1', parentCode: '5', isParent: false, phase: 'Final Accounts', duration: 3, start: '2029-01-01', end: '2029-03-31', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 48, endColumn: 50 },
  { id: 22, parentId: 20, code: '5.2', parentCode: '5', isParent: false, phase: 'Warranty Period', duration: 12, start: '2029-01-01', end: '2029-12-31', variance: 0, status: 'On Time', isCustom: false, collapsed: false, startColumn: 48, endColumn: 59 },
];

// Monthly columns: Jan 2025 – Dec 2029 (60 months, AU FY)
const ts = timeSeries({
  start: '2025-01-01',
  end: '2029-12-01',
  locale: 'en-AU',
  fiscalYearStart: 7,
  columnWidth: 70,
  columnDefaults: {
    cellType: 'gantt' as never,
  },
});

export function DmTimeline() {
  const columns = useMemo<ColumnDef<TimelineRow>[]>(
    () => [
      {
        id: 'actions', header: '', width: 80,
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
      { id: 'phase', accessorKey: 'phase', header: 'Phase', width: 300 },
      { id: 'duration', accessorKey: 'duration', header: 'Duration (months)', width: 90, align: 'center' as const },
      { id: 'start', accessorKey: 'start', header: 'Start', width: 100, align: 'center' as const, cellType: 'date' as const, dateFormat: 'month-year' as const },
      { id: 'end', accessorKey: 'end', header: 'End', width: 100, align: 'center' as const, cellType: 'date' as const, dateFormat: 'month-year' as const },
      {
        id: 'status', accessorKey: 'status', header: 'Variance', width: 120,
        cellType: 'badge' as const,
        options: [
          { value: 'Done', label: 'Done', color: '#166534', bg: '#dcfce7', fontWeight: '500' },
          { value: 'On Time', label: 'On Time', color: '#0c4a6e', bg: '#e0f2fe', border: '1px solid #7dd3fc', fontWeight: '500' },
          { value: 'Delayed', label: 'Delayed', color: '#991b1b', bg: '#fee2e2', fontWeight: '500' },
        ],
      },
      ...ts.columns,
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', dateFormat: 'month-year' }),
      editing({ editTrigger: 'dblclick' }),
      hierarchy({ indentColumn: 'phase', indentSize: 22 }),
      cellRenderers(),
      gantt({ dateColumnPrefix: 'm_', startColumnField: 'startColumn', endColumnField: 'endColumn', varianceField: 'variance' }),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'dm-timeline' }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<TimelineRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 6,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    hierarchy: {
      getRowId: (row: TimelineRow) => row.id,
      getParentId: (row: TimelineRow) => row.parentId,
      defaultExpanded: true,
    },
    selection: { mode: 'range' as const },
    headerHeight: 44,
    rowHeight: 44,
  });

  const handleExpandAll = useCallback(() => grid.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.collapseAll(), [grid]);
  const handleExportCsv = useCallback(() => grid.plugins.export?.exportToCsv(), [grid]);
  const handleExportExcel = useCallback(() => grid.plugins.export?.exportToExcel(), [grid]);
  const handleUndo = useCallback(() => grid.plugins.undoRedo?.undo(), [grid]);
  const handleRedo = useCallback(() => grid.plugins.undoRedo?.redo(), [grid]);

  const btnStyle = { padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 } as const;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>DM Timeline</h1>
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
        Development management project timeline with 60-month Gantt visualization. Drag bars to move phases, resize edges to adjust duration.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, hierarchy, cellRenderers, gantt, clipboard, undoRedo, export &bull;
        <strong> Core:</strong> frozenLeftColumns, hierarchy
      </div>
      <div
        ref={containerRef}
        style={{
          height: 560,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          
          borderRadius: 12,
        }}
      />
    </div>
  );
}
