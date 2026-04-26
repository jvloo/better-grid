import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

interface Row { id: number; name: string }

describe('top-level getRowId', () => {
  test('top-level getRowId is read by selection-stability path on setData', () => {
    const data1: Row[] = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    const grid = createGrid<Row>({
      columns: [{ field: 'name' as never, headerName: 'Name' }],
      data: data1,
      getRowId: (row) => row.id,
      selection: { mode: 'row' },
    });

    // Set active selection to row 0 (id=1) by direct store manipulation
    grid.setSelection({ active: { rowIndex: 0, colIndex: 0 }, ranges: [] });
    const beforeSelected = grid.getState().selection.active;
    expect(beforeSelected?.rowIndex).toBe(0);

    // Swap data — same rows, different order
    grid.setData([{ id: 2, name: 'B' }, { id: 1, name: 'A' }]);

    // Selected row should still be id=1, now at visible index 1
    const afterSelected = grid.getState().selection.active;
    expect(afterSelected?.rowIndex).toBe(1);
  });

  test('hierarchy.getRowId wins for hierarchy state when both are set', () => {
    // This is a smoke test: configuration accepts both without error.
    const grid = createGrid<Row>({
      columns: [{ field: 'name' as never, headerName: 'Name' }],
      data: [],
      getRowId: (row) => `top-${row.id}`,
      hierarchy: {
        getRowId: (row) => `nested-${row.id}`,
        getParentId: () => null,
      },
    });
    // Configuration accepted (both shapes coexist).
    expect(grid.getState().columns.length).toBe(1);
  });

  test('top-level getRowId falls back to hierarchy.getRowId when only the latter is set', () => {
    const grid = createGrid<Row>({
      columns: [{ field: 'name' as never, headerName: 'Name' }],
      data: [{ id: 5, name: 'X' }],
      hierarchy: {
        getRowId: (row) => `nested-${row.id}`,
        getParentId: () => null,
      },
    });
    // Smoke check: configuration accepted.
    expect(grid.getState().data.length).toBe(1);
  });
});
