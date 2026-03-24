// ============================================================================
// React Adapter — Bridges imperative core to React's declarative model
// ============================================================================

import type { GridInstance, GridState } from '@better-grid/core';

export interface ReactGridAdapter<TData = unknown> {
  grid: GridInstance<TData>;
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => GridState<TData>;
}

export function createReactAdapter<TData = unknown>(
  grid: GridInstance<TData>,
): ReactGridAdapter<TData> {
  let snapshot = grid.getState();

  const listeners = new Set<() => void>();

  // Subscribe to all state-changing events
  const unsubs = [
    grid.on('selection:change', updateSnapshot),
    grid.on('data:change', updateSnapshot),
    grid.on('data:set', updateSnapshot),
    grid.on('scroll', updateSnapshot),
    grid.on('column:resize', updateSnapshot),
    grid.on('render', updateSnapshot),
  ];

  function updateSnapshot(): void {
    snapshot = grid.getState();
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    grid,
    subscribe(callback: () => void) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
        if (listeners.size === 0) {
          for (const unsub of unsubs) {
            unsub();
          }
        }
      };
    },
    getSnapshot() {
      return snapshot;
    },
  };
}
