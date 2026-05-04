import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGrid } from '../src/useGrid';
import type { GridInstance, SetDataOptions } from '@better-grid/core';

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

function wrapSetData(grid: GridInstance<Row>, seenOptions: (SetDataOptions | undefined)[]): void {
  const wrapped = grid as GridInstance<Row> & { __setDataWrapped?: boolean };
  if (wrapped.__setDataWrapped) return;
  const original = grid.setData.bind(grid);
  grid.setData = ((data: Row[], options?: SetDataOptions) => {
    seenOptions.push(options);
    original(data, options);
  }) as typeof grid.setData;
  wrapped.__setDataWrapped = true;
}

describe('useGrid: setDataOptions', () => {
  test('keeps default prop-driven data sync behavior when setDataOptions is omitted', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');
    const seenOptions: (SetDataOptions | undefined)[] = [];

    function Probe(props: { rows: Row[] }) {
      const handle = useGrid<Row>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: props.rows,
        mode: null,
      });
      wrapSetData(handle.api, seenOptions);
      return React.createElement('div', { ref: handle.containerRef, style: { width: 400, height: 300 } });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);

    flushSync(() => root.render(React.createElement(Probe, { rows: [{ id: 1, name: 'Alice' }] })));
    await flushEffects();
    flushSync(() => root.render(React.createElement(Probe, { rows: [{ id: 2, name: 'Bob' }] })));
    await flushEffects();

    expect(seenOptions.at(-1)).toBeUndefined();

    flushSync(() => root.unmount());
    document.body.removeChild(host);
  });

  test('passes setDataOptions to core when data prop identity changes', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');
    const seenOptions: (SetDataOptions | undefined)[] = [];
    const setDataOptions = { preserveScroll: true };

    function Probe(props: { rows: Row[] }) {
      const handle = useGrid<Row>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: props.rows,
        mode: null,
        setDataOptions,
      });
      wrapSetData(handle.api, seenOptions);
      return React.createElement('div', { ref: handle.containerRef, style: { width: 400, height: 300 } });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);

    flushSync(() => root.render(React.createElement(Probe, { rows: [{ id: 1, name: 'Alice' }] })));
    await flushEffects();
    flushSync(() => root.render(React.createElement(Probe, { rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] })));
    await flushEffects();

    expect(seenOptions.at(-1)).toEqual({ preserveScroll: true });

    flushSync(() => root.unmount());
    document.body.removeChild(host);
  });
});

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
