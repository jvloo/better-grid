// ============================================================================
// useGrid — React hook for Better Grid
// ============================================================================

import { useMemo, useRef, useCallback, useEffect, useSyncExternalStore } from 'react';
import { createGrid } from '@better-grid/core';
import type { GridOptions, GridInstance, GridPlugin } from '@better-grid/core';
import { createReactAdapter } from '../adapters/react-adapter';

export function useGrid<
  TData = unknown,
  TPlugins extends GridPlugin[] = GridPlugin[],
>(
  options: GridOptions<TData, TPlugins>,
): {
  grid: GridInstance<TData, TPlugins>;
  containerRef: React.RefCallback<HTMLElement>;
} {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Create grid instance once
  const grid = useMemo(
    () => createGrid<TData, TPlugins>(optionsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Create adapter for React state sync
  const adapter = useMemo(() => createReactAdapter(grid), [grid]);

  // Subscribe to state changes for re-renders
  useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);

  // Sync data prop changes
  useEffect(() => {
    grid.setData(options.data);
  }, [options.data, grid]);

  // Sync column prop changes
  useEffect(() => {
    grid.setColumns(options.columns);
  }, [options.columns, grid]);

  // Ref callback for mount/unmount
  const containerRef = useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        grid.mount(node);
      } else {
        grid.unmount();
      }
    },
    [grid],
  );

  // Cleanup: only destroy when the grid instance itself changes (which is never
  // since useMemo deps are []), effectively running only on true unmount.
  // StrictMode double-invokes effects but the ref callback handles mount/unmount.
  useEffect(() => {
    return () => {
      // Delay destroy to next frame — if StrictMode re-mounts,
      // the mount() call will happen synchronously in the same tick,
      // setting mounted=true before this timeout fires.
      setTimeout(() => {
        grid.destroy();
      }, 0);
    };
  }, [grid]);

  return { grid, containerRef };
}
