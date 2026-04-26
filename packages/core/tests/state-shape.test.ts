import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('GridState shape mirrors GridOptions', () => {
  test('state.frozen / state.pinned exist and reflect options', () => {
    interface Row { x: string }
    const grid = createGrid<Row>({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      frozen: { top: 1, left: 2 },
      pinned: { top: [{ x: 'top' }], bottom: [{ x: 'bottom' }] },
    });
    const s = grid.getState();
    expect(s.frozen).toEqual({ top: 1, left: 2 });
    expect(s.pinned.top).toEqual([{ x: 'top' }]);
    expect(s.pinned.bottom).toEqual([{ x: 'bottom' }]);
  });

  test('default is { top: 0, left: 0 } / { top: [], bottom: [] }', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
    });
    const s = grid.getState();
    expect(s.frozen).toEqual({ top: 0, left: 0 });
    expect(s.pinned).toEqual({ top: [], bottom: [] });
  });
});
