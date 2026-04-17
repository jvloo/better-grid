// ============================================================================
// Hierarchy State Builder — pure tree construction from flat data
//
// Given a flat array of rows where each row has a parent reference, produces
// a HierarchyState suitable for rendering:
// - childrenMap: parent → child data indices (tree structure)
// - parentIds: set of row IDs that have children
// - rowDepths: indentation depth per row
// - visibleRows: depth-first walk respecting expanded state
// - dataIndexToRowId: reverse lookup
//
// This module is intentionally dependency-free (no DOM, no store, no plugins)
// so it can be unit-tested in isolation.
// ============================================================================

import type { HierarchyConfig, HierarchyState } from '../types';

/**
 * Build a HierarchyState from flat data + expanded row IDs.
 * Pure function — no side effects, no state.
 */
export function buildHierarchyState<TData>(
  data: readonly TData[],
  expandedRows: Set<string | number>,
  config: HierarchyConfig<TData>,
): HierarchyState {
  const childrenMap = new Map<string | number | null, number[]>();
  const rowDepths = new Map<string | number, number>();
  const parentIds = new Set<string | number>();
  const dataIndexToRowId = new Map<number, string | number>();

  // Build children map: parentId → array of data indices
  // Also build dataIndex → rowId map
  for (let i = 0; i < data.length; i++) {
    const row = data[i]!;
    const rowId = config.getRowId(row);
    const parentId = config.getParentId(row) ?? null;
    dataIndexToRowId.set(i, rowId);
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(i);
  }

  // Mark parent IDs (keys of childrenMap that are actual row IDs, not null)
  for (const [parentId] of childrenMap) {
    if (parentId !== null) {
      parentIds.add(parentId);
    }
  }

  // Walk tree depth-first to build visibleRows and rowDepths
  const visibleRows: number[] = [];

  function walk(parentId: string | number | null, depth: number): void {
    const children = childrenMap.get(parentId);
    if (!children) return;
    for (const dataIndex of children) {
      const row = data[dataIndex]!;
      const rowId = config.getRowId(row);
      rowDepths.set(rowId, depth);
      visibleRows.push(dataIndex);

      // Recurse into children if expanded
      if (expandedRows.has(rowId) && childrenMap.has(rowId)) {
        walk(rowId, depth + 1);
      }
    }
  }

  walk(null, 0);

  return { expandedRows, visibleRows, rowDepths, childrenMap, parentIds, dataIndexToRowId };
}

/**
 * Build an initial expanded set — either all parents expanded or none.
 * Separated from buildHierarchyState so callers can compose expansion state freely.
 */
export function buildInitialExpandedSet<TData>(
  data: readonly TData[],
  config: HierarchyConfig<TData>,
  defaultExpanded: boolean,
): Set<string | number> {
  const expanded = new Set<string | number>();
  if (defaultExpanded) {
    for (let i = 0; i < data.length; i++) {
      expanded.add(config.getRowId(data[i]!));
    }
  }
  return expanded;
}
