import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGrid } from '../src/useGrid';
import type { GridPlugin } from '@better-grid/core';

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

function flushDeferredDestroy(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useGrid: lifecycle cleanup', () => {
  test('destroys plugins after a real React unmount', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');

    const cleanup = vi.fn();
    const plugin: GridPlugin = {
      id: 'cleanup-probe',
      init: () => cleanup,
    };

    function Probe() {
      const handle = useGrid<{ name: string }>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: [{ name: 'Alice' }],
        mode: null,
        plugins: [plugin],
      });

      return React.createElement('div', {
        ref: handle.containerRef,
        style: { width: 400, height: 300 },
      });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);

    flushSync(() => root.render(React.createElement(Probe)));
    expect(cleanup).not.toHaveBeenCalled();

    flushSync(() => root.unmount());
    await flushDeferredDestroy();

    expect(cleanup).toHaveBeenCalledTimes(1);
    document.body.removeChild(host);
  });
});

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
