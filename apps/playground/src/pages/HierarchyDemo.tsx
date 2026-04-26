import { useCallback } from 'react';
import { BetterGrid, useGrid, defineColumn as col } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';
import { IconButton, ExpandAllIcon, CollapseAllIcon } from './_toolbar-icons';

interface DeptRow {
  id: number;
  parentId: number | null;
  name: string;
  budget: number;
  headcount: number;
  status: string;
}

const deptData: DeptRow[] = [
  { id: 1, parentId: null, name: 'Engineering', budget: 500000, headcount: 45, status: 'Active' },
  { id: 2, parentId: 1, name: 'Frontend', budget: 200000, headcount: 18, status: 'Active' },
  { id: 3, parentId: 1, name: 'Backend', budget: 300000, headcount: 22, status: 'Active' },
  { id: 4, parentId: 2, name: 'React Team', budget: 120000, headcount: 10, status: 'Active' },
  { id: 5, parentId: 2, name: 'Design System', budget: 80000, headcount: 8, status: 'Active' },
  { id: 6, parentId: 3, name: 'API Services', budget: 180000, headcount: 12, status: 'Active' },
  { id: 7, parentId: 3, name: 'Data Platform', budget: 120000, headcount: 10, status: 'Hiring' },
  { id: 8, parentId: 1, name: 'DevOps', budget: 150000, headcount: 5, status: 'Active' },
  { id: 9, parentId: null, name: 'Marketing', budget: 300000, headcount: 20, status: 'Active' },
  { id: 10, parentId: 9, name: 'Content', budget: 150000, headcount: 10, status: 'Active' },
  { id: 11, parentId: 9, name: 'SEO', budget: 100000, headcount: 6, status: 'Active' },
  { id: 12, parentId: 9, name: 'Social Media', budget: 50000, headcount: 4, status: 'Paused' },
  { id: 13, parentId: null, name: 'Sales', budget: 400000, headcount: 30, status: 'Active' },
  { id: 14, parentId: 13, name: 'Enterprise', budget: 250000, headcount: 18, status: 'Active' },
  { id: 15, parentId: 13, name: 'SMB', budget: 150000, headcount: 12, status: 'Active' },
  { id: 16, parentId: 14, name: 'EMEA', budget: 100000, headcount: 8, status: 'Active' },
  { id: 17, parentId: 14, name: 'Americas', budget: 150000, headcount: 10, status: 'Active' },
  { id: 18, parentId: null, name: 'HR', budget: 120000, headcount: 8, status: 'Active' },
  { id: 19, parentId: 18, name: 'Recruiting', budget: 80000, headcount: 5, status: 'Hiring' },
  { id: 20, parentId: 18, name: 'People Ops', budget: 40000, headcount: 3, status: 'Active' },
];

// Status column uses a custom renderer with no scope-dependent state, so it's
// safe to hoist alongside the other columns at module scope.
const columns = [
  col.text('name', { headerName: 'Department', width: 250 }),
  col.currency('budget', { headerName: 'Budget', width: 130 }),
  col.number('headcount', { headerName: 'Headcount', width: 100 }),
  col.custom('status', {
    headerName: 'Status',
    width: 100,
    cellRenderer: (container, ctx) => {
      const val = ctx.value as string;
      container.textContent = val;
      container.style.fontWeight = '500';
      if (val === 'Active') container.style.color = '#2e7d32';
      else if (val === 'Hiring') container.style.color = '#1565c0';
      else container.style.color = '#9e9e9e';
    },
  }),
] as ColumnDef<DeptRow>[];

// Compute totals once at module scope — depends only on static data.
const rootDepts = deptData.filter((r) => r.parentId === null);
const totalsRow: DeptRow = {
  id: -1,
  parentId: null,
  name: 'Total',
  budget: rootDepts.reduce((sum, r) => sum + r.budget, 0),
  headcount: rootDepts.reduce((sum, r) => sum + r.headcount, 0),
  status: '',
};

export function HierarchyDemo() {
  // hierarchy stays as a top-level option on useGrid — its config shape is unchanged.
  const grid = useGrid<DeptRow>({
    data: deptData,
    columns,
    mode: 'view',
    features: ['format', 'hierarchy'],
    pinned: { bottom: [totalsRow] },
    hierarchy: {
      getRowId: (row: DeptRow) => row.id,
      getParentId: (row: DeptRow) => row.parentId,
      defaultExpanded: true,
    },
    selection: { mode: 'range' },
    rowHeight: 36,
  });

  const handleExpandAll = useCallback(() => grid.api.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.api.collapseAll(), [grid]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Row Hierarchy</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton title="Expand All" onClick={handleExpandAll}><ExpandAllIcon /></IconButton>
          <IconButton title="Collapse All" onClick={handleCollapseAll}><CollapseAllIcon /></IconButton>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
        Use the toolbar's <strong>Expand All</strong> / <strong>Collapse All</strong> buttons, click the
        triangle icons on parent rows, or press Arrow Right/Left on a focused parent row.
        The <code>hierarchy</code> feature is opted-in via <code>features</code>; its config
        (<code>getRowId</code>, <code>getParentId</code>, etc.) stays as a top-level
        <code> useGrid</code> option.
      </p>
      <BetterGrid
        grid={grid}
        height={500}
        style={{ border: '1px solid #e0e0e0', borderRadius: 8 }}
      />
    </div>
  );
}

