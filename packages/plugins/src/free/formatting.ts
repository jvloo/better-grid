// ============================================================================
// Formatting Plugin — Number, currency, percent, date formatting via Intl
// ============================================================================

import type { GridPlugin, PluginContext, CellTypeRenderer, CellRenderContext } from '@better-grid/core';

declare module '@better-grid/core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnDef<TData = unknown> {
    dateFormat?: 'short' | 'medium' | 'long' | 'full' | 'iso' | 'month-year' | 'year' | 'time' | 'datetime';
  }
}

export type DateFormatPreset =
  | 'short'       // 1/15/26
  | 'medium'      // Jan 15, 2026
  | 'long'        // January 15, 2026
  | 'full'        // Wednesday, January 15, 2026
  | 'iso'         // 2026-01-15
  | 'month-year'  // Jan 2026
  | 'year'        // 2026
  | 'time'        // 2:30 PM
  | 'datetime'    // Jan 15, 2026, 2:30 PM

export interface FormattingOptions {
  /** Locale for formatting. Default: navigator.language or 'en-US' */
  locale?: string;
  /** Use accounting format for negative numbers (parentheses). Default: false */
  accountingFormat?: boolean;
  /** Default currency code. Default: 'USD' */
  currencyCode?: string;
  /** Default decimal places for numbers. Default: 2 */
  decimalPlaces?: number;
  /** Default date format preset. Default: 'medium' */
  dateFormat?: DateFormatPreset;
  /** Color for negative numbers (e.g. '#dc2626'). Per-column override via column.meta.negativeColor */
  negativeColor?: string;
}

export interface FormattingApi {
  formatValue(value: unknown, type: string, column?: FormattingColumn, row?: unknown): string;
  parseValue(displayValue: string, type: string): unknown;
}

type FormattingColumn = {
  hideZero?: boolean;
  dateFormat?: string;
  precision?: number | ((row: unknown) => number | undefined);
  valueFormatter?: (value: unknown) => string;
};

export function formatting(options?: FormattingOptions): GridPlugin<'formatting', FormattingApi> {
  const locale = options?.locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  const decimalPlaces = options?.decimalPlaces ?? 2;
  const currencyCode = options?.currencyCode ?? 'USD';

  return {
    id: 'formatting',

    init(ctx: PluginContext) {
      // Number formatter
      const numberFmt = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimalPlaces,
      });

      // Currency formatter
      const currencyFmt = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

      // Percent formatter
      const percentFmt = new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: decimalPlaces,
      });

      // Date formatters — cached by preset name
      const defaultDateFormat = options?.dateFormat ?? 'medium';
      const dateFmtCache = new Map<string, Intl.DateTimeFormat>();

      function getDateFormatter(preset: DateFormatPreset): Intl.DateTimeFormat {
        if (dateFmtCache.has(preset)) return dateFmtCache.get(preset)!;

        let opts: Intl.DateTimeFormatOptions;
        switch (preset) {
          case 'short':
            opts = { year: '2-digit', month: 'numeric', day: 'numeric' };
            break;
          case 'medium':
            opts = { year: 'numeric', month: 'short', day: 'numeric' };
            break;
          case 'long':
            opts = { year: 'numeric', month: 'long', day: 'numeric' };
            break;
          case 'full':
            opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            break;
          case 'month-year':
            opts = { year: 'numeric', month: 'short' };
            break;
          case 'year':
            opts = { year: 'numeric' };
            break;
          case 'time':
            opts = { hour: 'numeric', minute: '2-digit' };
            break;
          case 'datetime':
            opts = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
            break;
          case 'iso':
          default:
            opts = { year: 'numeric', month: 'short', day: 'numeric' };
            break;
        }

        const fmt = new Intl.DateTimeFormat(locale, opts);
        dateFmtCache.set(preset, fmt);
        return fmt;
      }

      function formatValue(
        value: unknown,
        type: string,
        column?: FormattingColumn,
        row?: unknown,
      ): string {
        if (value == null) return '';

        // Custom valueFormatter takes priority over built-in formatting
        if (column?.valueFormatter) {
          return column.valueFormatter(value);
        }

        if (column?.hideZero && value === 0) return '';

        // Column-level `precision` overrides the plugin-level decimalPlaces for
        // numeric types, so a currency column with precision: 0 renders as
        // "$2,700,000" instead of "$2,700,000.00".
        const colPrecision = typeof column?.precision === 'function'
          ? column.precision(row)
          : column?.precision;

        switch (type) {
          case 'number': {
            if (typeof value !== 'number') return String(value);
            if (colPrecision != null) {
              return value.toLocaleString(locale, {
                minimumFractionDigits: colPrecision,
                maximumFractionDigits: colPrecision,
              });
            }
            return numberFmt.format(value);
          }
          case 'currency': {
            if (typeof value !== 'number') return String(value);
            const fmt = colPrecision != null
              ? new Intl.NumberFormat(locale, {
                  style: 'currency',
                  currency: currencyCode,
                  minimumFractionDigits: colPrecision,
                  maximumFractionDigits: colPrecision,
                })
              : currencyFmt;
            if (options?.accountingFormat && value < 0) {
              return `(${fmt.format(Math.abs(value))})`;
            }
            return fmt.format(value);
          }
          case 'percent':
            return typeof value === 'number' ? percentFmt.format(value) : String(value);
          case 'bigint': {
            // BigInt values: convert to number for Intl formatting (integer grouping)
            // or to string if the value exceeds safe integer range
            if (typeof value === 'bigint') {
              // Intl.NumberFormat doesn't support BigInt directly, format via string
              const str = value.toString();
              // Use numberFmt for grouping separators on the integer
              const asNum = Number(value);
              if (Number.isSafeInteger(asNum)) {
                return numberFmt.format(asNum);
              }
              // For very large integers, manually add grouping
              const negative = str.startsWith('-');
              const digits = negative ? str.slice(1) : str;
              const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              return negative ? `-${grouped}` : grouped;
            }
            return String(value);
          }
          case 'date': {
            const datePreset = (column?.dateFormat as DateFormatPreset) ?? defaultDateFormat;
            if (datePreset === 'iso') {
              // ISO format: YYYY-MM-DD (no Intl needed)
              const d = value instanceof Date ? value : new Date(value as string);
              if (isNaN(d.getTime())) return String(value);
              return d.toISOString().split('T')[0]!;
            }
            const fmt = getDateFormatter(datePreset);
            if (value instanceof Date) return fmt.format(value);
            if (typeof value === 'string' || typeof value === 'number') {
              const d = new Date(value);
              return isNaN(d.getTime()) ? String(value) : fmt.format(d);
            }
            return String(value);
          }
          default:
            return String(value);
        }
      }

      function parseValue(displayValue: string, type: string): unknown {
        switch (type) {
          case 'number':
          case 'currency':
            return Number(displayValue.replace(/[^0-9.-]/g, ''));
          case 'percent':
            return Number(displayValue.replace(/[^0-9.-]/g, '')) / 100;
          case 'bigint': {
            const cleaned = displayValue.replace(/[^0-9\-]/g, '');
            if (cleaned === '' || cleaned === '-') return displayValue;
            try { return BigInt(cleaned); } catch { return displayValue; }
          }
          case 'date':
            return new Date(displayValue);
          default:
            return displayValue;
        }
      }

      // Register cell type renderers
      const cellTypes = ['number', 'currency', 'percent', 'date', 'bigint'] as const;
      const unregisters: (() => void)[] = [];

      for (const type of cellTypes) {
        const renderer: CellTypeRenderer = {
          render(container: HTMLElement, context: CellRenderContext) {
            container.textContent = formatValue(context.value, type, context.column, context.row);
            if (type === 'number' || type === 'currency' || type === 'percent' || type === 'bigint') {
              container.style.textAlign = 'right';
              const negColor = (context.column.meta?.negativeColor as string) ?? options?.negativeColor;
              if (negColor && typeof context.value === 'number' && context.value < 0) {
                container.style.color = negColor;
              }
            }
          },
          getStringValue(context: CellRenderContext) {
            return formatValue(context.value, type, context.column, context.row);
          },
          parseStringValue(value: string) {
            return parseValue(value, type);
          },
        };
        unregisters.push(ctx.registerCellType(type, renderer));
      }

      const api: FormattingApi = { formatValue, parseValue };
      ctx.expose(api);

      return () => {
        for (const unreg of unregisters) {
          unreg();
        }
      };
    },
  };
}
