import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useGrid } from '../src/useGrid';
import type { HeaderRow } from '@better-grid/core';

interface Row {
  a: string;
  b: string;
  c?: string;
}

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

const flushEffects = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('useGrid: header layout', () => {
  test('syncs changed headers without recreating the grid handle', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');
    let currentHandle: ReturnType<typeof useGrid<Row>> | null = null;
    const handles: ReturnType<typeof useGrid<Row>>[] = [];

    function Probe(props: { columns: Array<'a' | 'b' | 'c'>; headers: HeaderRow[] }) {
      currentHandle = useGrid<Row>({
        data: [{ a: 'a', b: 'b', c: 'c' }],
        columns: props.columns.map((id) => ({ id, field: id, headerName: id.toUpperCase() })),
        headers: props.headers,
        headerHeight: 44,
        mode: null,
      });
      handles.push(currentHandle);
      return React.createElement('div', {
        ref: currentHandle.containerRef,
        style: { width: 600, height: 300 },
      });
    }

    const firstHeaders: HeaderRow[] = [
      { id: 'first', cells: [{ id: 'a', columnId: 'a', content: 'A' }, { id: 'b', columnId: 'b', content: 'B' }] },
    ];
    const secondHeaders: HeaderRow[] = [
      { id: 'groups', cells: [{ id: 'a', columnId: 'a', content: 'A', rowSpan: 2 }, { id: 'group', content: 'Group', colSpan: 2 }] },
      { id: 'leaves', cells: [{ id: 'b', columnId: 'b', content: 'B' }, { id: 'c', columnId: 'c', content: 'C' }] },
    ];

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);

    flushSync(() => root.render(React.createElement(Probe, { columns: ['a', 'b'], headers: firstHeaders })));
    await flushEffects();
    const initialHandle = currentHandle;

    flushSync(() => root.render(React.createElement(Probe, { columns: ['a', 'b', 'c'], headers: secondHeaders })));
    await flushEffects();

    expect(currentHandle).toBe(initialHandle);
    expect(currentHandle?.api.getHeaderLayout()).toBe(secondHeaders);
    expect(host.textContent).toContain('Group');
    expect(host.textContent).toContain('C');
    expect(handles.every((handle) => handle === initialHandle)).toBe(true);

    flushSync(() => root.unmount());
  });
});

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
