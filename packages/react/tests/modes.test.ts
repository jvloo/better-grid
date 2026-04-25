import { describe, test, expect } from 'vitest';
import { resolveMode, BUILT_IN_MODES } from '../src/presets/modes';

describe('resolveMode', () => {
  test('null returns empty defaults', () => {
    expect(resolveMode(null)).toEqual({ features: [], defaults: {} });
  });

  test('view returns sort/filter/resize/select', () => {
    expect(resolveMode('view').features.sort()).toEqual(['filter', 'resize', 'select', 'sort']);
  });

  test('interactive includes view features plus reorder', () => {
    const res = resolveMode('interactive');
    expect(res.features).toContain('reorder');
    expect(res.features).toContain('sort');
  });

  test('spreadsheet includes interactive features plus edit/clipboard/undo', () => {
    const res = resolveMode('spreadsheet');
    expect(res.features).toEqual(expect.arrayContaining(['edit', 'clipboard', 'undo', 'reorder', 'sort']));
  });

  test('dashboard includes view + export, NOT edit', () => {
    const res = resolveMode('dashboard');
    expect(res.features).toContain('export');
    expect(res.features).not.toContain('edit');
  });

  test('unknown mode throws', () => {
    expect(() => resolveMode('nonexistent' as never)).toThrow(/unknown mode/i);
  });

  test('BUILT_IN_MODES has all five', () => {
    expect(Object.keys(BUILT_IN_MODES).sort()).toEqual(['dashboard', 'interactive', 'spreadsheet', 'view']);
  });
});
