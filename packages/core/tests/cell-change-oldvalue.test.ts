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
});
