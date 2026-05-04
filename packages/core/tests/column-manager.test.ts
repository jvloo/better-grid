import { describe, expect, it } from 'vitest';
import { ColumnManager } from '../src/columns/manager';
import type { ColumnDef } from '../src/types';

function col(id: string, def: Partial<ColumnDef> = {}): ColumnDef {
  return { id, field: id, headerName: id, ...def };
}

describe('ColumnManager sizing defaults', () => {
  it('applies grid-level min/max defaults when column values are omitted', () => {
    const manager = new ColumnManager({
      defaultMinWidth: 80,
      defaultMaxWidth: 180,
    });
    manager.setColumns([col('a', { width: 40 }), col('b', { width: 240 })]);

    expect(manager.getWidth(0)).toBe(80);
    expect(manager.getWidth(1)).toBe(180);

    manager.setWidth(0, 20);
    manager.setWidth(1, 260);

    expect(manager.getWidth(0)).toBe(80);
    expect(manager.getWidth(1)).toBe(180);
  });

  it('lets per-column min/max override grid-level defaults', () => {
    const manager = new ColumnManager({
      defaultMinWidth: 80,
      defaultMaxWidth: 180,
    });
    manager.setColumns([
      col('a', { width: 40, minWidth: 30 }),
      col('b', { width: 240, maxWidth: 300 }),
    ]);

    expect(manager.getWidth(0)).toBe(40);
    expect(manager.getWidth(1)).toBe(240);
  });

  it('preserves explicit narrow widths for non-resizable utility columns', () => {
    const manager = new ColumnManager({
      defaultMinWidth: 50,
      defaultMaxWidth: 300,
    });
    manager.setColumns([
      col('actions', { width: 30, resizable: false }),
      col('collapse', { width: 32, resizable: false }),
      col('name', { width: 40 }),
    ]);

    expect(manager.getWidth(0)).toBe(30);
    expect(manager.getWidth(1)).toBe(32);
    expect(manager.getWidth(2)).toBe(50);
  });
});
