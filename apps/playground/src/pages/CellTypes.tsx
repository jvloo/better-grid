import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, cellRenderers, sorting } from '@better-grid/plugins';
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
}

const data: CellTypeRow[] = [
  { id: 1, name: 'Widget Pro', status: 'active', progress: 85, active: true, rating: 5, change: 12.5, changeInd: 3.2, amount: 29999, pct: 0.42, date: '2026-01-15' },
  { id: 2, name: 'Gadget X', status: 'pending', progress: 45, active: false, rating: 3, change: -8.3, changeInd: -1.7, amount: 14950, pct: 0.18, date: '2026-02-20' },
  { id: 3, name: 'Tool Kit', status: 'inactive', progress: 10, active: false, rating: 2, change: -22.1, changeInd: -5.4, amount: 8995, pct: 0.05, date: '2026-03-10' },
  { id: 4, name: 'Sensor Pack', status: 'active', progress: 92, active: true, rating: 4, change: 45.0, changeInd: 12.8, amount: 45900, pct: 0.67, date: '2026-04-05' },
  { id: 5, name: 'Cable Bundle', status: 'active', progress: 60, active: true, rating: 3, change: 2.1, changeInd: 0.5, amount: 2499, pct: 0.33, date: '2026-05-18' },
  { id: 6, name: 'Display 4K', status: 'pending', progress: 30, active: false, rating: 4, change: -3.7, changeInd: -0.9, amount: 59900, pct: 0.29, date: '2026-06-01' },
  { id: 7, name: 'Mount Arm', status: 'active', progress: 100, active: true, rating: 5, change: 18.9, changeInd: 7.3, amount: 4500, pct: 0.60, date: '2026-07-12' },
  { id: 8, name: 'IoT Hub', status: 'inactive', progress: 5, active: false, rating: 1, change: -50.0, changeInd: -15.2, amount: 19900, pct: 0.08, date: '2026-08-22' },
  { id: 9, name: 'Mesh Router', status: 'active', progress: 72, active: true, rating: 4, change: 9.4, changeInd: 2.1, amount: 17999, pct: 0.41, date: '2026-09-03' },
  { id: 10, name: 'USB-C Dock', status: 'pending', progress: 55, active: true, rating: 3, change: 0.0, changeInd: 0.0, amount: 6999, pct: 0.54, date: '2026-10-15' },
  { id: 11, name: 'Dev Board v3', status: 'active', progress: 88, active: true, rating: 5, change: 33.6, changeInd: 8.9, amount: 5495, pct: 0.49, date: '2026-11-01' },
  { id: 12, name: 'License Srv', status: 'inactive', progress: 0, active: false, rating: 2, change: -15.8, changeInd: -4.1, amount: 99900, pct: 0.88, date: '2026-11-20' },
  { id: 13, name: 'PoE Switch', status: 'active', progress: 67, active: true, rating: 4, change: 7.2, changeInd: 1.8, amount: 24900, pct: 0.34, date: '2025-12-05' },
  { id: 14, name: 'Thermal Cam', status: 'pending', progress: 38, active: false, rating: 3, change: -1.5, changeInd: -0.3, amount: 84900, pct: 0.32, date: '2025-11-30' },
  { id: 15, name: 'Edge Gateway', status: 'active', progress: 78, active: true, rating: 4, change: 21.3, changeInd: 6.0, amount: 34900, pct: 0.38, date: '2026-02-14' },
  { id: 16, name: 'Power Strip', status: 'pending', progress: 52, active: true, rating: 3, change: 4.8, changeInd: 1.2, amount: 3299, pct: 0.27, date: '2026-03-22' },
  { id: 17, name: 'Signal Amp', status: 'active', progress: 95, active: true, rating: 5, change: 28.7, changeInd: 9.4, amount: 12450, pct: 0.56, date: '2026-04-18' },
  { id: 18, name: 'Rack Server', status: 'inactive', progress: 15, active: false, rating: 2, change: -12.4, changeInd: -3.6, amount: 149900, pct: 0.92, date: '2026-05-02' },
  { id: 19, name: 'KVM Switch', status: 'active', progress: 81, active: true, rating: 4, change: 15.9, changeInd: 4.3, amount: 8750, pct: 0.44, date: '2026-06-15' },
  { id: 20, name: 'Fiber Module', status: 'pending', progress: 40, active: false, rating: 3, change: -0.8, changeInd: -0.2, amount: 22500, pct: 0.31, date: '2026-07-08' },
];

const columns: ColumnDef<CellTypeRow>[] = [
  {
    id: 'name',
    header: 'Name (text)',
    width: 140,
  },
  {
    id: 'status',
    header: 'Status (badge)',
    width: 110,
    cellType: 'badge',
    options: [
      { label: 'Active', value: 'active', color: '#166534', bg: '#dcfce7' },
      { label: 'Pending', value: 'pending', color: '#92400e', bg: '#fef3c7' },
      { label: 'Inactive', value: 'inactive', color: '#991b1b', bg: '#fee2e2' },
    ],
  },
  {
    id: 'progress',
    header: 'Progress',
    width: 130,
    cellType: 'progress',
  },
  {
    id: 'active',
    header: 'Active',
    width: 70,
    cellType: 'boolean',
  },
  {
    id: 'rating',
    header: 'Rating',
    width: 110,
    cellType: 'rating',
  },
  {
    id: 'change',
    header: 'Change',
    width: 100,
    cellType: 'change',
  },
  {
    id: 'changeInd',
    header: 'Indicator',
    width: 110,
    cellType: 'changeIndicator',
  },
  {
    id: 'amount',
    header: 'Amount',
    width: 110,
    cellType: 'currency',
  },
  {
    id: 'pct',
    header: 'Percent',
    width: 80,
    cellType: 'percent',
  },
  {
    id: 'date',
    header: 'Date',
    width: 120,
    cellType: 'date',
  },
];

export function CellTypes() {
  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      cellRenderers(),
      sorting(),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Cell Types</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        All registered cellTypes from the <code>cellRenderers()</code> plugin.
        Each column demonstrates a different visual renderer.
      </p>

      <BetterGrid<CellTypeRow>
        columns={columns}
        data={data}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={480}
      />

      <div style={{ marginTop: 12, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Cell types shown:</strong>{' '}
        text (default) | badge | progress | boolean | rating | change | changeIndicator | currency | percent | date
      </div>
    </div>
  );
}
