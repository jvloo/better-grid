import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, sorting, filtering, validation, clipboard, cellRenderers, undoRedo } from '@better-grid/plugins';
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

const data: TaskRow[] = [
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

export function ProjectTracker() {
  const columns = useMemo<ColumnDef<TaskRow>[]>(
    () => [
      {
        id: 'task',
        header: 'Task',
        width: 200,
        required: true,
        sortable: true,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        width: 120,
        editor: 'autocomplete',
        options: ['Alice', 'Bob', 'Carol', 'David', 'Emma'],
        meta: { allowCreate: true },
        sortable: true,
      },
      {
        id: 'priority',
        header: 'Priority',
        width: 90,
        cellType: 'badge',
        editor: 'dropdown',
        sortable: true,
        options: [
          { label: 'High', value: 'High', color: '#c62828', bg: '#ffebee' },
          { label: 'Medium', value: 'Medium', color: '#e65100', bg: '#fff3e0' },
          { label: 'Low', value: 'Low', color: '#666', bg: '#f5f5f5' },
        ],
      },
      {
        id: 'status',
        header: 'Status',
        width: 120,
        cellType: 'badge',
        editor: 'dropdown',
        sortable: true,
        options: [
          { label: 'Todo', value: 'Todo', color: '#666', bg: '#f5f5f5' },
          { label: 'In Progress', value: 'In Progress', color: '#1565c0', bg: '#e3f2fd' },
          { label: 'In Review', value: 'In Review', color: '#e65100', bg: '#fff3e0' },
          { label: 'Done', value: 'Done', color: '#2e7d32', bg: '#e8f5e9' },
        ],
      },
      {
        id: 'dueDate',
        header: 'Due Date',
        width: 110,
        cellType: 'date',
        sortable: true,
      },
      {
        id: 'estimate',
        header: 'Est',
        width: 80,
        align: 'right',
        precision: 0,
        sortable: true,
        cellRenderer: (container, ctx) => {
          const val = ctx.value as number;
          container.textContent = val != null ? `${val}h` : '';
        },
      },
      {
        id: 'progress',
        header: 'Progress',
        width: 120,
        cellType: 'progress',
        sortable: true,
      },
      {
        id: 'rating',
        header: 'Rating',
        width: 110,
        cellType: 'rating',
        sortable: true,
      },
      {
        id: 'active',
        header: 'Active',
        width: 70,
        cellType: 'boolean',
      },
      {
        id: 'tags',
        header: 'Tags',
        width: 100,
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
      clipboard(),
      cellRenderers(),
      undoRedo(),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Project Tracker</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Project management board with status badges, progress bars, star ratings, and inline editing. Try Ctrl+Z to undo edits.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Edit:</strong> Double-click any cell &bull; Assignee → autocomplete (type to create new) &bull; Priority/Status → dropdown badges
        <br />
        <strong>Explore:</strong> Sort by any column header &bull; Right-click → filter &bull; Ctrl+Z / Ctrl+Y to undo/redo
      </div>

      <BetterGrid<TaskRow>
        columns={columns}
        data={data}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={520}
      />
    </div>
  );
}
