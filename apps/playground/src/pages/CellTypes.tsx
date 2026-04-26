import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { BadgeOption, ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface CellTypeRow {
  id: number;
  name: string;
  status: string;
  progress: number;
  active: boolean;
  rating: number;
  change: number;
  changeInd: number;
  amount: number;
  pct: number;
  date: string;
  timeline: { start: string; end: string };
  info: { text: string; tooltip: string; type?: 'info' | 'warning' | 'error' };
  loading: null;
}

const tooltipTexts = [
  { text: 'In stock', tooltip: 'Ready to ship within 24h', type: 'info' as const },
  { text: 'Low stock', tooltip: 'Only 3 units remaining', type: 'warning' as const },
  { text: 'Discontinued', tooltip: 'No longer manufactured', type: 'error' as const },
  { text: 'Pre-order', tooltip: 'Available from next quarter', type: 'info' as const },
  { text: 'Backordered', tooltip: 'Expected restock in 2 weeks', type: 'warning' as const },
];

const data: CellTypeRow[] = [
  { id: 1, name: 'Widget Pro', status: 'active', progress: 85, active: true, rating: 5, change: 12.5, changeInd: 3.2, amount: 29999, pct: 0.42, date: '2026-01-15', timeline: { start: '2026-01-01', end: '2026-03-15' }, info: tooltipTexts[0]!, loading: null },
  { id: 2, name: 'Gadget X', status: 'pending', progress: 45, active: false, rating: 3, change: -8.3, changeInd: -1.7, amount: 14950, pct: 0.18, date: '2026-02-20', timeline: { start: '2026-02-10', end: '2026-05-20' }, info: tooltipTexts[1]!, loading: null },
  { id: 3, name: 'Tool Kit', status: 'inactive', progress: 10, active: false, rating: 2, change: -22.1, changeInd: -5.4, amount: 8995, pct: 0.05, date: '2026-03-10', timeline: { start: '2026-01-15', end: '2026-02-28' }, info: tooltipTexts[2]!, loading: null },
  { id: 4, name: 'Sensor Pack', status: 'active', progress: 92, active: true, rating: 4, change: 45.0, changeInd: 12.8, amount: 45900, pct: 0.67, date: '2026-04-05', timeline: { start: '2026-03-01', end: '2026-08-30' }, info: tooltipTexts[3]!, loading: null },
  { id: 5, name: 'Cable Bundle', status: 'active', progress: 60, active: true, rating: 3, change: 2.1, changeInd: 0.5, amount: 2499, pct: 0.33, date: '2026-05-18', timeline: { start: '2026-04-01', end: '2026-06-15' }, info: tooltipTexts[4]!, loading: null },
  { id: 6, name: 'Display 4K', status: 'pending', progress: 30, active: false, rating: 4, change: -3.7, changeInd: -0.9, amount: 59900, pct: 0.29, date: '2026-06-01', timeline: { start: '2026-05-15', end: '2026-09-30' }, info: tooltipTexts[0]!, loading: null },
  { id: 7, name: 'Mount Arm', status: 'active', progress: 100, active: true, rating: 5, change: 18.9, changeInd: 7.3, amount: 4500, pct: 0.60, date: '2026-07-12', timeline: { start: '2026-01-01', end: '2026-07-01' }, info: tooltipTexts[1]!, loading: null },
  { id: 8, name: 'IoT Hub', status: 'inactive', progress: 5, active: false, rating: 1, change: -50.0, changeInd: -15.2, amount: 19900, pct: 0.08, date: '2026-08-22', timeline: { start: '2026-06-01', end: '2026-07-15' }, info: tooltipTexts[2]!, loading: null },
  { id: 9, name: 'Mesh Router', status: 'active', progress: 72, active: true, rating: 4, change: 9.4, changeInd: 2.1, amount: 17999, pct: 0.41, date: '2026-09-03', timeline: { start: '2026-07-01', end: '2026-11-30' }, info: tooltipTexts[3]!, loading: null },
  { id: 10, name: 'USB-C Dock', status: 'pending', progress: 55, active: true, rating: 3, change: 0.0, changeInd: 0.0, amount: 6999, pct: 0.54, date: '2026-10-15', timeline: { start: '2026-08-15', end: '2026-10-30' }, info: tooltipTexts[4]!, loading: null },
  { id: 11, name: 'Dev Board v3', status: 'active', progress: 88, active: true, rating: 5, change: 33.6, changeInd: 8.9, amount: 5495, pct: 0.49, date: '2026-11-01', timeline: { start: '2026-09-01', end: '2026-12-31' }, info: tooltipTexts[0]!, loading: null },
  { id: 12, name: 'License Srv', status: 'inactive', progress: 0, active: false, rating: 2, change: -15.8, changeInd: -4.1, amount: 99900, pct: 0.88, date: '2026-11-20', timeline: { start: '2026-01-01', end: '2026-04-30' }, info: tooltipTexts[2]!, loading: null },
  { id: 13, name: 'PoE Switch', status: 'active', progress: 67, active: true, rating: 4, change: 7.2, changeInd: 1.8, amount: 24900, pct: 0.34, date: '2025-12-05', timeline: { start: '2026-02-01', end: '2026-06-30' }, info: tooltipTexts[1]!, loading: null },
  { id: 14, name: 'Thermal Cam', status: 'pending', progress: 38, active: false, rating: 3, change: -1.5, changeInd: -0.3, amount: 84900, pct: 0.32, date: '2025-11-30', timeline: { start: '2026-05-01', end: '2026-08-15' }, info: tooltipTexts[4]!, loading: null },
  { id: 15, name: 'Edge Gateway', status: 'active', progress: 78, active: true, rating: 4, change: 21.3, changeInd: 6.0, amount: 34900, pct: 0.38, date: '2026-02-14', timeline: { start: '2026-01-15', end: '2026-09-15' }, info: tooltipTexts[3]!, loading: null },
  { id: 16, name: 'Power Strip', status: 'pending', progress: 52, active: true, rating: 3, change: 4.8, changeInd: 1.2, amount: 3299, pct: 0.27, date: '2026-03-22', timeline: { start: '2026-03-01', end: '2026-05-30' }, info: tooltipTexts[0]!, loading: null },
  { id: 17, name: 'Signal Amp', status: 'active', progress: 95, active: true, rating: 5, change: 28.7, changeInd: 9.4, amount: 12450, pct: 0.56, date: '2026-04-18', timeline: { start: '2026-02-15', end: '2026-10-31' }, info: tooltipTexts[1]!, loading: null },
  { id: 18, name: 'Rack Server', status: 'inactive', progress: 15, active: false, rating: 2, change: -12.4, changeInd: -3.6, amount: 149900, pct: 0.92, date: '2026-05-02', timeline: { start: '2026-04-01', end: '2026-05-15' }, info: tooltipTexts[2]!, loading: null },
  { id: 19, name: 'KVM Switch', status: 'active', progress: 81, active: true, rating: 4, change: 15.9, changeInd: 4.3, amount: 8750, pct: 0.44, date: '2026-06-15', timeline: { start: '2026-06-01', end: '2026-11-15' }, info: tooltipTexts[3]!, loading: null },
  { id: 20, name: 'Fiber Module', status: 'pending', progress: 40, active: false, rating: 3, change: -0.8, changeInd: -0.2, amount: 22500, pct: 0.31, date: '2026-07-08', timeline: { start: '2026-07-01', end: '2026-09-30' }, info: tooltipTexts[4]!, loading: null },
];

const columns = [
  col.text('name', { headerName: 'Name (text)', width: 140 }),
  col.badge('status', {
    headerName: 'Status (badge)',
    width: 110,
    options: [
      { label: 'Active', value: 'active', color: '#166534', bg: '#dcfce7' },
      { label: 'Pending', value: 'pending', color: '#92400e', bg: '#fef3c7' },
      { label: 'Inactive', value: 'inactive', color: '#991b1b', bg: '#fee2e2' },
    ] as BadgeOption[],
  }),
  col.progress('progress', { headerName: 'Progress', width: 130 }),
  col.boolean('active', { headerName: 'Active', width: 70, editable: false }),
  col.rating('rating', { headerName: 'Rating', width: 110 }),
  col.change('change', { headerName: 'Change', width: 100 }),
  col.changeIndicator('changeInd', { headerName: 'Indicator', width: 110 }),
  col.currency('amount', { headerName: 'Amount', width: 110 }),
  col.percent('pct', { headerName: 'Percent', width: 80 }),
  col.date('date', { headerName: 'Date', width: 120 }),
  col.timeline('timeline', {
    headerName: 'Timeline',
    width: 160,
    meta: { timelineStart: '2026-01-01', timelineEnd: '2026-12-31' },
  }),
  col.tooltip('info', { headerName: 'Info (tooltip)', width: 120 }),
  col.loading('loading', { headerName: 'Loading', width: 100 }),
] as ColumnDef<CellTypeRow>[];

export function CellTypes() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Cell Types</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        All built-in column types via the <code>col.&lt;type&gt;()</code> builders. Each column
        demonstrates a different visual renderer. Built-in cell renderers are auto-included by
        <code> useGrid</code>; the <code>format</code> feature handles locale + currency.
      </p>

      <BetterGrid<CellTypeRow>
        columns={columns}
        data={data}
        mode="view"
        features={{ format: { locale: 'en-US', currencyCode: 'USD' } }}
        selection={{ mode: 'range' }}
        height={480}
      />

      <div style={{ marginTop: 12, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Cell types shown:</strong>{' '}
        text (default) | badge | progress | boolean | rating | change | changeIndicator | currency | percent | date | timeline | tooltip | loading
      </div>
    </div>
  );
}

