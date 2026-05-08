import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef } from '../src/types';

interface Row {
  enabled: boolean;
}

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 240 });
  document.body.appendChild(host);
  return host;
}

describe('render cleanup pruning', () => {
  it('removes stale cleanup callbacks when the next render has none', () => {
    const host = makeHost();
    let cleanupCalls = 0;

    const columns: ColumnDef<Row>[] = [
      {
        id: 'enabled',
        field: 'enabled',
        headerName: 'Enabled',
        width: 120,
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? 'on' : 'off';
          if (!ctx.value) return undefined;
          return () => {
            cleanupCalls++;
          };
        },
      },
    ];
    const grid = createGrid<Row>({
      columns,
      data: [{ enabled: true }],
      rowHeight: 40,
      headerHeight: 40,
    });

    grid.mount(host);
    grid.updateCell(0, 'enabled', false);

    expect(cleanupCalls).toBe(1);

    grid.refresh();

    expect(cleanupCalls).toBe(1);

    grid.unmount();
  });
});
