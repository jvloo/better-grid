import { useEffect, useMemo, useRef } from 'react';
import { createGrid } from '@better-grid/core';
import type { GridInstance, GridPlugin } from '@better-grid/core';
import type { ReactGridOptions, GridHandle } from './types';
import {
  expandFeatureDeps,
  instantiateFeature,
  getCellRenderersPlugin,
  type FeatureName,
} from './presets/features';
import { resolveMode } from './presets/modes';
import { getGlobalFeatureOptions } from './configure';

const DEFAULT_MODE = 'view';

function resolvePlugins<TData, TContext>(
  options: ReactGridOptions<TData, TContext>,
): GridPlugin[] {
  // Step A: mode → baseline features
  const modeName = options.mode === undefined ? DEFAULT_MODE : options.mode;
  const modeDef = resolveMode(modeName);

  // Step B: per-grid features layered onto mode
  const requested = new Set<FeatureName>(modeDef.features);
  const perFeatureOpts = new Map<FeatureName, unknown>();

  if (Array.isArray(options.features)) {
    for (const name of options.features) requested.add(name);
  } else if (options.features) {
    for (const [name, val] of Object.entries(options.features) as [FeatureName, unknown][]) {
      if (val === false) requested.delete(name);
      else if (val === true) requested.add(name);
      else {
        requested.add(name);
        perFeatureOpts.set(name, val);
      }
    }
  }

  // Step C: expand dependencies
  const expanded = expandFeatureDeps(Array.from(requested));

  // Step D: instantiate. Per-grid opts > global > undefined.
  const featurePlugins: GridPlugin[] = [];
  for (const name of expanded) {
    const opts = perFeatureOpts.get(name) ?? getGlobalFeatureOptions(name);
    const instance = instantiateFeature(name, opts);
    if (instance) featurePlugins.push(instance);
  }

  // Step E: cellRenderers (always — registers built-in cell types)
  const allPlugins: GridPlugin[] = [getCellRenderersPlugin(), ...featurePlugins];

  // Step F: escape-hatch plugins (additive)
  if (options.plugins) allPlugins.push(...options.plugins);

  return allPlugins;
}

export function useGrid<TData = unknown, TContext = unknown>(
  options: ReactGridOptions<TData, TContext>,
): GridHandle<TData, TContext> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Build the grid once. Plugin set is computed at mount and locked.
  // Feature swaps mid-lifetime are out of scope for v1.
  const grid = useMemo<GridInstance<TData>>(() => {
    const plugins = resolvePlugins(options);
    return createGrid<TData, TContext>({
      ...options,
      plugins,
      context: options.context,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync context to grid every render (cheap — ref update only).
  useEffect(() => {
    grid.setContext(options.context);
  });

  // Sync data + columns when their identity changes.
  useEffect(() => {
    grid.setData(options.data);
  }, [grid, options.data]);

  useEffect(() => {
    grid.setColumns(options.columns);
  }, [grid, options.columns]);

  // Container ref: mount/unmount on attach
  const mountedRef = useRef<HTMLElement | null>(null);
  const containerRef = (el: HTMLElement | null) => {
    if (el === mountedRef.current) return;
    if (mountedRef.current) grid.unmount();
    mountedRef.current = el;
    if (el) grid.mount(el);
  };

  useEffect(
    () => () => {
      if (mountedRef.current) grid.unmount();
    },
    [grid],
  );

  return {
    api: grid,
    containerRef,
    _internal: {
      contextRef: { current: options.context },
    },
  };
}
