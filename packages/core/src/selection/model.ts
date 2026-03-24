// ============================================================================
// Selection Model — Cell, range, and multi-range selection
// ============================================================================

import type { CellPosition, CellRange, Selection } from '../types';

export function createEmptySelection(): Selection {
  return { active: null, ranges: [] };
}

export function createCellSelection(cell: CellPosition): Selection {
  return {
    active: cell,
    ranges: [
      {
        startRow: cell.rowIndex,
        endRow: cell.rowIndex,
        startCol: cell.colIndex,
        endCol: cell.colIndex,
      },
    ],
  };
}

export function createRangeSelection(start: CellPosition, end: CellPosition): Selection {
  return {
    active: start,
    ranges: [normalizeRange(start, end)],
  };
}

export function extendSelection(selection: Selection, to: CellPosition): Selection {
  if (!selection.active) return createCellSelection(to);

  const newRange = normalizeRange(selection.active, to);
  return {
    active: selection.active,
    ranges: [newRange],
  };
}

export function addRangeToSelection(selection: Selection, range: CellRange): Selection {
  return {
    active: selection.active,
    ranges: [...selection.ranges, range],
  };
}

export function isCellInSelection(
  rowIndex: number,
  colIndex: number,
  selection: Selection,
): boolean {
  return selection.ranges.some(
    (r) =>
      rowIndex >= r.startRow &&
      rowIndex <= r.endRow &&
      colIndex >= r.startCol &&
      colIndex <= r.endCol,
  );
}

export function isCellActive(
  rowIndex: number,
  colIndex: number,
  selection: Selection,
): boolean {
  return selection.active?.rowIndex === rowIndex && selection.active?.colIndex === colIndex;
}

function normalizeRange(start: CellPosition, end: CellPosition): CellRange {
  return {
    startRow: Math.min(start.rowIndex, end.rowIndex),
    endRow: Math.max(start.rowIndex, end.rowIndex),
    startCol: Math.min(start.colIndex, end.colIndex),
    endCol: Math.max(start.colIndex, end.colIndex),
  };
}
