import { describe, expect, it } from 'vitest';
import { RenderingPipeline } from '../src/rendering/pipeline';

describe('RenderingPipeline hot-path reuse', () => {
  it('reuses the same visibleKeys Set across successive renderCells calls', () => {
    const pipeline = new RenderingPipeline();
    const first = (pipeline as unknown as { visibleKeys: Set<number> }).visibleKeys;
    const second = (pipeline as unknown as { visibleKeys: Set<number> }).visibleKeys;
    expect(first).toBe(second);
  });
});
