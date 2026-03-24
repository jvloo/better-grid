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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      grid.destroy();
    };
  }, [grid]);

  return { grid, containerRef };
}
