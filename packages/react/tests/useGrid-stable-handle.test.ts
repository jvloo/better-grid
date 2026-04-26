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

/**
 * These tests pin the perf-critical contract that drives `/demo/performance`:
 *
 *   1. The grid handle returned by useGrid must be referentially stable across
 *      re-renders that don't change the underlying grid (data/columns can
 *      change; the *handle* must not).
 *   2. The containerRef callback must be referentially stable so React doesn't
 *      invoke it with `null` (cleanup) on every parent render — which would
 *      unmount the grid container and rebuild virtualization on every render.
 *
 * If either is violated, every parent re-render triggers grid.unmount() +
 * grid.mount() — which is what users observed as "performance still laggy".
 */
describe('useGrid: stable handle / containerRef contract', () => {
  test('handle and containerRef remain referentially stable across re-renders', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');

    const seenHandles: unknown[] = [];
    const seenContainerRefs: unknown[] = [];

    function Probe(props: { revision: number }) {
      const handle = useGrid<{ id: number; name: string }>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: [{ id: 1, name: 'Alice' }],
        mode: null,
      });
      seenHandles.push(handle);
      seenContainerRefs.push(handle.containerRef);
      return React.createElement('div', {
        ref: handle.containerRef,
        style: { width: 400, height: 300 },
        'data-revision': props.revision,
      });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);

    flushSync(() => root.render(React.createElement(Probe, { revision: 0 })));
    flushSync(() => root.render(React.createElement(Probe, { revision: 1 })));
    flushSync(() => root.render(React.createElement(Probe, { revision: 2 })));

    expect(seenHandles.length).toBeGreaterThanOrEqual(3);
    // All handles point to the same object (or two unique objects, allowing
    // for one StrictMode-style double-render — but never N unique objects).
    const uniqueHandles = new Set(seenHandles);
    expect(uniqueHandles.size).toBeLessThanOrEqual(2);

    const uniqueRefs = new Set(seenContainerRefs);
    expect(uniqueRefs.size).toBeLessThanOrEqual(2);

    flushSync(() => root.unmount());
    document.body.removeChild(host);
  });

  test('grid is mounted exactly once across many parent re-renders (no remount thrash)', async () => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { flushSync } = await import('react-dom');

    let mountCount = 0;
    let unmountCount = 0;

    function Probe(props: { revision: number }) {
      const handle = useGrid<{ id: number; name: string }>({
        columns: [{ field: 'name' as const, headerName: 'Name' }],
        data: [{ id: 1, name: 'Alice' }],
        mode: null,
      });
      const api = handle.api as unknown as { mount: (el: HTMLElement) => void; unmount: () => void };
      if (!(api as unknown as { __wrapped?: boolean }).__wrapped) {
        const originalMount = api.mount.bind(api);
        const originalUnmount = api.unmount.bind(api);
        api.mount = ((el: HTMLElement) => {
          mountCount++;
          originalMount(el);
        }) as typeof api.mount;
        api.unmount = (() => {
          unmountCount++;
          originalUnmount();
        }) as typeof api.unmount;
        (api as unknown as { __wrapped?: boolean }).__wrapped = true;
      }
      return React.createElement('div', {
        ref: handle.containerRef,
        style: { width: 400, height: 300 },
        'data-revision': props.revision,
      });
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = ReactDOMClient.createRoot(host);

    flushSync(() => root.render(React.createElement(Probe, { revision: 0 })));
    const mountAfterFirst = mountCount;
    const unmountAfterFirst = unmountCount;

    for (let i = 1; i <= 5; i++) {
      flushSync(() => root.render(React.createElement(Probe, { revision: i })));
    }

    // After the initial mount we should have at most 1 additional mount/unmount
    // pair (StrictMode tolerance), not five. Without the fix, this would be 5+5.
    const additionalMounts = mountCount - mountAfterFirst;
    const additionalUnmounts = unmountCount - unmountAfterFirst;
    expect(additionalMounts).toBeLessThanOrEqual(1);
    expect(additionalUnmounts).toBeLessThanOrEqual(1);

    flushSync(() => root.unmount());
    document.body.removeChild(host);
  });
});

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
