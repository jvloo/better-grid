import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef } from '../src/types';

describe('createGrid context ref', () => {
  let host: HTMLElement;
  let originalRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    host = document.createElement('div');
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
    document.body.appendChild(host);
    // Make rAF fire synchronously so render() runs before our assertions
    originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    host.remove();
    document.body.innerHTML = '';
  });

  test('cellRenderer receives the latest context value after setContext', () => {
    const seen: unknown[] = [];
    const columns: ColumnDef[] = [{
      id: 'name',
      header: 'Name',
      field: 'name' as never,
      cellRenderer: (container, ctx) => {
        seen.push(ctx.context);
        container.textContent = String(ctx.value ?? '');
      },
    }];
    const data = [{ name: 'a' }, { name: 'b' }];
    const grid = createGrid({ data, columns, context: { v: 1 } });

    grid.mount(host);
    grid.refresh();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(c => (c as { v: number })?.v === 1)).toBe(true);

    seen.length = 0;
    grid.setContext({ v: 2 });
    grid.refresh();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(c => (c as { v: number })?.v === 2)).toBe(true);

    grid.unmount();
  });

  test('context defaults to undefined when not passed', () => {
    const seen: unknown[] = [];
    const columns: ColumnDef[] = [{
      id: 'name',
      header: 'Name',
      field: 'name' as never,
      cellRenderer: (container, ctx) => {
        seen.push(ctx.context);
        container.textContent = String(ctx.value ?? '');
      },
    }];
    const grid = createGrid({ data: [{ name: 'a' }], columns });
    grid.mount(host);
    grid.refresh();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(c => c === undefined)).toBe(true);
    grid.unmount();
  });
});
