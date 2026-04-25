import type { FeatureName } from './features';

export interface ModeDefinition {
  features: FeatureName[];
  defaults: {
    rowHeight?: number;
    selection?: { mode?: 'cell' | 'row' | 'range' | 'none'; multiRange?: boolean };
  };
}

export const BUILT_IN_MODES: Record<string, ModeDefinition> = {
  view: {
    features: ['sort', 'filter', 'resize', 'select'],
    defaults: {},
  },
  interactive: {
    features: ['sort', 'filter', 'resize', 'select', 'reorder'],
    defaults: {},
  },
  spreadsheet: {
    features: ['sort', 'filter', 'resize', 'select', 'reorder', 'edit', 'clipboard', 'undo'],
    defaults: { selection: { mode: 'range' } },
  },
  dashboard: {
    features: ['sort', 'filter', 'resize', 'select', 'export'],
    defaults: {},
  },
};

const customModes = new Map<string, ModeDefinition>();

/**
 * Register a user-defined mode at app boot. Throws on duplicate or built-in name collision.
 */
export function registerMode(name: string, def: ModeDefinition): void {
  if (name in BUILT_IN_MODES) {
    throw new Error(`[better-grid] mode '${name}' is built-in and cannot be re-registered`);
  }
  if (customModes.has(name)) {
    throw new Error(`[better-grid] mode '${name}' is already registered`);
  }
  customModes.set(name, def);
}

/**
 * Resolve a mode name to its features + defaults. `null` = no defaults.
 */
export function resolveMode(name: string | null): ModeDefinition {
  if (name === null) return { features: [], defaults: {} };
  const def = BUILT_IN_MODES[name] ?? customModes.get(name);
  if (!def) throw new Error(`[better-grid] unknown mode '${name}'. Built-in: view|interactive|spreadsheet|dashboard. Or register via registerMode().`);
  return def;
}

// Test helper — not exported from package index
export function _resetCustomModes(): void {
  customModes.clear();
}
