import type { GridPlugin, PluginContext } from '@better-grid/core';

export interface AggregationRule<TData = unknown> {
  id: string | number;
  label: string;
  labelField?: string;
  fn: 'sum' | 'avg' | 'min' | 'max' | 'count' | ((rows: TData[], field: string) => number);
  filter?: (row: TData) => boolean;
  fields?: string[];
  style?: Record<string, string>;
}

export interface AggregationOptions<TData = unknown> {
  pinnedBottom?: AggregationRule<TData>[];
  pinnedTop?: AggregationRule<TData>[];
}

type AnyRow = Record<string, unknown>;

function applyBuiltin(fn: string, values: number[]): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    default:
      return 0;
  }
}

function computeRow<TData>(
  rule: AggregationRule<TData>,
  data: TData[],
  allFields: string[],
): AnyRow {
  const filtered = rule.filter ? data.filter(rule.filter) : data;
  const fields = rule.fields ?? allFields;
  const result: AnyRow = { id: rule.id };

  if (rule.labelField) {
    result[rule.labelField] = rule.label;
  }

  for (const field of fields) {
    if (field === 'id' || field === rule.labelField) continue;

    if (typeof rule.fn === 'function') {
      result[field] = rule.fn(filtered, field);
    } else {
      const values: number[] = [];
      for (const row of filtered) {
        const v = (row as AnyRow)[field];
        if (typeof v === 'number') values.push(v);
      }
      if (values.length > 0) {
        result[field] = applyBuiltin(rule.fn, values);
      }
    }
  }

  return result;
}

function detectNumericFields(data: unknown[]): string[] {
  if (data.length === 0) return [];
  const fields = new Set<string>();
  const sample = data.slice(0, Math.min(data.length, 10));
  for (const row of sample) {
    for (const [key, val] of Object.entries(row as AnyRow)) {
      if (typeof val === 'number') fields.add(key);
    }
  }
  return Array.from(fields);
}

export function aggregation<TData = unknown>(
  options: AggregationOptions<TData>,
): GridPlugin<'aggregation'> {
  return {
    id: 'aggregation',

    init(ctx: PluginContext) {
      let numericFields: string[] | null = null;

      function getFields(data: TData[]): string[] {
        if (!numericFields) numericFields = detectNumericFields(data);
        return numericFields;
      }

      function recompute() {
        const data = ctx.grid.getData() as TData[];
        const fields = getFields(data);

        if (options.pinnedBottom?.length) {
          const rows = options.pinnedBottom.map((rule) =>
            computeRow(rule, data, fields),
          );
          ctx.grid.setPinnedBottomRows(rows);
        }

        if (options.pinnedTop?.length) {
          const rows = options.pinnedTop.map((rule) =>
            computeRow(rule, data, fields),
          );
          ctx.grid.setPinnedTopRows(rows);
        }
      }

      recompute();

      const off1 = ctx.on('data:change', recompute);
      const off2 = ctx.on('data:set', recompute);

      ctx.expose({ recompute });

      return () => {
        off1();
        off2();
      };
    },
  };
}
