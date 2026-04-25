import { describe, test, expect, vi } from 'vitest';
import { expandFeatureDeps, FEATURE_DEPS, FEATURE_NAMES } from '../src/presets/features';

describe('expandFeatureDeps', () => {
  test('passes through features with no deps', () => {
    expect(expandFeatureDeps(['sort'])).toEqual(['sort']);
  });

  test('auto-includes edit when undo is requested', () => {
    expect(expandFeatureDeps(['undo']).sort()).toEqual(['edit', 'undo']);
  });

  test('auto-includes edit when clipboard is requested', () => {
    expect(expandFeatureDeps(['clipboard']).sort()).toEqual(['clipboard', 'edit']);
  });

  test('does not duplicate already-included deps', () => {
    expect(expandFeatureDeps(['edit', 'undo']).sort()).toEqual(['edit', 'undo']);
  });

  test('warns in dev when auto-including a missing dep', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expandFeatureDeps(['undo']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'undo' requires 'edit'"));
    process.env.NODE_ENV = orig;
    warn.mockRestore();
  });

  test('FEATURE_DEPS keys are all members of FEATURE_NAMES', () => {
    for (const dep of Object.keys(FEATURE_DEPS)) {
      expect(FEATURE_NAMES).toContain(dep);
    }
  });
});
