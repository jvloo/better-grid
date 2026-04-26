import { describe, test, expect } from 'vitest';
import { runTransform } from '../src/runner';

describe('runner', () => {
  test('throws on unknown transform', async () => {
    await expect(runTransform({ transform: 'from-bogus', paths: ['/tmp'] })).rejects.toThrow(/Unknown transform/);
  });
});
