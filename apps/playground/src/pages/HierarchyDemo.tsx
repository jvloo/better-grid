import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, hierarchy } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

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

export function HierarchyDemo() {
  const columns = useMemo<ColumnDef<DeptRow>[]>(
    () => [
      { id: 'name', accessorKey: 'name', header: 'Department', width: 250 },
      { id: 'budget', accessorKey: 'budget', header: 'Budget', width: 130, cellType: 'currency', align: 'right' },
      { id: 'headcount', accessorKey: 'headcount', header: 'Headcount', width: 100, cellType: 'number', align: 'right' },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        width: 100,
        cellRenderer: (container, ctx) => {
          const val = ctx.value as string;
          container.textContent = val;
          container.style.fontWeight = '500';
          if (val === 'Active') container.style.color = '#2e7d32';
          else if (val === 'Hiring') container.style.color = '#1565c0';
          else container.style.color = '#9e9e9e';
        },
      },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting(),
      hierarchy({ expandColumn: 'name', indentSize: 22 }),
    ],
    [],
  );

  // Compute totals from root-level departments for the pinned footer row
  const totalsRow = useMemo<DeptRow>(() => {
    const roots = deptData.filter((r) => r.parentId === null);
    return {
      id: -1,
      parentId: null,
      name: 'Total',
      budget: roots.reduce((sum, r) => sum + r.budget, 0),
      headcount: roots.reduce((sum, r) => sum + r.headcount, 0),
      status: '',
    };
  }, []);

  const { grid, containerRef } = useGrid<DeptRow>({
    data: deptData,
    columns,
    plugins,
    pinnedBottomRows: [totalsRow],
    hierarchy: {
      getRowId: (row: DeptRow) => row.id,
      getParentId: (row: DeptRow) => row.parentId,
      defaultExpanded: true,
    },
    rowHeight: 36,
  });

  const handleExpandAll = useCallback(() => {
    grid.expandAll();
  }, [grid]);

  const handleCollapseAll = useCallback(() => {
    grid.collapseAll();
  }, [grid]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Row Hierarchy</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExpandAll}
            style={{
              padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6,
              background: '#fff', cursor: 'pointer', fontSize: 12,
            }}
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            style={{
              padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6,
              background: '#fff', cursor: 'pointer', fontSize: 12,
            }}
          >
            Collapse All
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
        Click the triangle icons to expand/collapse rows. Use Arrow Right/Left keys on parent rows.
      </p>
      <div
        ref={containerRef}
        style={{
          height: 500,
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
