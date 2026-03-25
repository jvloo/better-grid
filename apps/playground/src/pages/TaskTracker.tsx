import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, sorting, filtering, validation } from '@better-grid/plugins';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface TaskRow {
  id: number;
  task: string;
  assignee: string;
  priority: number;
  status: string;
  dueDate: string;
  estimate: number;
  progress: number;
  tags: string;
}

const data: TaskRow[] = [
  { id: 1, task: 'Setup CI/CD pipeline', assignee: 'Alice', priority: 1, status: 'Done', dueDate: '2026-03-01', estimate: 8, progress: 1, tags: 'devops' },
  { id: 2, task: 'Design landing page', assignee: 'Bob', priority: 2, status: 'In Progress', dueDate: '2026-03-15', estimate: 16, progress: 0.6, tags: 'design' },
  { id: 3, task: 'Implement auth module', assignee: 'Carol', priority: 1, status: 'In Progress', dueDate: '2026-03-10', estimate: 24, progress: 0.35, tags: 'backend' },
  { id: 4, task: 'Write API docs', assignee: 'David', priority: 3, status: 'Todo', dueDate: '2026-03-20', estimate: 12, progress: 0, tags: 'docs' },
  { id: 5, task: 'User testing round 1', assignee: 'Emma', priority: 2, status: 'Todo', dueDate: '2026-03-25', estimate: 20, progress: 0, tags: 'qa' },
  { id: 6, task: 'Database migration', assignee: 'Alice', priority: 1, status: 'In Review', dueDate: '2026-03-08', estimate: 6, progress: 0.9, tags: 'backend' },
  { id: 7, task: 'Mobile responsive fixes', assignee: 'Bob', priority: 2, status: 'In Progress', dueDate: '2026-03-12', estimate: 10, progress: 0.45, tags: 'frontend' },
  { id: 8, task: 'Performance audit', assignee: 'Carol', priority: 3, status: 'Todo', dueDate: '2026-04-01', estimate: 16, progress: 0, tags: 'devops' },
  { id: 9, task: 'Onboarding flow', assignee: 'David', priority: 1, status: 'In Progress', dueDate: '2026-03-18', estimate: 32, progress: 0.2, tags: 'frontend' },
  { id: 10, task: 'Security review', assignee: 'Emma', priority: 1, status: 'Todo', dueDate: '2026-03-22', estimate: 8, progress: 0, tags: 'security' },
  { id: 11, task: 'Analytics dashboard', assignee: 'Alice', priority: 2, status: 'Todo', dueDate: '2026-04-05', estimate: 40, progress: 0, tags: 'frontend' },
  { id: 12, task: 'Email notifications', assignee: 'Carol', priority: 3, status: 'Done', dueDate: '2026-02-28', estimate: 12, progress: 1, tags: 'backend' },
  { id: 13, task: 'Container orchestration setup', assignee: 'Alice', priority: 1, status: 'In Progress', dueDate: '2026-04-10', estimate: 20, progress: 0.3, tags: 'devops' },
  { id: 14, task: 'Accessibility audit', assignee: 'Bob', priority: 2, status: 'Todo', dueDate: '2026-04-15', estimate: 14, progress: 0, tags: 'qa' },
  { id: 15, task: 'Rate limiter middleware', assignee: 'Carol', priority: 1, status: 'In Review', dueDate: '2026-03-28', estimate: 10, progress: 0.85, tags: 'security' },
  { id: 16, task: 'Component library docs', assignee: 'David', priority: 3, status: 'In Progress', dueDate: '2026-04-20', estimate: 18, progress: 0.15, tags: 'docs' },
  { id: 17, task: 'Dark mode theme', assignee: 'Bob', priority: 2, status: 'In Progress', dueDate: '2026-04-08', estimate: 12, progress: 0.5, tags: 'design' },
  { id: 18, task: 'GraphQL API layer', assignee: 'Emma', priority: 1, status: 'Todo', dueDate: '2026-04-12', estimate: 28, progress: 0, tags: 'backend' },
  { id: 19, task: 'E2E test suite', assignee: 'Alice', priority: 2, status: 'In Progress', dueDate: '2026-04-18', estimate: 24, progress: 0.4, tags: 'qa' },
  { id: 20, task: 'Log aggregation pipeline', assignee: 'David', priority: 3, status: 'Todo', dueDate: '2026-04-25', estimate: 16, progress: 0, tags: 'devops' },
];

export function TaskTracker() {
  const columns = useMemo<ColumnDef<TaskRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40, editable: false, sortable: true },
      { id: 'task', header: 'Task', width: 230, required: true, sortable: true },
      {
        id: 'assignee',
        header: 'Assignee',
        width: 90,
        options: ['Alice', 'Bob', 'Carol', 'David', 'Emma'],
        sortable: true,
      },
      {
        id: 'priority',
        header: 'Priority',
        width: 90,
        sortable: true,
        options: [
          { label: '🔴 High', value: 1 },
          { label: '🟡 Medium', value: 2 },
          { label: '🟢 Low', value: 3 },
        ],
        cellRenderer: (container, ctx) => {
          const v = ctx.value as number;
          const map: Record<number, { label: string; color: string }> = {
            1: { label: 'High', color: '#c62828' },
            2: { label: 'Medium', color: '#f57f17' },
            3: { label: 'Low', color: '#2e7d32' },
          };
          const p = map[v];
          container.textContent = p?.label ?? String(v);
          container.style.color = p?.color ?? '';
          container.style.fontWeight = '500';
        },
      },
      {
        id: 'status',
        header: 'Status',
        width: 110,
        sortable: true,
        options: ['Todo', 'In Progress', 'In Review', 'Done'],
        cellRenderer: (container, ctx) => {
          const v = ctx.value as string;
          const colors: Record<string, { bg: string; fg: string }> = {
            'Todo': { bg: '#f5f5f5', fg: '#666' },
            'In Progress': { bg: '#e3f2fd', fg: '#1565c0' },
            'In Review': { bg: '#fff3e0', fg: '#e65100' },
            'Done': { bg: '#e8f5e9', fg: '#2e7d32' },
          };
          const c = colors[v] ?? { bg: '#f5f5f5', fg: '#666' };
          container.innerHTML = `<span style="pointer-events:none;padding:2px 8px;border-radius:12px;font-size:12px;background:${c.bg};color:${c.fg}">${v}</span>`;
        },
      },
      { id: 'dueDate', header: 'Due', width: 110, cellType: 'date', sortable: true },
      { id: 'estimate', header: 'Est (h)', width: 75, align: 'right', sortable: true },
      {
        id: 'progress',
        header: 'Progress',
        width: 110,
        sortable: true,
        cellRenderer: (container, ctx) => {
          const pct = Math.round((ctx.value as number) * 100);
          const color = pct === 100 ? '#2e7d32' : pct > 50 ? '#1565c0' : '#f57f17';
          container.innerHTML = `
            <div style="pointer-events:none;display:flex;align-items:center;gap:6px;width:100%">
              <div style="flex:1;height:6px;background:#eee;border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div>
              </div>
              <span style="font-size:11px;color:#888;min-width:28px">${pct}%</span>
            </div>
          `;
        },
      },
      { id: 'tags', header: 'Tags', width: 90, sortable: true },
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
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Task Tracker — Showcase</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Project management grid with all free plugins. Editable tasks with dropdowns, status badges, progress bars.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Edit:</strong> Double-click any cell &bull; Assignee/Priority/Status → dropdowns &bull; Progress → type 0-1 value
        <br />
        <strong>Explore:</strong> Sort by Priority or Due date &bull; Right-click → filter by assignee
      </div>

      <BetterGrid<TaskRow>
        columns={columns}
        data={data}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={520}
      />

      <CodeBlock title="Task Tracker" code={`import { BetterGrid } from '@better-grid/react';
import { formatting, editing, sorting, filtering, validation }
  from '@better-grid/plugins';

const columns = [
  { id: 'task', header: 'Task', width: 200, required: true },
  { id: 'assignee', header: 'Assignee', width: 100,
    options: ['Alice', 'Bob', 'Carol'] },
  { id: 'priority', header: 'Priority', width: 90,
    options: [
      { label: '🔴 High', value: 1 },
      { label: '🟡 Medium', value: 2 },
      { label: '🟢 Low', value: 3 },
    ],
    cellRenderer: (el, ctx) => {
      const map = { 1: { label: 'High', color: '#c62828' },
                    2: { label: 'Medium', color: '#f57f17' },
                    3: { label: 'Low', color: '#2e7d32' } };
      const p = map[ctx.value];
      el.textContent = p?.label ?? ctx.value;
      el.style.color = p?.color ?? '';
    },
  },
  { id: 'status', header: 'Status', width: 110,
    options: ['Todo', 'In Progress', 'In Review', 'Done'],
    cellRenderer: (el, ctx) => {
      // Render as colored badge pill
      const colors = {
        'Todo': { bg: '#f5f5f5', fg: '#666' },
        'In Progress': { bg: '#e3f2fd', fg: '#1565c0' },
        'Done': { bg: '#e8f5e9', fg: '#2e7d32' },
      };
      const c = colors[ctx.value] ?? { bg: '#f5f5f5', fg: '#666' };
      el.innerHTML = \`<span style="padding:2px 8px;border-radius:12px;
        font-size:12px;background:\${c.bg};color:\${c.fg}">\${ctx.value}</span>\`;
    },
  },
  { id: 'dueDate', header: 'Due', cellType: 'date' },
  { id: 'progress', header: 'Progress', width: 110,
    cellRenderer: (el, ctx) => {
      // Render as progress bar
      const pct = Math.round(ctx.value * 100);
      const color = pct === 100 ? '#2e7d32' : pct > 50 ? '#1565c0' : '#f57f17';
      el.innerHTML = \`<div style="display:flex;align-items:center;gap:6px">
        <div style="flex:1;height:6px;background:#eee;border-radius:3px">
          <div style="width:\${pct}%;height:100%;background:\${color};
            border-radius:3px"></div>
        </div>
        <span style="font-size:11px;color:#888">\${pct}%</span>
      </div>\`;
    },
  },
];

<BetterGrid
  columns={columns}
  data={tasks}
  plugins={[formatting(), editing(), sorting(),
            filtering(), validation()]}
/>`} />
    </div>
  );
}
