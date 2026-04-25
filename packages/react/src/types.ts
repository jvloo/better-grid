import type { GridInstance, GridOptions, GridPlugin } from '@better-grid/core';
import type { FeatureName } from './presets/features';

export interface ReactGridOptions<TData = unknown, TContext = unknown>
  extends Omit<GridOptions<TData, TContext>, 'plugins'> {
  /**
   * Mode preset. `null` = no defaults. Default if omitted: 'view'.
   */
  mode?: 'view' | 'interactive' | 'spreadsheet' | 'dashboard' | (string & {}) | null;

  /**
   * Feature opt-in. String form uses global config (configureBetterGrid).
   * Object form overrides global per-key. Additive on top of `mode`.
   */
  features?: FeatureName[] | Partial<Record<FeatureName, boolean | object>>;

  /**
   * Escape hatch: full plugin instances. Additive — bypasses mode/features
   * resolution for these plugins.
   */
  plugins?: GridPlugin[];
}

export interface GridHandle<TData = unknown, TContext = unknown> {
  /** Imperative API — same shape as core's GridInstance. */
  api: GridInstance<TData>;
  /** Ref to attach to a DOM element. */
  containerRef: (el: HTMLElement | null) => void;
  /** Internal — consumed by <BetterGrid>. Do not depend on the shape. */
  _internal: { contextRef: { current: TContext | undefined } };
}
