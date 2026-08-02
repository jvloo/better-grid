import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useGrid } from '../src/useGrid';

interface Row {
  id: number;
  a: number;
  b: number;
  c: number;
  d: number;
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

function flushEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useGrid: frozen columns', () => {
  test('syncs the frozen-left count after mount', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');
    let handle: ReturnType<typeof useGrid<Row>> | null = null;

    function Probe(props: { frozenLeft: number }) {
      handle = useGrid<Row>({
        columns: [
          { field: 'a' as const, headerName: 'A', width: 100 },
          { field: 'b' as const, headerName: 'B', width: 100 },
          { field: 'c' as const, headerName: 'C', width: 100 },
          { field: 'd' as const, headerName: 'D', width: 100 },
        ],
        data: [{ id: 1, a: 1, b: 2, c: 3, d: 4 }],
        mode: null,
        frozen: { left: props.frozenLeft, clip: { minVisible: 1 } },
      });
      return React.createElement('div', {
        ref: handle.containerRef,
        style: { width: 400, height: 300 },
      });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);

    flushSync(() => root.render(React.createElement(Probe, { frozenLeft: 4 })));
    await flushEffects();

    expect(handle?.api.getState().frozen.left).toBe(4);

    flushSync(() => root.render(React.createElement(Probe, { frozenLeft: 2 })));
    await flushEffects();

    expect(handle?.api.getState().frozen.left).toBe(2);

    flushSync(() => root.unmount());
    document.body.removeChild(host);
  });
});

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
