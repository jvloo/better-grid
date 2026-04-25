import { describe, test, expect, beforeEach } from 'vitest';
import {
  configureBetterGrid,
  getGlobalFeatureOptions,
  _resetGlobalConfig,
} from '../src/configureBetterGrid';

describe('configureBetterGrid', () => {
  beforeEach(() => _resetGlobalConfig());

  test('stores per-feature options', () => {
    configureBetterGrid({ features: { edit: { commitOn: ['blur'] } } });
    expect(getGlobalFeatureOptions('edit')).toEqual({ commitOn: ['blur'] });
  });

  test('returns undefined for unconfigured features', () => {
    expect(getGlobalFeatureOptions('edit')).toBeUndefined();
  });

  test('overwrites prior config (last write wins per feature key)', () => {
    configureBetterGrid({ features: { edit: { commitOn: ['blur'] } } });
    configureBetterGrid({ features: { edit: { commitOn: ['enter'] } } });
    expect(getGlobalFeatureOptions('edit')).toEqual({ commitOn: ['enter'] });
  });

  test('preserves unrelated features across calls', () => {
    configureBetterGrid({ features: { edit: { commitOn: ['blur'] } } });
    configureBetterGrid({ features: { format: { locale: 'en-GB' } } });
    expect(getGlobalFeatureOptions('edit')).toEqual({ commitOn: ['blur'] });
    expect(getGlobalFeatureOptions('format')).toEqual({ locale: 'en-GB' });
  });
});
