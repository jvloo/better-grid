import { describe, expect, it } from 'vitest';
import { timeSeries } from '../src/builders/time-series';

describe('timeSeries', () => {
  describe('column generation', () => {
    it('generates one month-column per month in the range (inclusive)', () => {
      const ts = timeSeries({ start: '2025-01-01', end: '2025-03-01' });
      expect(ts.count).toBe(3);
      expect(ts.columns.map((c) => c.id)).toEqual(['m_2025_01', 'm_2025_02', 'm_2025_03']);
    });

    it('applies columnDefaults to every column without overriding id/field/header', () => {
      const ts = timeSeries({
        start: '2025-01-01',
        end: '2025-02-01',
        columnDefaults: { width: 120, cellType: 'currency' as never },
      });
      for (const col of ts.columns) {
        expect(col.width).toBe(120);
        expect((col as { cellType?: string }).cellType).toBe('currency');
      }
    });

    it('honors custom prefix', () => {
      const ts = timeSeries({ start: '2025-01-01', end: '2025-02-01', prefix: 'ts__' });
      expect(ts.columns[0]!.id).toBe('ts__2025_01');
    });

    it('supports quarter interval', () => {
      const ts = timeSeries({
        start: '2025-01-01',
        end: '2025-12-31',
        interval: 'quarter',
      });
      expect(ts.count).toBe(4);
    });

    it('defaults column width to 80', () => {
      const ts = timeSeries({ start: '2025-01-01', end: '2025-01-01' });
      expect(ts.columns[0]!.width).toBe(80);
    });
  });

  describe('fiscal-year header layout', () => {
    it('labels FY by the ending year when fiscalYearStart is 1 (default)', () => {
      // With fyStart=1, every month satisfies m >= 1, so fy label = year + 1
      // (FY2025 = Jan–Dec 2024 under this scheme; FY2026 = Jan–Dec 2025)
      const ts = timeSeries({ start: '2024-11-01', end: '2025-02-01' });
      expect(ts.headerLayout).toHaveLength(1);
      const cells = ts.headerLayout[0]!.cells;
      expect(cells.map((c) => ({ content: c.content, colSpan: c.colSpan }))).toEqual([
        { content: 'FY2025', colSpan: 2 },
        { content: 'FY2026', colSpan: 2 },
      ]);
    });

    it('groups months by AU fiscal year (July start)', () => {
      const ts = timeSeries({
        start: '2025-06-01',
        end: '2025-08-01',
        fiscalYearStart: 7,
      });
      const cells = ts.headerLayout[0]!.cells;
      // June 2025 → FY2025, July+Aug 2025 → FY2026
      expect(cells.map((c) => ({ content: c.content, colSpan: c.colSpan }))).toEqual([
        { content: 'FY2025', colSpan: 1 },
        { content: 'FY2026', colSpan: 2 },
      ]);
    });

    it('emits no header row when fiscalYearStart is out of range', () => {
      const ts = timeSeries({
        start: '2025-01-01',
        end: '2025-02-01',
        fiscalYearStart: 0,
      });
      expect(ts.headerLayout).toHaveLength(0);
    });
  });

  describe('toIndex / toDate helpers', () => {
    it('round-trips month dates through toIndex and toDate', () => {
      const ts = timeSeries({ start: '2025-01-01', end: '2025-12-01' });
      expect(ts.toIndex('2025-03-01')).toBe(2);
      expect(ts.toDate(2)).toBe('2025-03-01');
    });

    it('returns negative index for dates before the start', () => {
      const ts = timeSeries({ start: '2025-06-01', end: '2025-12-01' });
      expect(ts.toIndex('2025-03-01')).toBe(-3);
    });

    it('formats a date via formatDate using the configured headerFormat', () => {
      const ts = timeSeries({
        start: '2025-01-01',
        end: '2025-02-01',
        headerFormat: 'YYYY-MM',
      });
      expect(ts.formatDate('2025-02-01')).toBe('2025-02');
    });
  });
});
