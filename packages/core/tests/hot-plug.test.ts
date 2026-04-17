import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef, GridPlugin, PluginContext } from '../src/types';

interface Row {
  id: number;
  name: string;
  value: number;
}

const columns: ColumnDef<Row>[] = [
  { id: 'id', accessorKey: 'id', header: 'ID' } as ColumnDef<Row>,
  { id: 'name', accessorKey: 'name', header: 'Name' } as ColumnDef<Row>,
  { id: 'value', accessorKey: 'value', header: 'Value' } as ColumnDef<Row>,
];

const seedData = (): Row[] => [
  { id: 1, name: 'charlie', value: 30 },
  { id: 2, name: 'alpha', value: 10 },
  { id: 3, name: 'bravo', value: 20 },
];

interface MiniSortApi {
  sortBy(columnId: string, direction: 'asc' | 'desc'): void;
  getState(): { columnId: string; direction: 'asc' | 'desc' } | null;
}

// Minimal sorting plugin — enough to prove addPlugin wires init() + expose() + cleanup.
function miniSorting(): GridPlugin<'sorting'> {
  return {
    id: 'sorting',
    init(ctx: PluginContext) {
      let state: { columnId: string; direction: 'asc' | 'desc' } | null = null;
      let originalOrder: Row[] | null = null;

      function sortBy(columnId: string, direction: 'asc' | 'desc'): void {
        const current = ctx.grid.getData() as Row[];
        if (!originalOrder) originalOrder = [...current];
        const col = ctx.grid.getState().columns.find((c) => c.id === columnId);
        if (!col?.accessorKey) return;
        const key = col.accessorKey as keyof Row;
        const sorted = [...current].sort((a, b) => {
          const av = a[key] as unknown;
          const bv = b[key] as unknown;
          if (typeof av === 'number' && typeof bv === 'number') {
            return direction === 'asc' ? av - bv : bv - av;
          }
          const sa = String(av);
          const sb = String(bv);
          return direction === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
        ctx.grid.setData(sorted as Row[]);
        state = { columnId, direction };
      }

      const api: MiniSortApi = {
        sortBy,
        getState: () => (state ? { ...state } : null),
      };
      ctx.expose(api as unknown as Record<string, unknown>);

      // Re-apply on setData so we can verify cleanup removes this listener.
      // Tracked via a guard so re-sorting doesn't recurse through its own emit.
      let resorting = false;
      const off = ctx.on('data:set', () => {
        if (!state || resorting) return;
        resorting = true;
        try {
          sortBy(state.columnId, state.direction);
        } finally {
          resorting = false;
        }
      });

      return () => {
        off();
        state = null;
        originalOrder = null;
      };
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('hot-pluggable plugins', () => {
  it('addPlugin registers the plugin after creation and exposes its API', () => {
    const grid = createGrid<Row>({ columns, data: seedData() });
    const pluginsAsAny = grid.plugins as Record<string, MiniSortApi | undefined>;
    expect(pluginsAsAny.sorting).toBeUndefined();

    grid.addPlugin(miniSorting());

    const api = pluginsAsAny.sorting;
    expect(api).toBeDefined();

    api!.sortBy('value', 'asc');
    expect(grid.getData().map((r) => r.value)).toEqual([10, 20, 30]);
    expect(api!.getState()).toEqual({ columnId: 'value', direction: 'asc' });

    grid.destroy();
  });

  it('removePlugin runs cleanup so event listeners no longer fire (no zombie sort)', () => {
    const grid = createGrid<Row>({ columns, data: seedData() });
    const pluginsAsAny = grid.plugins as Record<string, MiniSortApi | undefined>;
    grid.addPlugin(miniSorting());
    const api = pluginsAsAny.sorting!;

    api.sortBy('value', 'asc');
    expect(grid.getData().map((r) => r.value)).toEqual([10, 20, 30]);

    grid.removePlugin('sorting');
    expect(pluginsAsAny.sorting).toBeUndefined();

    // If the dataChange listener is still alive, this setData would re-sort into [10,20,30].
    const fresh: Row[] = [
      { id: 4, name: 'zeta', value: 99 },
      { id: 5, name: 'yota', value: 50 },
      { id: 6, name: 'xena', value: 75 },
    ];
    grid.setData(fresh);
    expect(grid.getData().map((r) => r.value)).toEqual([99, 50, 75]);

    grid.destroy();
  });

  it('throws when adding a plugin with a duplicate id', () => {
    const grid = createGrid<Row>({ columns, data: seedData() });
    grid.addPlugin(miniSorting());
    expect(() => grid.addPlugin(miniSorting())).toThrow(/already registered/i);
    grid.destroy();
  });

  it('throws when removing a plugin that another plugin depends on', () => {
    const grid = createGrid<Row>({ columns, data: seedData() });
    grid.addPlugin(miniSorting());

    const dependent: GridPlugin<'multi-sort'> = {
      id: 'multi-sort',
      dependencies: ['sorting'],
      init: () => undefined,
    };
    grid.addPlugin(dependent);

    expect(() => grid.removePlugin('sorting')).toThrow(/depends on it/i);

    // Cleanup order must be children first.
    grid.removePlugin('multi-sort');
    grid.removePlugin('sorting');
    grid.destroy();
  });

  it('throws when removing a plugin that is not registered', () => {
    const grid = createGrid<Row>({ columns, data: seedData() });
    expect(() => grid.removePlugin('does-not-exist')).toThrow(/not registered/i);
    grid.destroy();
  });

  it('throws when adding a plugin whose dependency is missing', () => {
    const grid = createGrid<Row>({ columns, data: seedData() });
    const needsSorting: GridPlugin<'multi-sort'> = {
      id: 'multi-sort',
      dependencies: ['sorting'],
      init: () => undefined,
    };
    expect(() => grid.addPlugin(needsSorting)).toThrow(
      /requires plugin 'sorting'/,
    );
    grid.destroy();
  });
});
