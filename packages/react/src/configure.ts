import type { FeatureName } from './presets/features';
import type { ColumnDefaults } from '@better-grid/core';

export interface GlobalGridConfig {
  features?: Partial<Record<FeatureName, unknown>>;
  columnDefaults?: ColumnDefaults;
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
    columnDefaults: { ...globalConfig.columnDefaults, ...config.columnDefaults },
  };
}

export function getGlobalFeatureOptions(name: FeatureName): unknown {
  return globalConfig.features?.[name];
}

export function getGlobalColumnDefaults(): ColumnDefaults | undefined {
  return globalConfig.columnDefaults;
}

// Test helper — not exported from package index
export function _resetGlobalConfig(): void {
  globalConfig = {};
}
