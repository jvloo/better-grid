// ============================================================================
// Keyboard Navigation — Arrow, Tab, Enter, Escape handling
// ============================================================================

import type { CellPosition, Selection, KeyBinding } from '../types';

export interface NavigationBounds {
  rowCount: number;
  colCount: number;
  frozenTopRows: number;
  frozenLeftColumns: number;
}

/** Move the active cell in a direction, clamped to grid bounds */
export function navigateCell(
  active: CellPosition,
  direction: 'up' | 'down' | 'left' | 'right',
  bounds: NavigationBounds,
): CellPosition {
  const { rowCount, colCount } = bounds;
  let { rowIndex, colIndex } = active;

  switch (direction) {
    case 'up':
      rowIndex = Math.max(0, rowIndex - 1);
      break;
    case 'down':
      rowIndex = Math.min(rowCount - 1, rowIndex + 1);
      break;
    case 'left':
      colIndex = Math.max(0, colIndex - 1);
      break;
    case 'right':
      colIndex = Math.min(colCount - 1, colIndex + 1);
      break;
  }

  return { rowIndex, colIndex };
}

/** Handle Tab navigation — move right (or left with Shift), wrapping to next/prev row */
export function navigateTab(
  active: CellPosition,
  forward: boolean,
  bounds: NavigationBounds,
): CellPosition {
  const { rowCount, colCount } = bounds;
  let { rowIndex, colIndex } = active;

  if (forward) {
    colIndex++;
    if (colIndex >= colCount) {
      colIndex = 0;
      rowIndex = Math.min(rowCount - 1, rowIndex + 1);
    }
  } else {
    colIndex--;
    if (colIndex < 0) {
      colIndex = colCount - 1;
      rowIndex = Math.max(0, rowIndex - 1);
    }
  }

  return { rowIndex, colIndex };
}

/** Handle Enter navigation — move down (or up with Shift) */
export function navigateEnter(
  active: CellPosition,
  shiftKey: boolean,
  bounds: NavigationBounds,
): CellPosition {
  return navigateCell(active, shiftKey ? 'up' : 'down', bounds);
}

/** Map a keyboard event to a direction */
export function getNavigationDirection(
  event: KeyboardEvent,
): 'up' | 'down' | 'left' | 'right' | null {
  switch (event.key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    default:
      return null;
  }
}

/** Create the default keyboard bindings for grid navigation */
export function createDefaultKeyBindings(
  getSelection: () => Selection,
  setSelection: (selection: Selection) => void,
  bounds: () => NavigationBounds,
): KeyBinding[] {
  return [
    {
      key: 'ArrowUp',
      handler: () => handleArrow('up', getSelection, setSelection, bounds),
    },
    {
      key: 'ArrowDown',
      handler: () => handleArrow('down', getSelection, setSelection, bounds),
    },
    {
      key: 'ArrowLeft',
      handler: () => handleArrow('left', getSelection, setSelection, bounds),
    },
    {
      key: 'ArrowRight',
      handler: () => handleArrow('right', getSelection, setSelection, bounds),
    },
  ];
}

function handleArrow(
  direction: 'up' | 'down' | 'left' | 'right',
  getSelection: () => Selection,
  setSelection: (selection: Selection) => void,
  bounds: () => NavigationBounds,
): boolean {
  const selection = getSelection();
  if (!selection.active) return false;

  const newActive = navigateCell(selection.active, direction, bounds());
  setSelection({
    active: newActive,
    ranges: [
      {
        startRow: newActive.rowIndex,
        endRow: newActive.rowIndex,
        startCol: newActive.colIndex,
        endCol: newActive.colIndex,
      },
    ],
  });
  return true;
}
