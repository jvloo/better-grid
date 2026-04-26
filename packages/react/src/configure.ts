import type { FeatureName } from './presets/features';

export interface GlobalGridConfig {
  features?: Partial<Record<FeatureName, unknown>>;
}

let globalConfig: GlobalGridConfig = {};

/**
 * Configure app-wide defaults for Better Grid features. Last write wins per
 * feature key. Per-grid options override these globals.
 */
export function configure(config: GlobalGridConfig): void {
  globalConfig = {
    ...globalConfig,
    ...config,
    features: { ...globalConfig.features, ...config.features },
  };
}

export function getGlobalFeatureOptions(name: FeatureName): unknown {
  return globalConfig.features?.[name];
}

// Test helper — not exported from package index
export function _resetGlobalConfig(): void {
  globalConfig = {};
}
