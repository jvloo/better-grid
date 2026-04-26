import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('event names', () => {
  test("'cell:change' (not 'data:change') fires on updateCell", () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [{ x: 1 }],
    });
    const events: string[] = [];
    grid.on('cell:change', () => events.push('cell:change'));
    // Listening to a stale name should not fire — bypass typing to attempt the old name
    (grid as unknown as { on(n: string, h: () => void): () => void }).on('data:change', () =>
      events.push('data:change'),
    );
    grid.updateCell(0, 'x', 2);
    expect(events).toContain('cell:change');
    expect(events).not.toContain('data:change');
  });
});
