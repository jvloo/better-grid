import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGrid } from '../src/useGrid';

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

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

/**
 * Pins the contract that `useGrid` (and `<BetterGrid>` sugar) defaults to
 * `mode={null}` when `mode` is omitted — i.e. NO feature plugins are loaded.
 *
 * The cellRenderers plugin is the lone always-loaded plugin (it registers
 * built-in cell types and is required for `cellType: 'currency' | 'badge' | ...`
 * to render). Everything else (sort, filter, edit, clipboard, undo, ...) is
 * opt-in via `mode="view"` (or higher) or via the `features` prop.
 */
describe('useGrid: default mode is null (no preset features)', () => {
  test('omitting mode loads only the cellRenderers plugin', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');

    let pluginIds: string[] = [];

    function Probe() {
      const handle = useGrid<{ id: number; name: string }>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: [{ id: 1, name: 'Alice' }],
        // mode is intentionally omitted — should resolve to null (no defaults).
      });
      pluginIds = Reflect.ownKeys(handle.api.plugins as object) as string[];
      return React.createElement('div', {
        ref: handle.containerRef,
        style: { width: 400, height: 300 },
      });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);
    flushSync(() => root.render(React.createElement(Probe)));

    // cellRenderers is always wired (registers built-in cell types).
    expect(pluginIds).toContain('cell-renderers');

    // Mode = null means NO feature plugins are loaded.
    const featurePlugins = ['sorting', 'filtering', 'editing', 'clipboard', 'undoRedo', 'formatting', 'validation', 'hierarchy', 'search', 'pagination', 'grouping', 'export'];
    for (const p of featurePlugins) {
      expect(pluginIds).not.toContain(p);
    }

    flushSync(() => root.unmount());
    document.body.removeChild(host);
  });

  test('explicit mode="view" still loads sort + filter feature plugins', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');

    let pluginIds: string[] = [];

    function Probe() {
      const handle = useGrid<{ id: number; name: string }>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: [{ id: 1, name: 'Alice' }],
        mode: 'view',
      });
      pluginIds = Reflect.ownKeys(handle.api.plugins as object) as string[];
      return React.createElement('div', {
        ref: handle.containerRef,
        style: { width: 400, height: 300 },
      });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);
    flushSync(() => root.render(React.createElement(Probe)));

    // mode="view" pulls in sort + filter (resize/select are core, no plugin).
    expect(pluginIds).toContain('cell-renderers');
    expect(pluginIds).toContain('sorting');
    expect(pluginIds).toContain('filtering');

    flushSync(() => root.unmount());
    document.body.removeChild(host);
  });

  test('explicit mode={null} matches omitting mode', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');

    let withNull: string[] = [];
    let withOmit: string[] = [];

    function ProbeNull() {
      const handle = useGrid<{ id: number; name: string }>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: [{ id: 1, name: 'Alice' }],
        mode: null,
      });
      withNull = Reflect.ownKeys(handle.api.plugins as object) as string[];
      return React.createElement('div', { ref: handle.containerRef, style: { width: 400, height: 300 } });
    }
    function ProbeOmit() {
      const handle = useGrid<{ id: number; name: string }>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: [{ id: 1, name: 'Alice' }],
      });
      withOmit = Reflect.ownKeys(handle.api.plugins as object) as string[];
      return React.createElement('div', { ref: handle.containerRef, style: { width: 400, height: 300 } });
    }

    const host1 = document.createElement('div');
    const host2 = document.createElement('div');
    document.body.appendChild(host1);
    document.body.appendChild(host2);
    const root1 = ReactDOMClient.createRoot(host1);
    const root2 = ReactDOMClient.createRoot(host2);
    flushSync(() => root1.render(React.createElement(ProbeNull)));
    flushSync(() => root2.render(React.createElement(ProbeOmit)));

    expect(withOmit.sort()).toEqual(withNull.sort());

    flushSync(() => root1.unmount());
    flushSync(() => root2.unmount());
    document.body.removeChild(host1);
    document.body.removeChild(host2);
  });
});
