import type { GridPlugin } from '@better-grid/core';
import {
  formatting, editing, sorting, filtering, clipboard, undoRedo, exportPlugin,
  search, pagination, grouping, hierarchy, validation, cellRenderers,
} from '@better-grid/plugins';

// Avoid pulling in @types/node just for NODE_ENV checks (matches core convention).
declare const process: { env: { NODE_ENV?: string } };

export const FEATURE_NAMES = [
  'format', 'edit', 'sort', 'filter', 'select', 'resize', 'reorder',
  'clipboard', 'undo', 'export', 'search', 'pagination', 'grouping',
  'hierarchy', 'validation',
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];

/**
 * Features that need other features. Auto-included with a dev-mode warning.
 */
export const FEATURE_DEPS: Partial<Record<FeatureName, FeatureName[]>> = {
  undo: ['edit'],
  clipboard: ['edit'],
};

/**
 * Map a feature name + its options to a plugin instance.
 * Some features (`select`, `resize`, `reorder`) are not standalone plugins —
 * they're handled by core or no-op here.
 */
export function instantiateFeature(name: FeatureName, opts: unknown): GridPlugin | null {
  switch (name) {
    case 'format':     return formatting(opts as Parameters<typeof formatting>[0]);
    case 'edit':       return editing(opts as Parameters<typeof editing>[0]);
    case 'sort':       return sorting(opts as Parameters<typeof sorting>[0]);
    case 'filter':     return filtering(opts as Parameters<typeof filtering>[0]);
    case 'clipboard':  return clipboard(opts as Parameters<typeof clipboard>[0]);
    case 'undo':       return undoRedo(opts as Parameters<typeof undoRedo>[0]);
    case 'export':     return exportPlugin(opts as Parameters<typeof exportPlugin>[0]);
    case 'search':     return search(opts as Parameters<typeof search>[0]);
    case 'pagination': return pagination(opts as Parameters<typeof pagination>[0]);
    case 'grouping':   return grouping(opts as Parameters<typeof grouping>[0]);
    case 'hierarchy':  return hierarchy(opts as Parameters<typeof hierarchy>[0]);
    case 'validation': return validation(opts as Parameters<typeof validation>[0]);
    case 'select':
    case 'resize':
    case 'reorder':
      return null;  // handled by core
  }
}

/**
 * Expand a list of features by their dependencies. Warns in dev when a dep
 * is auto-included so the user knows to add it explicitly.
 */
export function expandFeatureDeps(features: FeatureName[]): FeatureName[] {
  const set = new Set<FeatureName>(features);
  for (const f of features) {
    const deps = FEATURE_DEPS[f];
    if (!deps) continue;
    for (const dep of deps) {
      if (!set.has(dep)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[better-grid] feature '${f}' requires '${dep}'; auto-included. ` +
            `Add '${dep}' explicitly to silence this warning.`,
          );
        }
        set.add(dep);
      }
    }
  }
  return Array.from(set);
}

/** Always-included plugin: registers the built-in cell-type renderers. */
export function getCellRenderersPlugin(): GridPlugin {
  return cellRenderers();
}
