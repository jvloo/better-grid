import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGrid } from '../src/useGrid';

interface Row {
  id: number;
  name: string;
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

describe('useGrid: pinned rows', () => {
  test('syncs pinned top and bottom row props after mount', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');
    let handle: ReturnType<typeof useGrid<Row>> | null = null;

    function Probe(props: { top: Row[]; bottom: Row[] }) {
      handle = useGrid<Row>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: [{ id: 1, name: 'Alice' }],
        mode: null,
        pinned: {
          top: props.top,
          bottom: props.bottom,
        },
      });
      return React.createElement('div', {
        ref: handle.containerRef,
        style: { width: 400, height: 300 },
      });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);

    flushSync(() =>
      root.render(
        React.createElement(Probe, {
          top: [{ id: 10, name: 'initial top' }],
          bottom: [{ id: 20, name: 'initial bottom' }],
        }),
      ),
    );
    await flushEffects();

    expect(handle?.api.getPinnedTopRows()).toEqual([{ id: 10, name: 'initial top' }]);
    expect(handle?.api.getPinnedBottomRows()).toEqual([{ id: 20, name: 'initial bottom' }]);

    flushSync(() =>
      root.render(
        React.createElement(Probe, {
          top: [{ id: 11, name: 'updated top' }],
          bottom: [{ id: 21, name: 'updated bottom' }],
        }),
      ),
    );
    await flushEffects();

    expect(handle?.api.getPinnedTopRows()).toEqual([{ id: 11, name: 'updated top' }]);
    expect(handle?.api.getPinnedBottomRows()).toEqual([{ id: 21, name: 'updated bottom' }]);

    flushSync(() => root.unmount());
    document.body.removeChild(host);
  });
});

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
