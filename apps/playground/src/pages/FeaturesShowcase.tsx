import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import {
  formatting, editing, sorting, filtering, clipboard,
  cellRenderers, autoDetect, undoRedo, search, exportPlugin, pagination,
} from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface ProjectRow {
  id: number;
  name: string;
  status: string;
  progress: number;
  budget: number;
  spent: number;
  variance: number;
  rating: number;
  active: boolean;
  startDate: string;
  owner: string;
  priority: string;
}

// Generate 60 rows so pagination is meaningful (3 pages at 20/page)
const projectData: ProjectRow[] = [
  { id: 1, name: 'Website Redesign', status: 'active', progress: 75, budget: 50000, spent: 37500, variance: 2500, rating: 4.5, active: true, startDate: '2026-01-10', owner: 'Alice', priority: 'High' },
  { id: 2, name: 'Mobile App v2', status: 'active', progress: 45, budget: 80000, spent: 36000, variance: -4000, rating: 3.8, active: true, startDate: '2026-02-01', owner: 'Bob', priority: 'High' },
  { id: 3, name: 'API Migration', status: 'completed', progress: 100, budget: 30000, spent: 28000, variance: 2000, rating: 4.9, active: false, startDate: '2025-11-15', owner: 'Carol', priority: 'Medium' },
  { id: 4, name: 'Dashboard Analytics', status: 'active', progress: 60, budget: 45000, spent: 27000, variance: 0, rating: 4.2, active: true, startDate: '2026-01-20', owner: 'Dave', priority: 'Medium' },
  { id: 5, name: 'Security Audit', status: 'on-hold', progress: 20, budget: 15000, spent: 3000, variance: 1500, rating: 3.5, active: false, startDate: '2026-03-01', owner: 'Eve', priority: 'Low' },
  { id: 6, name: 'CI/CD Pipeline', status: 'active', progress: 90, budget: 20000, spent: 18000, variance: 500, rating: 4.7, active: true, startDate: '2025-12-01', owner: 'Frank', priority: 'High' },
  { id: 7, name: 'Data Warehouse', status: 'active', progress: 35, budget: 120000, spent: 42000, variance: -8000, rating: 3.2, active: true, startDate: '2026-02-15', owner: 'Grace', priority: 'High' },
  { id: 8, name: 'UX Research', status: 'completed', progress: 100, budget: 25000, spent: 24000, variance: 1000, rating: 4.6, active: false, startDate: '2025-10-01', owner: 'Henry', priority: 'Medium' },
  { id: 9, name: 'Load Testing', status: 'active', progress: 55, budget: 18000, spent: 9900, variance: 0, rating: 4.0, active: true, startDate: '2026-01-25', owner: 'Ivy', priority: 'Low' },
  { id: 10, name: 'SSO Integration', status: 'on-hold', progress: 10, budget: 35000, spent: 3500, variance: 3000, rating: 3.0, active: false, startDate: '2026-03-15', owner: 'Jack', priority: 'Medium' },
  { id: 11, name: 'Email Templates', status: 'completed', progress: 100, budget: 8000, spent: 7500, variance: 500, rating: 4.3, active: false, startDate: '2025-09-10', owner: 'Kate', priority: 'Low' },
  { id: 12, name: 'Payment Gateway', status: 'active', progress: 80, budget: 60000, spent: 48000, variance: -3000, rating: 4.4, active: true, startDate: '2025-12-15', owner: 'Leo', priority: 'High' },
  { id: 13, name: 'Chat Widget', status: 'active', progress: 40, budget: 22000, spent: 8800, variance: 1200, rating: 3.9, active: true, startDate: '2026-02-20', owner: 'Mia', priority: 'Medium' },
  { id: 14, name: 'CDN Setup', status: 'completed', progress: 100, budget: 12000, spent: 11000, variance: 1000, rating: 4.8, active: false, startDate: '2025-11-01', owner: 'Noah', priority: 'Low' },
  { id: 15, name: 'Monitoring Stack', status: 'active', progress: 65, budget: 28000, spent: 18200, variance: -700, rating: 4.1, active: true, startDate: '2026-01-05', owner: 'Olivia', priority: 'High' },
  { id: 16, name: 'A/B Testing', status: 'on-hold', progress: 15, budget: 16000, spent: 2400, variance: 2000, rating: 3.3, active: false, startDate: '2026-03-10', owner: 'Pete', priority: 'Low' },
  { id: 17, name: 'GraphQL Layer', status: 'active', progress: 50, budget: 40000, spent: 20000, variance: 0, rating: 4.0, active: true, startDate: '2026-01-15', owner: 'Quinn', priority: 'Medium' },
  { id: 18, name: 'Docs Portal', status: 'active', progress: 70, budget: 18000, spent: 12600, variance: 800, rating: 4.5, active: true, startDate: '2025-12-20', owner: 'Rose', priority: 'Medium' },
  { id: 19, name: 'Backup System', status: 'completed', progress: 100, budget: 10000, spent: 9500, variance: 500, rating: 4.7, active: false, startDate: '2025-08-01', owner: 'Sam', priority: 'High' },
  { id: 20, name: 'Rate Limiter', status: 'active', progress: 85, budget: 14000, spent: 11900, variance: 200, rating: 4.6, active: true, startDate: '2025-12-05', owner: 'Tina', priority: 'Medium' },
  // Generate 40 more rows programmatically for pagination
  ...Array.from({ length: 40 }, (_, i) => ({
    id: 21 + i,
    name: `Project ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
    status: ['active', 'completed', 'on-hold'][i % 3]!,
    progress: Math.round(Math.random() * 100),
    budget: Math.round((10000 + Math.random() * 90000) / 1000) * 1000,
    spent: 0, // will be computed
    variance: Math.round((Math.random() - 0.4) * 10000),
    rating: Math.round((3 + Math.random() * 2) * 10) / 10,
    active: i % 3 !== 2,
    startDate: `2026-0${1 + (i % 9)}-${String(10 + (i % 20)).padStart(2, '0')}`,
    owner: ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry'][i % 8]!,
    priority: ['High', 'Medium', 'Low'][i % 3]!,
  })).map(r => ({ ...r, spent: Math.round(r.budget * r.progress / 100) })),
];

export function FeaturesShowcase() {
  const columns = useMemo<ColumnDef<ProjectRow>[]>(
    () => [
      { id: 'name', accessorKey: 'name', header: 'Project', width: 170 },
      {
        id: 'status', accessorKey: 'status', header: 'Status', width: 110,
        cellType: 'badge',
        options: [
          { label: 'Active', value: 'active', color: '#2e7d32', bg: '#e8f5e9' },
          { label: 'Completed', value: 'completed', color: '#1565c0', bg: '#e3f2fd' },
          { label: 'On Hold', value: 'on-hold', color: '#e65100', bg: '#fff3e0' },
        ],
      },
      { id: 'progress', accessorKey: 'progress', header: 'Progress', width: 130, cellType: 'progress' },
      { id: 'budget', accessorKey: 'budget', header: 'Budget', width: 120, cellType: 'currency', align: 'right' },
      { id: 'spent', accessorKey: 'spent', header: 'Spent', width: 120, cellType: 'currency', align: 'right' },
      { id: 'variance', accessorKey: 'variance', header: 'Variance', width: 110, cellType: 'change' },
      { id: 'rating', accessorKey: 'rating', header: 'Rating', width: 120, cellType: 'rating' },
      { id: 'active', accessorKey: 'active', header: 'Active', width: 80, cellType: 'boolean' },
      { id: 'startDate', accessorKey: 'startDate', header: 'Start Date', width: 120, cellType: 'date' },
      { id: 'owner', accessorKey: 'owner', header: 'Owner', width: 100 },
      {
        id: 'priority', accessorKey: 'priority', header: 'Priority', width: 100,
        cellType: 'badge',
        options: [
          { label: 'High', value: 'High', color: '#c62828', bg: '#ffebee' },
          { label: 'Medium', value: 'Medium', color: '#e65100', bg: '#fff3e0' },
          { label: 'Low', value: 'Low', color: '#666', bg: '#f5f5f5' },
        ],
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      cellRenderers(),
      editing({ editTrigger: 'dblclick', editorMode: 'inline' }),
      sorting(),
      filtering(),
      clipboard(),
      undoRedo(),
      search(),
      exportPlugin({ filename: 'projects' }),
      pagination({ pageSize: 20 }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<ProjectRow>({
    data: projectData,
    columns,
    plugins,
    rowHeight: 36,
  });

  const handleExport = useCallback(() => {
    const api = grid.getPlugin<{ exportToCsv: () => void }>('export');
    api?.exportToCsv();
  }, [grid]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Features Showcase</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            All plugins active. Try: <strong>Ctrl+F</strong> search, <strong>Ctrl+Z/Y</strong> undo/redo, <strong>Ctrl+C/V</strong> clipboard.
            Select a range (click + shift+click), then <strong>Ctrl+D</strong> fill-down or <strong>Ctrl+Shift+D</strong> fill-series.
          </p>
        </div>
        <button
          onClick={handleExport}
          style={{
            padding: '8px 16px', border: '1px solid #d0d0d0', borderRadius: 6,
            background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        <strong>Cell types:</strong> badge (Status, Priority) · progress (Progress) · currency (Budget, Spent) · change (Variance) · rating (Rating) · boolean (Active) · date (Start Date)
      </div>

      <div
        ref={containerRef}
        style={{
          height: 500,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          borderRadius: '8px 8px 0 0',
        }}
      />
    </div>
  );
}
