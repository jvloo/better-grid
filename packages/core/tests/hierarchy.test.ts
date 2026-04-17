import { describe, it, expect } from 'vitest';
import { buildHierarchyState, buildInitialExpandedSet } from '../src/hierarchy/build';
import type { HierarchyConfig } from '../src/types';

interface Row {
  id: number;
  parentId: number | null;
  name: string;
}

const config: HierarchyConfig<Row> = {
  getRowId: (r) => r.id,
  getParentId: (r) => r.parentId,
};

describe('buildHierarchyState', () => {
  it('handles flat data (no parent-child)', () => {
    const data: Row[] = [
      { id: 1, parentId: null, name: 'A' },
      { id: 2, parentId: null, name: 'B' },
      { id: 3, parentId: null, name: 'C' },
    ];
    const state = buildHierarchyState(data, new Set(), config);

    expect(state.visibleRows).toEqual([0, 1, 2]);
    expect(state.parentIds.size).toBe(0);
    expect(state.rowDepths.get(1)).toBe(0);
    expect(state.rowDepths.get(2)).toBe(0);
    expect(state.rowDepths.get(3)).toBe(0);
  });

  it('builds a single-level parent-child tree, fully expanded', () => {
    const data: Row[] = [
      { id: 1, parentId: null, name: 'Parent' },
      { id: 2, parentId: 1, name: 'Child A' },
      { id: 3, parentId: 1, name: 'Child B' },
    ];
    const state = buildHierarchyState(data, new Set([1]), config);

    expect(state.visibleRows).toEqual([0, 1, 2]); // parent + 2 children
    expect(state.parentIds.has(1)).toBe(true);
    expect(state.rowDepths.get(1)).toBe(0);
    expect(state.rowDepths.get(2)).toBe(1);
    expect(state.rowDepths.get(3)).toBe(1);
  });

  it('hides children when parent is collapsed', () => {
    const data: Row[] = [
      { id: 1, parentId: null, name: 'Parent' },
      { id: 2, parentId: 1, name: 'Child A' },
      { id: 3, parentId: 1, name: 'Child B' },
    ];
    const state = buildHierarchyState(data, new Set(), config); // no expanded rows

    expect(state.visibleRows).toEqual([0]); // only parent
    expect(state.parentIds.has(1)).toBe(true);
  });

  it('handles multi-level nesting with partial expansion', () => {
    // Tree:
    //   1: root
    //     2: child (expanded)
    //       3: grandchild
    //     4: child (collapsed)
    //       5: hidden grandchild
    const data: Row[] = [
      { id: 1, parentId: null, name: 'root' },
      { id: 2, parentId: 1, name: 'child 1' },
      { id: 3, parentId: 2, name: 'grandchild 1' },
      { id: 4, parentId: 1, name: 'child 2' },
      { id: 5, parentId: 4, name: 'grandchild 2' },
    ];
    const state = buildHierarchyState(data, new Set([1, 2]), config); // root and child 1 expanded

    expect(state.visibleRows).toEqual([0, 1, 2, 3]); // root, child 1, grandchild 1, child 2
    expect(state.rowDepths.get(3)).toBe(2);
    expect(state.rowDepths.get(4)).toBe(1);
    // child 2's grandchild should not be in visibleRows
    expect(state.visibleRows).not.toContain(4);
  });

  it('respects depth-first order with sibling expansion', () => {
    const data: Row[] = [
      { id: 10, parentId: null, name: 'A' },
      { id: 11, parentId: 10, name: 'A.1' },
      { id: 20, parentId: null, name: 'B' },
      { id: 21, parentId: 20, name: 'B.1' },
    ];
    const state = buildHierarchyState(data, new Set([10, 20]), config);

    // Should walk depth-first: A, A.1, B, B.1 (indices 0, 1, 2, 3)
    expect(state.visibleRows).toEqual([0, 1, 2, 3]);
  });

  it('populates dataIndexToRowId map correctly', () => {
    const data: Row[] = [
      { id: 100, parentId: null, name: 'X' },
      { id: 200, parentId: 100, name: 'Y' },
    ];
    const state = buildHierarchyState(data, new Set([100]), config);

    expect(state.dataIndexToRowId.get(0)).toBe(100);
    expect(state.dataIndexToRowId.get(1)).toBe(200);
  });

  it('populates childrenMap with correct parent → child indices', () => {
    const data: Row[] = [
      { id: 1, parentId: null, name: 'Parent' },
      { id: 2, parentId: 1, name: 'Child A' },
      { id: 3, parentId: 1, name: 'Child B' },
      { id: 4, parentId: null, name: 'Root 2' },
    ];
    const state = buildHierarchyState(data, new Set([1]), config);

    expect(state.childrenMap.get(null)).toEqual([0, 3]); // two root rows
    expect(state.childrenMap.get(1)).toEqual([1, 2]); // two children of Parent
  });

  it('treats undefined parentId as null (root)', () => {
    const altConfig: HierarchyConfig<Row> = {
      getRowId: (r) => r.id,
      getParentId: () => undefined, // always undefined
    };
    const data: Row[] = [
      { id: 1, parentId: null, name: 'A' },
      { id: 2, parentId: null, name: 'B' },
    ];
    const state = buildHierarchyState(data, new Set(), altConfig);

    expect(state.visibleRows).toEqual([0, 1]);
    expect(state.parentIds.size).toBe(0);
  });

  it('handles empty data', () => {
    const state = buildHierarchyState([], new Set(), config);

    expect(state.visibleRows).toEqual([]);
    expect(state.parentIds.size).toBe(0);
    expect(state.rowDepths.size).toBe(0);
    expect(state.dataIndexToRowId.size).toBe(0);
  });

  it('includes expanded rows in output state', () => {
    const data: Row[] = [
      { id: 1, parentId: null, name: 'A' },
    ];
    const expanded = new Set([1]);
    const state = buildHierarchyState(data, expanded, config);

    expect(state.expandedRows).toBe(expanded); // same reference
  });

  it('handles orphan rows (parent ID not in data)', () => {
    // Row 2 references parent 99 which does not exist in the data.
    // Current behavior: orphans become invisible — they're only reachable
    // via childrenMap.get(99), but walk() starts from null and never visits 99.
    const data: Row[] = [
      { id: 1, parentId: null, name: 'A' },
      { id: 2, parentId: 99, name: 'Orphan' },
    ];
    const state = buildHierarchyState(data, new Set(), config);

    expect(state.visibleRows).toEqual([0]); // only A, orphan hidden
    expect(state.childrenMap.get(99)).toEqual([1]); // orphan IS in the map though
  });
});

describe('buildInitialExpandedSet', () => {
  it('returns empty set when defaultExpanded is false', () => {
    const data: Row[] = [
      { id: 1, parentId: null, name: 'A' },
      { id: 2, parentId: 1, name: 'B' },
    ];
    const expanded = buildInitialExpandedSet(data, config, false);

    expect(expanded.size).toBe(0);
  });

  it('expands all rows when defaultExpanded is true', () => {
    const data: Row[] = [
      { id: 1, parentId: null, name: 'A' },
      { id: 2, parentId: 1, name: 'B' },
      { id: 3, parentId: null, name: 'C' },
    ];
    const expanded = buildInitialExpandedSet(data, config, true);

    expect(expanded.size).toBe(3);
    expect(expanded.has(1)).toBe(true);
    expect(expanded.has(2)).toBe(true);
    expect(expanded.has(3)).toBe(true);
  });

  it('handles empty data', () => {
    const expanded = buildInitialExpandedSet([], config, true);
    expect(expanded.size).toBe(0);
  });
});
