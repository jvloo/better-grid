import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef, GridPlugin, PluginContext } from '../src/types';

// ---------------------------------------------------------------------------
// Fixture plugins — each declares its exposed API via the `$api` phantom.
// ---------------------------------------------------------------------------

interface Row {
  id: number;
  name: string;
}

interface SortingApi {
  getDirection(): 'asc' | 'desc';
  toggle(): void;
}

interface FilteringApi {
  getQuery(): string;
  setQuery(q: string): void;
}

function sorting(): GridPlugin<'sorting', SortingApi> {
  return {
    id: 'sorting',
    init(ctx: PluginContext) {
      let direction: 'asc' | 'desc' = 'asc';
      const api: SortingApi = {
        getDirection: () => direction,
        toggle: () => { direction = direction === 'asc' ? 'desc' : 'asc'; },
      };
      ctx.expose(api as unknown as Record<string, unknown>);
    },
  };
}

function filtering(): GridPlugin<'filtering', FilteringApi> {
  return {
    id: 'filtering',
    init(ctx: PluginContext) {
      let query = '';
      const api: FilteringApi = {
        getQuery: () => query,
        setQuery: (q) => { query = q; },
      };
      ctx.expose(api as unknown as Record<string, unknown>);
    },
  };
}

const columns: ColumnDef<Row>[] = [
  { id: 'id', accessorKey: 'id', header: 'ID' } as ColumnDef<Row>,
  { id: 'name', accessorKey: 'name', header: 'Name' } as ColumnDef<Row>,
];

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { document.body.innerHTML = ''; });

describe('typed plugin accessor', () => {
  it('grid.plugins.<id> returns the exposed API at runtime', () => {
    const grid = createGrid({
      columns,
      data: [{ id: 1, name: 'a' }] as Row[],
      plugins: [sorting(), filtering()],
    });

    expect(grid.plugins.sorting).toBeDefined();
    expect(grid.plugins.sorting.getDirection()).toBe('asc');
    grid.plugins.sorting.toggle();
    expect(grid.plugins.sorting.getDirection()).toBe('desc');

    grid.plugins.filtering.setQuery('hello');
    expect(grid.plugins.filtering.getQuery()).toBe('hello');

    grid.destroy();
  });

  it('unknown plugin id returns undefined (not a typed key)', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [sorting()],
    });

    // Reading a key the proxy doesn't have returns undefined at runtime.
    expect((grid.plugins as Record<string, unknown>).unknown).toBeUndefined();

    grid.destroy();
  });

  it('Object.keys reflects only plugins that have exposed an API', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [sorting(), filtering()],
    });

    const keys = Object.keys(grid.plugins).sort();
    expect(keys).toEqual(['filtering', 'sorting']);

    grid.destroy();
  });

  it('hot-added plugins are visible via grid.plugins at runtime (typed as the declared tuple only)', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [sorting()],
    });

    expect(grid.plugins.sorting).toBeDefined();
    // hot-add is outside the declared tuple, so TS doesn't type it — but the proxy still works.
    grid.addPlugin(filtering());
    expect((grid.plugins as Record<string, FilteringApi>).filtering.getQuery()).toBe('');

    grid.destroy();
  });

  // -------------------------------------------------------------------------
  // Compile-time assertions (vitest's expectTypeOf runs at type-check time).
  // -------------------------------------------------------------------------

  it('infers the plugin API type from the plugins tuple', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [sorting(), filtering()],
    });

    expectTypeOf(grid.plugins.sorting).toEqualTypeOf<SortingApi>();
    expectTypeOf(grid.plugins.filtering).toEqualTypeOf<FilteringApi>();
    // Methods on the inferred API are typed.
    expectTypeOf(grid.plugins.sorting.getDirection).returns.toEqualTypeOf<'asc' | 'desc'>();

    grid.destroy();
  });

  it('degrades gracefully to Record<string, unknown> when plugins are not passed', () => {
    const grid = createGrid({ columns, data: [] as Row[] });
    expectTypeOf(grid.plugins).toEqualTypeOf<Record<string, unknown>>();
    grid.destroy();
  });
});

// ---------------------------------------------------------------------------
// $errorCodes inference
// ---------------------------------------------------------------------------

const VALIDATION_CODES = { REQUIRED_FIELD: 'REQUIRED_FIELD', OUT_OF_RANGE: 'OUT_OF_RANGE' } as const;
const CLIPBOARD_CODES = { READ_ONLY_COLUMN: 'READ_ONLY_COLUMN' } as const;

function validationMock(): GridPlugin<'validation'> {
  return { id: 'validation', $errorCodes: VALIDATION_CODES };
}
function clipboardMock(): GridPlugin<'clipboard'> {
  return { id: 'clipboard', $errorCodes: CLIPBOARD_CODES };
}
function noCodesMock(): GridPlugin<'sorting'> {
  return { id: 'sorting' };
}

describe('typed $errorCodes accessor', () => {
  it('merges declared $errorCodes across plugins at runtime', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [validationMock(), clipboardMock()],
    });

    expect(grid.$errorCodes.REQUIRED_FIELD).toBe('REQUIRED_FIELD');
    expect(grid.$errorCodes.READ_ONLY_COLUMN).toBe('READ_ONLY_COLUMN');
    expect(grid.$errorCodes.OUT_OF_RANGE).toBe('OUT_OF_RANGE');

    grid.destroy();
  });

  it('Object.keys($errorCodes) returns the union of all declared codes', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [validationMock(), clipboardMock()],
    });

    expect(Object.keys(grid.$errorCodes).sort()).toEqual(
      ['OUT_OF_RANGE', 'READ_ONLY_COLUMN', 'REQUIRED_FIELD'],
    );

    grid.destroy();
  });

  it('hot-added plugin contributes its $errorCodes immediately', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [validationMock()],
    });

    expect(grid.$errorCodes.READ_ONLY_COLUMN).toBeUndefined();
    grid.addPlugin(clipboardMock());
    expect(grid.$errorCodes.READ_ONLY_COLUMN).toBe('READ_ONLY_COLUMN');

    grid.destroy();
  });

  it('removePlugin drops that plugin’s codes', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [validationMock(), clipboardMock()],
    });

    expect(grid.$errorCodes.READ_ONLY_COLUMN).toBe('READ_ONLY_COLUMN');
    grid.removePlugin('clipboard');
    expect(grid.$errorCodes.READ_ONLY_COLUMN).toBeUndefined();
    expect(grid.$errorCodes.REQUIRED_FIELD).toBe('REQUIRED_FIELD');

    grid.destroy();
  });

  it('infers the merged shape at the type level', () => {
    const grid = createGrid({
      columns,
      data: [] as Row[],
      plugins: [validationMock(), clipboardMock(), noCodesMock()],
    });

    expectTypeOf(grid.$errorCodes.REQUIRED_FIELD).toEqualTypeOf<'REQUIRED_FIELD'>();
    expectTypeOf(grid.$errorCodes.OUT_OF_RANGE).toEqualTypeOf<'OUT_OF_RANGE'>();
    expectTypeOf(grid.$errorCodes.READ_ONLY_COLUMN).toEqualTypeOf<'READ_ONLY_COLUMN'>();

    grid.destroy();
  });
});
