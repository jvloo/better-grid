import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';
import type { CellChange } from '../src/types';

describe('CellChange.oldValue semantics', () => {
  test('oldValue is the previous CELL value (not the previous row object)', () => {
    const grid = createGrid<{ amount: number; name: string }>({
      columns: [
        { field: 'amount' as never, headerName: 'Amount' },
        { field: 'name' as never, headerName: 'Name' },
      ],
      data: [{ amount: 100, name: 'A' }],
    });

    const captured: CellChange[] = [];
    // Note: the event name is still 'cell:change' until T18 renames it.
    grid.on('cell:change' as never, ((changes: CellChange[]) => { captured.push(...changes); }) as never);

    grid.updateCell(0, 'amount', 250);

    expect(captured.length).toBe(1);
    expect(captured[0].oldValue).toBe(100);            // CELL value, not the row object
    expect(captured[0].newValue).toBe(250);
    expect(captured[0].row).toEqual({ amount: 250, name: 'A' });   // new row
    expect(captured[0].columnId).toBe('amount');
  });

  test('updateCells emits one batched change payload', () => {
    const emitted: CellChange[] = [];
    const optionCalls: CellChange[][] = [];
    const grid = createGrid<{ amount: number; name: string }>({
      columns: [
        { field: 'amount' as never, headerName: 'Amount' },
        { field: 'name' as never, headerName: 'Name' },
      ],
      data: [
        { amount: 100, name: 'A' },
        { amount: 200, name: 'B' },
      ],
      onCellChange: (changes) => optionCalls.push(changes),
    });

    grid.on('cell:change' as never, ((changes: CellChange[]) => { emitted.push(...changes); }) as never);

    grid.updateCells([
      { rowIndex: 0, columnId: 'amount', value: 150 },
      { rowIndex: 1, columnId: 'name', value: 'Updated' },
    ]);

    expect(optionCalls).toHaveLength(1);
    expect(optionCalls[0]).toHaveLength(2);
    expect(emitted).toHaveLength(2);
    expect(emitted.map((change) => [change.rowIndex, change.columnId, change.oldValue, change.newValue])).toEqual([
      [0, 'amount', 100, 150],
      [1, 'name', 'B', 'Updated'],
    ]);
    expect(grid.getData()).toEqual([
      { amount: 150, name: 'A' },
      { amount: 200, name: 'Updated' },
    ]);
  });
});
