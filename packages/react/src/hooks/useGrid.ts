// ============================================================================
// useGrid — React hook for Better Grid
// ============================================================================

import { useRef, useCallback, useEffect, useSyncExternalStore } from 'react';
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

  // Use useRef to create grid instance ONCE — survives StrictMode double-invoke
  const gridRef = useRef<GridInstance<TData, TPlugins> | null>(null);
  if (!gridRef.current) {
    gridRef.current = createGrid<TData, TPlugins>(optionsRef.current);
  }
  const grid = gridRef.current;

  // Create adapter for React state sync
  const adapterRef = useRef(createReactAdapter(grid));
  const adapter = adapterRef.current;

  // Subscribe to state changes for re-renders
  useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);

  // Track initial values to skip first effect run (columns/data are already
  // set during createGrid; re-setting them would overwrite plugin modifications
  // like hierarchy's column renderer wrapping).
  const initialDataRef = useRef(options.data);
  const initialColumnsRef = useRef(options.columns);

  // Sync data prop changes (skip initial — already set in createGrid)
  useEffect(() => {
    if (options.data !== initialDataRef.current) {
      grid.setData(options.data);
    }
  }, [options.data, grid]);

  // Sync column prop changes (skip initial — already set in createGrid)
  useEffect(() => {
    if (options.columns !== initialColumnsRef.current) {
      grid.setColumns(options.columns);
    }
  }, [options.columns, grid]);

  // Sync pinned row prop changes
  useEffect(() => {
    if (options.pinnedTopRows) {
      grid.setPinnedTopRows(options.pinnedTopRows);
    }
  }, [options.pinnedTopRows, grid]);

  useEffect(() => {
    if (options.pinnedBottomRows) {
      grid.setPinnedBottomRows(options.pinnedBottomRows);
    }
  }, [options.pinnedBottomRows, grid]);

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

  // Cleanup on true unmount
  useEffect(() => {
    return () => {
      gridRef.current?.destroy();
      gridRef.current = null;
    };
  }, []);

  return { grid, containerRef };
}
