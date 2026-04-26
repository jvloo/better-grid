import { describe, test, expect } from 'vitest';
import { createGrid } from '../src/grid';

describe('selection discriminated union', () => {
  test('default is { mode: "cell" }', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [{ x: 1 }],
    });
    expect(grid.getSelectionMode()).toBe('cell');
  });

  test('selection=false yields mode "off" and empty selection state', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [{ x: 1 }],
      selection: false,
    });
    expect(grid.getSelectionMode()).toBe('off');
    expect(grid.getState().selection).toEqual({ active: null, ranges: [] });
  });

  test('row mode', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      selection: { mode: 'row' },
    });
    expect(grid.getSelectionMode()).toBe('row');
  });

  test('range mode accepts multiRange + fillHandle', () => {
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      selection: { mode: 'range', multiRange: true, fillHandle: true },
    });
    expect(grid.getSelectionMode()).toBe('range');
  });
});
