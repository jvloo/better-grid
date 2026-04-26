import { describe, test, expect, beforeEach } from 'vitest';
import {
  configure,
  getGlobalFeatureOptions,
  _resetGlobalConfig,
} from '../src/configure';

describe('configure', () => {
  beforeEach(() => _resetGlobalConfig());

  test('stores per-feature options', () => {
    configure({ features: { edit: { commitOn: ['blur'] } } });
    expect(getGlobalFeatureOptions('edit')).toEqual({ commitOn: ['blur'] });
  });

  test('returns undefined for unconfigured features', () => {
    expect(getGlobalFeatureOptions('edit')).toBeUndefined();
  });

  test('overwrites prior config (last write wins per feature key)', () => {
    configure({ features: { edit: { commitOn: ['blur'] } } });
    configure({ features: { edit: { commitOn: ['enter'] } } });
    expect(getGlobalFeatureOptions('edit')).toEqual({ commitOn: ['enter'] });
  });

  test('preserves unrelated features across calls', () => {
    configure({ features: { edit: { commitOn: ['blur'] } } });
    configure({ features: { format: { locale: 'en-GB' } } });
    expect(getGlobalFeatureOptions('edit')).toEqual({ commitOn: ['blur'] });
    expect(getGlobalFeatureOptions('format')).toEqual({ locale: 'en-GB' });
  });
});
