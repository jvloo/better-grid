// ============================================================================
// timeSeries — Column Builder Utility
//
// Pure function that generates column definitions + FY header rows + date↔index
// helpers. Runs at setup time, has no runtime init, and is composed into grid
// config by spreading `.columns` and `.headerRows`.
//
// Usage:
//   const ts = timeSeries({ start: '2025-07-01', end: '2026-06-30', fiscalYearStart: 7 });
//   const grid = createGrid({ columns: [...fixed, ...ts.columns], headerLayout: ts.headerLayout });
// ============================================================================

import type { ColumnDef, HeaderRow } from '../types';

export interface TimeSeriesOptions {
  start: string;
  end: string;
  interval?: 'month' | 'quarter' | 'week' | 'day';
  prefix?: string;
  locale?: string;
  headerFormat?: 'Mon YY' | 'Mon YYYY' | 'YYYY-MM' | ((date: Date) => string);
  fiscalYearStart?: number;
  columnWidth?: number;
  columnDefaults?: Partial<ColumnDef>;
}

export interface TimeSeriesResult {
  columns: ColumnDef[];
  headerLayout: HeaderRow[];
  toIndex(date: string | Date): number;
  toDate(index: number): string;
  formatDate(date: string | Date): string;
  count: number;
}

function parseDate(input: string | Date): Date {
  if (input instanceof Date) return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  const [y, m, d] = input.split('-').map(Number);
  return new Date(y!, m! - 1, d ?? 1);
}

function isoString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function addInterval(d: Date, interval: string, count: number): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (interval) {
    case 'month':
      result.setMonth(result.getMonth() + count);
      break;
    case 'quarter':
      result.setMonth(result.getMonth() + count * 3);
      break;
    case 'week':
      result.setDate(result.getDate() + count * 7);
      break;
    case 'day':
      result.setDate(result.getDate() + count);
      break;
  }
  return result;
}

function diffIntervals(a: Date, b: Date, interval: string): number {
  switch (interval) {
    case 'month':
      return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
    case 'quarter':
      return Math.floor(((a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth())) / 3);
    case 'week': {
      const ms = a.getTime() - b.getTime();
      return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
    }
    case 'day': {
      const ms = a.getTime() - b.getTime();
      return Math.floor(ms / (24 * 60 * 60 * 1000));
    }
    default:
      return 0;
  }
}

function buildFormatter(
  format: TimeSeriesOptions['headerFormat'],
  locale: string,
): (d: Date) => string {
  if (typeof format === 'function') return format;
  switch (format) {
    case 'Mon YYYY':
      return (d) => d.toLocaleString(locale, { month: 'short' }) + ' ' + d.getFullYear();
    case 'YYYY-MM':
      return (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'Mon YY':
    default:
      return (d) => d.toLocaleString(locale, { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
  }
}

function fiscalYear(d: Date, fyStart: number): string {
  const m = d.getMonth() + 1;
  const fy = m >= fyStart ? d.getFullYear() + 1 : d.getFullYear();
  return `FY${fy}`;
}

function buildColumnKey(d: Date, prefix: string, interval: string): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  if (interval === 'day') {
    const day = String(d.getDate()).padStart(2, '0');
    return `${prefix}${y}_${m}_${day}`;
  }
  if (interval === 'week') {
    const day = String(d.getDate()).padStart(2, '0');
    return `${prefix}${y}_${m}_${day}`;
  }
  return `${prefix}${y}_${m}`;
}

export function timeSeries(options: TimeSeriesOptions): TimeSeriesResult {
  const {
    start,
    end,
    interval = 'month',
    prefix = 'm_',
    locale = 'en-US',
    headerFormat = 'Mon YY',
    fiscalYearStart = 1,
    columnWidth = 80,
    columnDefaults = {},
  } = options;

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const fmt = buildFormatter(headerFormat, locale);

  const dates: Date[] = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  while (cursor <= endDate) {
    dates.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor = addInterval(cursor, interval, 1);
  }

  const columns: ColumnDef[] = dates.map((d) => {
    const key = buildColumnKey(d, prefix, interval);
    return {
      id: key,
      field: key,
      headerName: fmt(d),
      width: columnWidth,
      ...columnDefaults,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  const headerLayout: HeaderRow[] = [];
  if (fiscalYearStart >= 1 && fiscalYearStart <= 12) {
    const groups: { fy: string; count: number }[] = [];
    for (const d of dates) {
      const fy = fiscalYear(d, fiscalYearStart);
      if (groups.length > 0 && groups[groups.length - 1]!.fy === fy) {
        groups[groups.length - 1]!.count++;
      } else {
        groups.push({ fy, count: 1 });
      }
    }
    headerLayout.push({
      id: 'ts-fy-group',
      height: 32,
      cells: groups.map((g) => ({
        id: `ts-${g.fy.toLowerCase()}`,
        content: g.fy,
        colSpan: g.count,
      })),
    });
  }

  function toIndex(date: string | Date): number {
    const d = typeof date === 'string' ? parseDate(date) : date;
    return diffIntervals(d, startDate, interval);
  }

  function toDate(index: number): string {
    const d = addInterval(startDate, interval, index);
    return isoString(d);
  }

  function formatDateFn(date: string | Date): string {
    const d = typeof date === 'string' ? parseDate(date) : date;
    return fmt(d);
  }

  return {
    columns,
    headerLayout,
    toIndex,
    toDate,
    formatDate: formatDateFn,
    count: dates.length,
  };
}
