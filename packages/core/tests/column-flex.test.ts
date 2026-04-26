import { describe, test, expect } from 'vitest';
import { computeColumnWidths } from '../src/virtualization/layout';
import type { ColumnDef } from '../src/types';

function col(id: string, opts: Partial<ColumnDef> = {}): ColumnDef {
  return { id, headerName: id, ...opts } as ColumnDef;
}

describe('column.flex', () => {
  test('distributes spare width by flex ratio', () => {
    // Viewport 1000px, 3 columns with widths [100, 100, 100] (total base 300)
    // Spare = 1000 - 300 = 700
    // Col 1: no flex → 100
    // Col 2: flex 1 → 100 + 700 * (1/3) ≈ 333.33
    // Col 3: flex 2 → 100 + 700 * (2/3) ≈ 566.67
    const widths = computeColumnWidths({
      columns: [
        col('a', { width: 100 }),
        col('b', { width: 100, flex: 1 }),
        col('c', { width: 100, flex: 2 }),
      ],
      viewportWidth: 1000,
    });
    expect(widths[0]).toBe(100);
    expect(widths[1]).toBeCloseTo(333.33, 1);
    expect(widths[2]).toBeCloseTo(566.67, 1);
  });

  test('clamps flex result to maxWidth', () => {
    const widths = computeColumnWidths({
      columns: [
        col('a', { width: 100, flex: 1, maxWidth: 200 }),
        col('b', { width: 100, flex: 1 }),
      ],
      viewportWidth: 1000,
    });
    // Spare 800; equal split would give each 100 + 400 = 500.
    // Col a is clamped to 200; col b absorbs the leftover spare.
    expect(widths[0]).toBe(200);
    expect(widths[1]).toBe(800);
  });

  test('no-flex case is a passthrough (returns base widths)', () => {
    const widths = computeColumnWidths({
      columns: [
        col('a', { width: 100 }),
        col('b', { width: 200 }),
      ],
      viewportWidth: 1000,
    });
    expect(widths[0]).toBe(100);
    expect(widths[1]).toBe(200);
  });
});
