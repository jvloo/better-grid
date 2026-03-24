// ============================================================================
// Formatting Plugin — Number, currency, percent, date formatting via Intl
// ============================================================================

import type { GridPlugin, PluginContext, CellTypeRenderer, CellRenderContext } from '@better-grid/core';

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
}

export interface FormattingApi {
  formatValue(value: unknown, type: string, meta?: Record<string, unknown>): string;
  parseValue(displayValue: string, type: string): unknown;
}

export function formatting(options?: FormattingOptions): GridPlugin<'formatting'> {
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

      function formatValue(value: unknown, type: string, meta?: Record<string, unknown>): string {
        if (value == null) return '';

        const hideZero = meta?.hideZero as boolean | undefined;
        if (hideZero && value === 0) return '';

        switch (type) {
          case 'number':
            return typeof value === 'number' ? numberFmt.format(value) : String(value);
          case 'currency':
            if (typeof value !== 'number') return String(value);
            if (options?.accountingFormat && value < 0) {
              return `(${currencyFmt.format(Math.abs(value))})`;
            }
            return currencyFmt.format(value);
          case 'percent':
            return typeof value === 'number' ? percentFmt.format(value) : String(value);
          case 'date': {
            const datePreset = (meta?.dateFormat as DateFormatPreset) ?? defaultDateFormat;
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
          case 'date':
            return new Date(displayValue);
          default:
            return displayValue;
        }
      }

      // Register cell type renderers
      const cellTypes = ['number', 'currency', 'percent', 'date'] as const;
      const unregisters: (() => void)[] = [];

      for (const type of cellTypes) {
        const renderer: CellTypeRenderer = {
          render(container: HTMLElement, context: CellRenderContext) {
            container.textContent = formatValue(context.value, type, context.column.meta);
            if (type === 'number' || type === 'currency') {
              container.style.textAlign = 'right';
            }
          },
          getStringValue(context: CellRenderContext) {
            return formatValue(context.value, type, context.column.meta);
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
