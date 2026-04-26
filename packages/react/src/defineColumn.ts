import type { ColumnDef, CellType } from '@better-grid/core';

type ColumnOpts<TData = unknown> = Partial<Omit<ColumnDef<TData>, 'id'>> & Record<string, unknown>;

const BUILT_IN_TYPES = [
  'text', 'number', 'currency', 'percent', 'date', 'badge', 'boolean',
  'progress', 'rating', 'change', 'changeIndicator', 'link', 'timeline',
  'tooltip', 'loading', 'custom',
] as const;

type BuiltInType = typeof BUILT_IN_TYPES[number];

const customRegistry = new Map<string, ColumnOpts>();

/**
 * Register a custom column type at app boot. Throws on built-in name
 * collision or duplicate registration. Defaults merge into user opts at
 * column-creation time.
 */
export function registerColumn(name: string, defaults: ColumnOpts): void {
  if ((BUILT_IN_TYPES as readonly string[]).includes(name)) {
    throw new Error(`[better-grid] '${name}' is a built-in column type and cannot be re-registered`);
  }
  if (customRegistry.has(name)) {
    throw new Error(`[better-grid] column type '${name}' is already registered`);
  }
  customRegistry.set(name, defaults);
}

// Test helper — not exported from package index
export function _resetColumnRegistry(): void {
  customRegistry.clear();
}

const DEFAULTS_BY_TYPE: Record<BuiltInType, Partial<ColumnDef> & Record<string, unknown>> = {
  text:            {},
  number:          { align: 'right' },
  currency:        { align: 'right', cellType: 'currency' as CellType },
  percent:         { align: 'right', cellType: 'percent' as CellType },
  date:            { cellType: 'date' as CellType },
  badge:           { cellType: 'badge' as CellType },
  boolean:         { cellType: 'boolean' as CellType, align: 'center' },
  progress:        { cellType: 'progress' as CellType },
  rating:          { cellType: 'rating' as CellType },
  change:          { cellType: 'change' as CellType, align: 'right' },
  changeIndicator: { cellType: 'changeIndicator' as CellType, align: 'right' },
  link:            { cellType: 'link' as CellType },
  timeline:        { cellType: 'timeline' as CellType },
  tooltip:         { cellType: 'tooltip' as CellType },
  loading:         { cellType: 'loading' as CellType },
  custom:          {},  // user MUST supply cellRenderer
};

/**
 * Make a builder function for a given type. Field becomes id+field
 * (override accessor via opts.valueGetter for non-trivial paths).
 */
function makeBuilder<TData = unknown>(type: BuiltInType | string) {
  return (field: string, opts: ColumnOpts<TData> = {}): ColumnDef<TData> => {
    const defaults = (DEFAULTS_BY_TYPE as Record<string, ColumnOpts>)[type] ?? customRegistry.get(type) ?? {};
    return {
      id: field,
      field: opts.valueGetter ? undefined : (field as keyof TData & string),
      header: opts.header ?? field,
      ...defaults,
      ...opts,
    } as ColumnDef<TData>;
  };
}

type BuiltInBuilders<TData = unknown> = {
  [K in BuiltInType]: (field: string, opts?: ColumnOpts<TData>) => ColumnDef<TData>;
};

interface CustomBuilders {
  [name: string]: (field: string, opts?: ColumnOpts) => ColumnDef;
}

/**
 * Column builders. col.<type>(field, opts) returns a ColumnDef.
 * Custom types added via registerColumn() are accessible as col.<name>.
 */
export const defineColumn: BuiltInBuilders & CustomBuilders = new Proxy({} as BuiltInBuilders & CustomBuilders, {
  get(_target, prop: string) {
    if ((BUILT_IN_TYPES as readonly string[]).includes(prop) || customRegistry.has(prop)) {
      return makeBuilder(prop);
    }
    throw new Error(
      `[better-grid] col.${prop} is not a registered column type. ` +
      `Built-in: ${BUILT_IN_TYPES.join('|')}. Register custom types via registerColumn().`,
    );
  },
});
