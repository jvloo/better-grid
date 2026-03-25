import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, sorting } from '@better-grid/plugins';
import '@better-grid/core/styles.css';

interface TimeSeriesRow {
  id: number;
  ticker: string;
  company: string;
  sector: string;
  region: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
}

const sectors = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial', 'Materials', 'Utilities'];
const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
const companies: [string, string][] = [
  ['AAPL', 'Apple Inc.'],
  ['MSFT', 'Microsoft Corp.'],
  ['GOOGL', 'Alphabet Inc.'],
  ['AMZN', 'Amazon.com Inc.'],
  ['NVDA', 'NVIDIA Corp.'],
  ['META', 'Meta Platforms'],
  ['TSLA', 'Tesla Inc.'],
  ['JPM', 'JPMorgan Chase'],
  ['JNJ', 'Johnson & Johnson'],
  ['V', 'Visa Inc.'],
  ['PG', 'Procter & Gamble'],
  ['UNH', 'UnitedHealth Group'],
  ['XOM', 'Exxon Mobil'],
  ['MA', 'Mastercard Inc.'],
  ['HD', 'Home Depot'],
  ['BAC', 'Bank of America'],
  ['PFE', 'Pfizer Inc.'],
  ['COST', 'Costco Wholesale'],
  ['DIS', 'Walt Disney Co.'],
  ['NFLX', 'Netflix Inc.'],
  ['INTC', 'Intel Corp.'],
  ['AMD', 'Advanced Micro'],
  ['CRM', 'Salesforce Inc.'],
  ['ORCL', 'Oracle Corp.'],
  ['ABT', 'Abbott Labs'],
  ['NKE', 'Nike Inc.'],
  ['WMT', 'Walmart Inc.'],
  ['T', 'AT&T Inc.'],
  ['VZ', 'Verizon Comm.'],
  ['CSCO', 'Cisco Systems'],
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = seededRandom(42);
const sampleData: TimeSeriesRow[] = companies.map(([ticker, company], i) => ({
  id: i + 1,
  ticker,
  company,
  sector: sectors[i % sectors.length]!,
  region: regions[i % regions.length]!,
  jan: Math.round((rng() * 200 - 50) * 100) / 100,
  feb: Math.round((rng() * 200 - 50) * 100) / 100,
  mar: Math.round((rng() * 200 - 50) * 100) / 100,
  apr: Math.round((rng() * 200 - 50) * 100) / 100,
  may: Math.round((rng() * 200 - 50) * 100) / 100,
  jun: Math.round((rng() * 200 - 50) * 100) / 100,
  jul: Math.round((rng() * 200 - 50) * 100) / 100,
  aug: Math.round((rng() * 200 - 50) * 100) / 100,
  sep: Math.round((rng() * 200 - 50) * 100) / 100,
  oct: Math.round((rng() * 200 - 50) * 100) / 100,
  nov: Math.round((rng() * 200 - 50) * 100) / 100,
  dec: Math.round((rng() * 200 - 50) * 100) / 100,
}));

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
const monthHeaders = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function FreezeClipDemo() {
  const columns = useMemo<ColumnDef<TimeSeriesRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40, sortable: true },
      { id: 'ticker', header: 'Ticker', width: 80, sortable: true },
      { id: 'company', header: 'Company', width: 160, sortable: true },
      { id: 'sector', header: 'Sector', width: 110, sortable: true },
      { id: 'region', header: 'Region', width: 120, sortable: true },
      ...months.map((m, i) => ({
        id: m,
        header: monthHeaders[i]!,
        width: 90,
        cellType: 'currency' as const,
        sortable: true,
      })),
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }),
      sorting(),
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Freeze Clip</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Drag the handle at the frozen column boundary to visually clip the frozen area at any position &mdash; mid-column, anywhere.
        The frozen columns stay rendered but get cropped by the narrower container, like a sliding curtain.
        Useful for time-series data where frozen identifier columns eat too much viewport space.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        <strong>Try:</strong> Drag the handle at the frozen boundary leftward &mdash; notice it clips at any pixel, even mid-column &bull;
        A subtle blue edge shows the clip boundary &bull;
        Double-click the handle to restore full width (or hover for tooltip) &bull;
        Drag near the original boundary to snap back
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 8, color: '#444' }}>5 frozen columns with Freeze Clip</h3>
      <BetterGrid<TimeSeriesRow>
        columns={columns}
        data={sampleData}
        frozenLeftColumns={5}
        freezeClip={true}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={340}
      />

      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 8, color: '#444' }}>Allow clipping to zero (minVisible: 0)</h3>
      <BetterGrid<TimeSeriesRow>
        columns={columns}
        data={sampleData}
        frozenLeftColumns={5}
        freezeClip={{ minVisible: 0 }}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={340}
      />
    </div>
  );
}
