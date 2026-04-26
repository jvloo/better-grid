import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('column.id default', () => {
  test('defaults to field when omitted', () => {
    const grid = createGrid<{ name: string }>({
      columns: [{ field: 'name' as never, headerName: 'Name' }],
      data: [{ name: 'Alice' }],
    });
    expect(grid.getState().columns[0].id).toBe('name');
  });

  test('explicit id wins over field', () => {
    const grid = createGrid<{ name: string }>({
      columns: [{ id: 'nameOverride', field: 'name' as never, headerName: 'Name' }],
      data: [],
    });
    expect(grid.getState().columns[0].id).toBe('nameOverride');
  });

  test('throws when both id and field are missing', () => {
    expect(() =>
      createGrid({
        columns: [{ headerName: 'Empty' } as never],
        data: [],
      }),
    ).toThrow(/id or field/i);
  });
});
