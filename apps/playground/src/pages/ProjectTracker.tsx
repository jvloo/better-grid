import { useMemo, useState, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, sorting, filtering, validation, cellRenderers, undoRedo, clipboard, search, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface TaskRow {
  id: number;
  task: string;
  assignee: string;
  priority: string;
  status: string;
  dueDate: string;
  estimate: number;
  progress: number;
  rating: number;
  active: boolean;
  tags: string;
}

const initialData: TaskRow[] = [
  { id: 1, task: 'Setup CI/CD pipeline', assignee: 'Alice', priority: 'High', status: 'Done', dueDate: '2026-03-01', estimate: 8, progress: 1, rating: 5, active: true, tags: 'devops' },
  { id: 2, task: 'Design landing page', assignee: 'Bob', priority: 'Medium', status: 'In Progress', dueDate: '2026-03-15', estimate: 16, progress: 0.6, rating: 4, active: true, tags: 'design' },
  { id: 3, task: 'Implement auth module', assignee: 'Carol', priority: 'High', status: 'In Progress', dueDate: '2026-03-10', estimate: 24, progress: 0.35, rating: 3, active: true, tags: 'backend' },
  { id: 4, task: 'Write API docs', assignee: 'David', priority: 'Low', status: 'Todo', dueDate: '2026-03-20', estimate: 12, progress: 0, rating: 2, active: false, tags: 'docs' },
  { id: 5, task: 'User testing round 1', assignee: 'Emma', priority: 'Medium', status: 'Todo', dueDate: '2026-03-25', estimate: 20, progress: 0, rating: 3, active: true, tags: 'qa' },
  { id: 6, task: 'Database migration', assignee: 'Alice', priority: 'High', status: 'In Review', dueDate: '2026-03-08', estimate: 6, progress: 0.9, rating: 4, active: true, tags: 'backend' },
  { id: 7, task: 'Mobile responsive fixes', assignee: 'Bob', priority: 'Medium', status: 'In Progress', dueDate: '2026-03-12', estimate: 10, progress: 0.45, rating: 3, active: true, tags: 'frontend' },
  { id: 8, task: 'Performance audit', assignee: 'Carol', priority: 'Low', status: 'Todo', dueDate: '2026-04-01', estimate: 16, progress: 0, rating: 2, active: false, tags: 'devops' },
  { id: 9, task: 'Onboarding flow', assignee: 'David', priority: 'High', status: 'In Progress', dueDate: '2026-03-18', estimate: 32, progress: 0.2, rating: 4, active: true, tags: 'frontend' },
  { id: 10, task: 'Security review', assignee: 'Emma', priority: 'High', status: 'Todo', dueDate: '2026-03-22', estimate: 8, progress: 0, rating: 5, active: true, tags: 'security' },
  { id: 11, task: 'Analytics dashboard', assignee: 'Alice', priority: 'Medium', status: 'Todo', dueDate: '2026-04-05', estimate: 40, progress: 0, rating: 3, active: true, tags: 'frontend' },
  { id: 12, task: 'Email notifications', assignee: 'Carol', priority: 'Low', status: 'Done', dueDate: '2026-02-28', estimate: 12, progress: 1, rating: 4, active: false, tags: 'backend' },
  { id: 13, task: 'Container orchestration', assignee: 'Alice', priority: 'High', status: 'In Progress', dueDate: '2026-04-10', estimate: 20, progress: 0.3, rating: 3, active: true, tags: 'devops' },
  { id: 14, task: 'Accessibility audit', assignee: 'Bob', priority: 'Medium', status: 'Todo', dueDate: '2026-04-15', estimate: 14, progress: 0, rating: 2, active: true, tags: 'qa' },
  { id: 15, task: 'Rate limiter middleware', assignee: 'Carol', priority: 'High', status: 'In Review', dueDate: '2026-03-28', estimate: 10, progress: 0.85, rating: 5, active: true, tags: 'security' },
  { id: 16, task: 'Component library docs', assignee: 'David', priority: 'Low', status: 'In Progress', dueDate: '2026-04-20', estimate: 18, progress: 0.15, rating: 3, active: true, tags: 'docs' },
  { id: 17, task: 'Dark mode theme', assignee: 'Bob', priority: 'Medium', status: 'In Progress', dueDate: '2026-04-08', estimate: 12, progress: 0.5, rating: 4, active: true, tags: 'design' },
  { id: 18, task: 'GraphQL API layer', assignee: 'Emma', priority: 'High', status: 'Todo', dueDate: '2026-04-12', estimate: 28, progress: 0, rating: 4, active: true, tags: 'backend' },
  { id: 19, task: 'E2E test suite', assignee: 'Alice', priority: 'Medium', status: 'In Progress', dueDate: '2026-04-18', estimate: 24, progress: 0.4, rating: 3, active: true, tags: 'qa' },
  { id: 20, task: 'Log aggregation pipeline', assignee: 'David', priority: 'Low', status: 'Todo', dueDate: '2026-04-25', estimate: 16, progress: 0, rating: 2, active: false, tags: 'devops' },
];

function makeSummary(rows: TaskRow[]): TaskRow {
  const total = rows.length;
  const done = rows.filter(r => r.status === 'Done').length;
  const avgProgress = rows.reduce((s, r) => s + r.progress, 0) / total;
  const totalEstimate = rows.reduce((s, r) => s + r.estimate, 0);
  const avgRating = Math.round(rows.reduce((s, r) => s + r.rating, 0) / total * 10) / 10;
  return {
    id: -1, task: `${total} tasks`, assignee: `${done} done`, priority: '', status: '',
    dueDate: '', estimate: totalEstimate, progress: avgProgress, rating: avgRating,
    active: true, tags: '',
  };
}

export function ProjectTracker() {
  const [data, setData] = useState(initialData);
  const summaryRow = useMemo(() => makeSummary(data), [data]);

  const columns = useMemo<ColumnDef<TaskRow>[]>(
    () => [
      {
        id: 'task', header: 'Task', width: 200,
        required: true, sortable: true,
      },
      {
        id: 'assignee', header: 'Assignee', width: 120,
        editor: 'autocomplete', options: ['Alice', 'Bob', 'Carol', 'David', 'Emma'],
        meta: { allowCreate: true }, sortable: true,
      },
      {
        id: 'priority', header: 'Priority', width: 90,
        cellType: 'badge', editor: 'dropdown', sortable: true,
        options: [
          { label: 'High', value: 'High', color: '#c62828', bg: '#ffebee' },
          { label: 'Medium', value: 'Medium', color: '#e65100', bg: '#fff3e0' },
          { label: 'Low', value: 'Low', color: '#666', bg: '#f5f5f5' },
        ],
      },
      {
        id: 'status', header: 'Status', width: 120,
        cellType: 'badge', editor: 'dropdown', sortable: true,
        options: [
          { label: 'Todo', value: 'Todo', color: '#666', bg: '#f5f5f5' },
          { label: 'In Progress', value: 'In Progress', color: '#1565c0', bg: '#e3f2fd' },
          { label: 'In Review', value: 'In Review', color: '#e65100', bg: '#fff3e0' },
          { label: 'Done', value: 'Done', color: '#2e7d32', bg: '#e8f5e9' },
        ],
      },
      {
        id: 'dueDate', header: 'Due Date', width: 110,
        cellType: 'date', sortable: true,
      },
      {
        id: 'estimate', header: 'Est', width: 80,
        align: 'right', precision: 0, sortable: true,
        rules: [{ validate: (v) => (v as number) >= 0 || 'Must be >= 0' }],
        cellRenderer: (container, ctx) => {
          const val = ctx.value as number;
          container.textContent = val != null ? `${val}h` : '';
        },
      },
      {
        id: 'progress', header: 'Progress', width: 120,
        cellType: 'progress', sortable: true,
      },
      {
        id: 'rating', header: 'Rating', width: 110,
        cellType: 'rating', sortable: true,
      },
      {
        id: 'active', header: 'Active', width: 70,
        cellType: 'boolean',
      },
      {
        id: 'tags', header: 'Tags', width: 100,
        sortable: true,
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', dateFormat: 'medium' }),
      editing({ editTrigger: 'dblclick' }),
      sorting(),
      filtering(),
      validation({ validateOn: 'commit' }),
      cellRenderers(),
      undoRedo({ maxHistory: 50 }),
      clipboard(),
      search({ caseSensitive: false }),
      exportPlugin({ filename: 'project-tasks' }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<TaskRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 2,
    pinnedBottomRows: [summaryRow],
    selection: { mode: 'range', fillHandle: true },
    onDataChange: (changes) => {
      setData(prev => {
        const next = [...prev];
        for (const c of changes) next[c.rowIndex] = c.row as TaskRow;
        return next;
      });
    },
  });

  const btnStyle = {
    padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6,
    background: '#fff', cursor: 'pointer', fontSize: 12,
  } as const;

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

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Project Tracker</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleUndo} style={btnStyle}>Undo</button>
          <button onClick={handleRedo} style={btnStyle}>Redo</button>
          <button onClick={handleExportCsv} style={btnStyle}>CSV</button>
          <button onClick={handleExportExcel} style={btnStyle}>Excel</button>
        </div>
      </div>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Sprint board with badges, progress bars, star ratings, and inline editing. Ctrl+F to search, Ctrl+Z/Y to undo/redo.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, sorting, filtering, validation, cellRenderers, undoRedo, clipboard, search, export &bull;
        <strong> Core:</strong> frozenLeftColumns, pinnedBottomRows, fillHandle
      </div>

      <div
        ref={containerRef}
        style={{
          height: 540,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
        }}
      />
    </div>
  );
}
