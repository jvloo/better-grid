// ============================================================================
// Plugin Registry — Lifecycle management and dependency resolution
// ============================================================================

import type { GridPlugin, PluginContext } from '../types';

export class PluginRegistry {
  private plugins = new Map<string, GridPlugin>();
  private cleanupFns = new Map<string, () => void>();
  private exposedApis = new Map<string, Record<string, unknown>>();

  /** Register plugins in dependency order */
  register(plugins: GridPlugin[]): void {
    const sorted = this.topologicalSort(plugins);
    for (const plugin of sorted) {
      this.plugins.set(plugin.id, plugin);
    }
  }

  /** Initialize all plugins with their context */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initAll(createContext: (plugin: GridPlugin) => PluginContext<any>): void {
    for (const [id, plugin] of this.plugins) {
      if (plugin.init) {
        const ctx = createContext(plugin);
        const cleanup = plugin.init(ctx);
        if (typeof cleanup === 'function') {
          this.cleanupFns.set(id, cleanup);
        }
      }
    }
  }

  /** Destroy all plugins (reverse order) */
  destroyAll(): void {
    const ids = [...this.cleanupFns.keys()].reverse();
    for (const id of ids) {
      this.cleanupFns.get(id)?.();
    }
    this.cleanupFns.clear();
    this.exposedApis.clear();
    this.plugins.clear();
  }

  getPlugin<T>(id: string): T | undefined {
    return this.exposedApis.get(id) as T | undefined;
  }

  exposeApi(pluginId: string, api: Record<string, unknown>): void {
    this.exposedApis.set(pluginId, api);
  }

  getPluginInstance(id: string): GridPlugin | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): GridPlugin[] {
    return [...this.plugins.values()];
  }

  /** Add a single plugin at runtime and initialize it immediately. */
  addPlugin(
    plugin: GridPlugin,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createContext: (plugin: GridPlugin) => PluginContext<any>,
  ): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin '${plugin.id}' is already registered`);
    }

    // Dependencies must already be installed — runtime adds don't re-sort the graph.
    for (const dep of plugin.dependencies ?? []) {
      if (!this.plugins.has(dep)) {
        throw new Error(`Plugin '${plugin.id}' requires plugin '${dep}' to be installed`);
      }
    }

    this.plugins.set(plugin.id, plugin);

    if (plugin.init) {
      const ctx = createContext(plugin);
      const cleanup = plugin.init(ctx);
      if (typeof cleanup === 'function') {
        this.cleanupFns.set(plugin.id, cleanup);
      }
    }
  }

  /** Remove a plugin at runtime. Runs its cleanup fn and unregisters its API. */
  removePlugin(pluginId: string): void {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin '${pluginId}' is not registered`);
    }

    // Another plugin still depends on this one — removal would break its invariants.
    for (const [otherId, other] of this.plugins) {
      if (otherId === pluginId) continue;
      if (other.dependencies?.includes(pluginId)) {
        throw new Error(
          `Cannot remove plugin '${pluginId}': plugin '${otherId}' depends on it`,
        );
      }
    }

    const cleanup = this.cleanupFns.get(pluginId);
    if (cleanup) {
      cleanup();
      this.cleanupFns.delete(pluginId);
    }

    this.exposedApis.delete(pluginId);
    this.plugins.delete(pluginId);
  }

  /** Topological sort — ensures plugins init after their dependencies */
  private topologicalSort(plugins: GridPlugin[]): GridPlugin[] {
    const pluginMap = new Map(plugins.map((p) => [p.id, p]));
    const visited = new Set<string>();
    const result: GridPlugin[] = [];

    const visit = (id: string, stack: Set<string>) => {
      if (visited.has(id)) return;
      if (stack.has(id)) {
        throw new Error(`Circular plugin dependency detected: ${[...stack, id].join(' → ')}`);
      }

      const plugin = pluginMap.get(id);
      if (!plugin) return;

      stack.add(id);
      for (const dep of plugin.dependencies ?? []) {
        if (!pluginMap.has(dep)) {
          throw new Error(`Plugin '${id}' requires plugin '${dep}' to be installed`);
        }
        visit(dep, stack);
      }
      stack.delete(id);

      visited.add(id);
      result.push(plugin);
    };

    for (const plugin of plugins) {
      visit(plugin.id, new Set());
    }

    return result;
  }
}
