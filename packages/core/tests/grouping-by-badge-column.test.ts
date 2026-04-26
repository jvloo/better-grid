/**
 * Regression test: grouping-by-badge-column
 *
 * Bug: when a grid has BOTH a `hierarchy` config and the `grouping` plugin,
 * calling `setGroupBy` replaces the grid data with synthetic group-header rows
 * that have no real id/parentId. The core's `rebuildHierarchy()` then ran on
 * those synthetic rows, producing a broken hierarchyState whose visibleRows
 * mapping no longer matched the grouped flat data. The rendered row count was
 * wrong and group headers appeared in random positions or were skipped.
 *
 * Fix (grouping.ts): after grid.setData(flatData), if hierarchyState is present
 * clear it to null so rendering falls back to state.data directly.
 *
 * Additional fix: groupCellRenderer now resolves a badge/select column's option
 * label (e.g. "Active") instead of displaying the raw value (e.g. "active").
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { grouping } from '../../plugins/src/free/grouping';
import { hierarchy } from '../../plugins/src/free/hierarchy';
import type { ColumnDef, HierarchyConfig } from '../src/types';
import type { GroupingApi } from '../../plugins/src/free/grouping';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

interface Row {
  id: number;
  parentId: number | null;
  phase: string;
  status: string;
  budget: number;
}

// Badge options where value != label (canonical bug-trigger shape)
const phaseOptions = [
  { label: 'Planning', value: 'planning' },
  { label: 'Active', value: 'active' },
  { label: 'Closed', value: 'closed' },
];

const columns: ColumnDef<Row>[] = [
  { id: 'phase', field: 'phase', headerName: 'Phase', width: 120,
    cellType: 'badge', options: phaseOptions } as ColumnDef<Row>,
  { id: 'status', field: 'status', headerName: 'Status', width: 100 } as ColumnDef<Row>,
  { id: 'budget', field: 'budget', headerName: 'Budget', width: 110 } as ColumnDef<Row>,
];

// Parent rows (parentId: null) + child rows
const data: Row[] = [
  { id: 1, parentId: null, phase: 'planning', status: 'open', budget: 100 },
  { id: 2, parentId: 1,    phase: 'planning', status: 'open', budget: 60 },
  { id: 3, parentId: 1,    phase: 'planning', status: 'closed', budget: 40 },
  { id: 4, parentId: null, phase: 'active',   status: 'open', budget: 200 },
  { id: 5, parentId: 4,    phase: 'active',   status: 'open', budget: 200 },
];

const hierarchyConfig: HierarchyConfig<Row> = {
  getRowId: (r) => r.id,
  getParentId: (r) => r.parentId,
  defaultExpanded: true,
};

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

// ---------------------------------------------------------------------------
// Group-count helpers
// ---------------------------------------------------------------------------

/** Count group header rows in the current grid data */
function countGroupRows(gridData: unknown[]): number {
  return gridData.filter(
    (r) => r != null && typeof r === 'object' && '__bgGroupRow__' in (r as Record<string, unknown>),
  ).length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('grouping by badge column', () => {
  it('produces 2 group headers + 5 data rows when grouping by phase (badge column, no hierarchy)', () => {
    const grid = createGrid<Row>({
      columns,
      data: [...data],
      plugins: [grouping({ defaultExpanded: true })],
    });

    const api = (grid.plugins as Record<string, GroupingApi>).grouping!;
    api.setGroupBy(['phase']);

    const grouped = grid.getData();
    // 2 phases (planning, active) → 2 group headers + 5 data rows = 7
    expect(grouped.length).toBe(7);
    expect(countGroupRows(grouped)).toBe(2);

    // Both group rows should be visible via the API
    expect(api.isGroupRow(0)).toBe(true);  // first group header
    expect(api.isGroupRow(1)).toBe(false); // first data row

    grid.destroy();
  });

  it('resolves badge option LABEL in groupCellRenderer (not raw value)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [...data],
      plugins: [grouping({ defaultExpanded: true })],
    });

    const api = (grid.plugins as Record<string, GroupingApi>).grouping!;
    api.setGroupBy(['phase']);

    grid.mount(host);
    grid.refresh();

    // The auto-group column renders group labels inside .bg-grouping-label spans
    const labels = Array.from(host.querySelectorAll('.bg-grouping-label')).map(
      (el) => el.textContent ?? '',
    );

    // Should show "Planning (3)" and "Active (2)", NOT "planning" or "active"
    expect(labels.some((l) => l.startsWith('Planning'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Active'))).toBe(true);
    expect(labels.every((l) => !l.startsWith('planning') && !l.startsWith('active'))).toBe(true);

    grid.unmount();
    grid.destroy();
  });

  it('clears hierarchyState when grouping is applied so row count is correct', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [...data],
      hierarchy: hierarchyConfig,
      plugins: [
        hierarchy({ indentColumn: 'phase' }),
        grouping({ defaultExpanded: true }),
      ],
    });

    grid.mount(host);
    grid.refresh();

    // Before grouping: hierarchy is active
    expect(grid.getState().hierarchyState).not.toBeNull();

    const api = (grid.plugins as Record<string, GroupingApi>).grouping!;
    api.setGroupBy(['phase']);
    grid.refresh();

    // After grouping: 2 group header rows + 5 data rows = 7 total
    expect(grid.getData().length).toBe(7);
    expect(countGroupRows(grid.getData())).toBe(2);

    // hierarchyState must be cleared — rendering falls back to state.data order
    expect(grid.getState().hierarchyState).toBeNull();

    grid.unmount();
    grid.destroy();
  });

  it('restores hierarchy after grouping is cleared', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: [...data],
      hierarchy: hierarchyConfig,
      plugins: [
        hierarchy({ indentColumn: 'phase' }),
        grouping({ defaultExpanded: true }),
      ],
    });

    grid.mount(host);
    grid.refresh();

    const api = (grid.plugins as Record<string, GroupingApi>).grouping!;
    api.setGroupBy(['phase']);
    grid.refresh();

    // Now clear grouping → hierarchy should rebuild from original data
    api.setGroupBy([]);
    grid.refresh();

    // Back to 5 rows (original data restored)
    expect(grid.getData().length).toBe(5);
    expect(countGroupRows(grid.getData())).toBe(0);

    // hierarchyState should be rebuilt from original data
    expect(grid.getState().hierarchyState).not.toBeNull();

    grid.unmount();
    grid.destroy();
  });

  it('group headers show isGroupRow=true and data rows show isGroupRow=false', () => {
    const grid = createGrid<Row>({
      columns,
      data: [...data],
      plugins: [grouping({ defaultExpanded: true })],
    });

    const api = (grid.plugins as Record<string, GroupingApi>).grouping!;
    api.setGroupBy(['phase']);

    const grouped = grid.getData();
    // Row 0 is the first group header
    expect(api.isGroupRow(0)).toBe(true);

    // Find first non-group row
    const firstDataIndex = grouped.findIndex(
      (r) => r != null && typeof r === 'object' && !('__bgGroupRow__' in (r as Record<string, unknown>)),
    );
    expect(firstDataIndex).toBeGreaterThan(0);
    expect(api.isGroupRow(firstDataIndex)).toBe(false);

    grid.destroy();
  });
});
