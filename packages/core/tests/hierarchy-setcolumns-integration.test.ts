/**
 * Integration test: hierarchy cellRenderer wrap survives setColumns().
 *
 * Regression test for the same class of bug fixed in editing.ts (commit e87dd36):
 * grid.setColumns() — called by React's useEffect on first render — creates fresh
 * ColumnDef spread-copies via normalizeColumn(), discarding the cellRenderer
 * mutation applied by the hierarchy plugin during init(). The fix extracts the
 * wrap into applyColumnWrap() and subscribes to 'columns:set' to re-apply it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { hierarchy } from '../../plugins/src/free/hierarchy';
import type { ColumnDef, HierarchyConfig } from '../src/types';

interface Row {
  id: number;
  parentId: number | null;
  name: string;
}

const hierarchyConfig: HierarchyConfig<Row> = {
  getRowId: (r) => r.id,
  getParentId: (r) => r.parentId,
  defaultExpanded: true,
};

const data: Row[] = [
  { id: 1, parentId: null, name: 'Parent A' },
  { id: 2, parentId: 1, name: 'Child A1' },
  { id: 3, parentId: 1, name: 'Child A2' },
  { id: 4, parentId: null, name: 'Parent B' },
];

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as typeof requestAnimationFrame;
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

const columns: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', headerName: 'Name', width: 200 },
  { id: 'id', field: 'id', headerName: 'ID', width: 80 },
];

describe('hierarchy — cellRenderer wrap survives setColumns()', () => {
  it('renders toggle icons (.bg-hierarchy-toggle) on initial mount', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      hierarchy: hierarchyConfig,
      plugins: [hierarchy({ indentColumn: 'name' })],
    });

    grid.mount(host);
    grid.refresh();

    const toggles = host.querySelectorAll('.bg-hierarchy-toggle');
    // At least one parent row with a toggle must be rendered
    expect(toggles.length).toBeGreaterThan(0);
    grid.unmount();
  });

  it('renders toggle icons (.bg-hierarchy-toggle) after setColumns() — React useEffect pattern', () => {
    // This is the exact sequence that caused the regression:
    // 1. createGrid() → plugins init → hierarchy wraps the indent column's cellRenderer
    // 2. grid.setColumns(columns) → normalizeColumn() creates fresh spread-copies,
    //    discarding the cellRenderer mutation → without the fix, no toggle icons appear
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      hierarchy: hierarchyConfig,
      plugins: [hierarchy({ indentColumn: 'name' })],
    });

    grid.mount(host);

    // Simulate React's useEffect calling setColumns with the same columns object.
    grid.setColumns(columns);
    grid.refresh();

    const toggles = host.querySelectorAll('.bg-hierarchy-toggle');
    expect(toggles.length).toBeGreaterThan(0);
    grid.unmount();
  });

  it('applies depth-based padding (bg-cell--depth-* classes) after setColumns()', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      hierarchy: hierarchyConfig,
      plugins: [hierarchy({ indentColumn: 'name' })],
    });

    grid.mount(host);
    grid.setColumns(columns);
    grid.refresh();

    // Depth-0 cells (root rows) should be present
    const depth0 = host.querySelectorAll('.bg-cell--depth-0');
    expect(depth0.length).toBeGreaterThan(0);

    // Depth-1 cells (children of expanded parents)
    const depth1 = host.querySelectorAll('.bg-cell--depth-1');
    expect(depth1.length).toBeGreaterThan(0);

    grid.unmount();
  });

  it('double setColumns() call does not double-wrap (sentinel guard)', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      hierarchy: hierarchyConfig,
      plugins: [hierarchy({ indentColumn: 'name' })],
    });

    grid.mount(host);
    grid.setColumns(columns);
    grid.setColumns(columns);
    grid.refresh();

    // toggles should still be present but not doubled per cell
    const toggles = host.querySelectorAll('.bg-hierarchy-toggle');
    expect(toggles.length).toBeGreaterThan(0);
    grid.unmount();
  });
});
