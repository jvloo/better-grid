import { useMemo } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, HeaderRow } from '@better-grid/core';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface RegionRow {
  id: number;
  region: string;
  country: string;
  city: string;
  population: number;
  area: number;
  gdp: number;
  growth: number;
  unemployment: number;
  inflation: number;
}

const data: RegionRow[] = [
  { id: 1, region: 'North America', country: 'USA', city: 'New York', population: 8336, area: 783, gdp: 1200, growth: 2.1, unemployment: 4.2, inflation: 3.1 },
  { id: 2, region: 'North America', country: 'USA', city: 'Los Angeles', population: 3979, area: 1214, gdp: 890, growth: 1.8, unemployment: 5.1, inflation: 3.4 },
  { id: 3, region: 'North America', country: 'Canada', city: 'Toronto', population: 2794, area: 630, gdp: 420, growth: 2.3, unemployment: 5.8, inflation: 2.9 },
  { id: 4, region: 'Europe', country: 'UK', city: 'London', population: 8982, area: 1572, gdp: 950, growth: 1.5, unemployment: 3.8, inflation: 4.2 },
  { id: 5, region: 'Europe', country: 'Germany', city: 'Berlin', population: 3645, area: 892, gdp: 620, growth: 0.9, unemployment: 5.4, inflation: 3.7 },
  { id: 6, region: 'Europe', country: 'France', city: 'Paris', population: 2161, area: 105, gdp: 780, growth: 1.2, unemployment: 7.1, inflation: 3.5 },
  { id: 7, region: 'Asia', country: 'Japan', city: 'Tokyo', population: 13960, area: 2191, gdp: 1800, growth: 1.1, unemployment: 2.6, inflation: 2.1 },
  { id: 8, region: 'Asia', country: 'China', city: 'Shanghai', population: 24870, area: 6341, gdp: 1100, growth: 5.2, unemployment: 4.5, inflation: 1.8 },
  { id: 9, region: 'Asia', country: 'Singapore', city: 'Singapore', population: 5686, area: 729, gdp: 550, growth: 3.8, unemployment: 2.1, inflation: 2.5 },
  { id: 10, region: 'Oceania', country: 'Australia', city: 'Sydney', population: 5312, area: 12368, gdp: 480, growth: 2.5, unemployment: 3.5, inflation: 3.8 },
];

export function MultiHeader() {
  const headerRows = useMemo<HeaderRow[]>(
    () => [
      {
        id: 'groups',
        height: 30,
        cells: [
          { id: 'g-loc', content: 'Location', colSpan: 4 },
          { id: 'g-demo', content: 'Demographics', colSpan: 2 },
          { id: 'g-econ', content: 'Economic Indicators', colSpan: 4 },
        ],
      },
      {
        id: 'columns',
        height: 30,
        cells: [
          { id: 'h-id', content: '#', columnId: 'id' },
          { id: 'h-region', content: 'Region', columnId: 'region' },
          { id: 'h-country', content: 'Country', columnId: 'country' },
          { id: 'h-city', content: 'City', columnId: 'city' },
          { id: 'h-pop', content: 'Pop. (K)', columnId: 'population' },
          { id: 'h-area', content: 'Area (km²)', columnId: 'area' },
          { id: 'h-gdp', content: 'GDP ($B)', columnId: 'gdp' },
          { id: 'h-growth', content: 'Growth %', columnId: 'growth' },
          { id: 'h-unemp', content: 'Unemp. %', columnId: 'unemployment' },
          { id: 'h-infl', content: 'Inflation %', columnId: 'inflation' },
        ],
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<RegionRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40 },
      { id: 'region', header: 'Region', width: 130 },
      { id: 'country', header: 'Country', width: 100 },
      { id: 'city', header: 'City', width: 110 },
      { id: 'population', header: 'Pop. (K)', width: 90 },
      { id: 'area', header: 'Area (km²)', width: 100 },
      { id: 'gdp', header: 'GDP ($B)', width: 90 },
      { id: 'growth', header: 'Growth %', width: 90 },
      { id: 'unemployment', header: 'Unemp. %', width: 90 },
      { id: 'inflation', header: 'Inflation %', width: 100 },
    ],
    [],
  );

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Multi-Level Headers — Core Feature</h1>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Grouped column headers with colSpan. No plugins — this is a core feature.
      </p>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888' }}>
        <strong>Header structure:</strong> Location (4 cols) &bull; Demographics (2 cols) &bull; Economic Indicators (4 cols)
        <br />
        <strong>Frozen:</strong> #, Region, Country columns stay on left during horizontal scroll.
      </div>

      <BetterGrid<RegionRow>
        columns={columns}
        data={data}
        headerRows={headerRows}
        frozenLeftColumns={3}
        selection={{ mode: 'range' }}
        height={400}
      />

      <CodeBlock title="Multi-Header" code={`// Multi-level headers — a core feature, no plugins needed

const columns = [
  { id: 'id', header: '#', width: 40 },
  { id: 'region', header: 'Region', width: 130 },
  { id: 'country', header: 'Country', width: 100 },
  { id: 'city', header: 'City', width: 110 },
  { id: 'population', header: 'Pop. (K)', width: 90 },
  { id: 'area', header: 'Area (km²)', width: 100 },
  { id: 'gdp', header: 'GDP ($B)', width: 90 },
  { id: 'growth', header: 'Growth %', width: 90 },
  { id: 'unemployment', header: 'Unemp. %', width: 90 },
  { id: 'inflation', header: 'Inflation %', width: 100 },
];

const headerRows = [
  { id: 'groups', height: 30, cells: [
    { id: 'g-loc', content: 'Location', colSpan: 4 },
    { id: 'g-demo', content: 'Demographics', colSpan: 2 },
    { id: 'g-econ', content: 'Economic Indicators', colSpan: 4 },
  ]},
  { id: 'columns', height: 30, cells: [
    { id: 'h-id', content: '#', columnId: 'id' },
    { id: 'h-region', content: 'Region', columnId: 'region' },
    { id: 'h-country', content: 'Country', columnId: 'country' },
    { id: 'h-city', content: 'City', columnId: 'city' },
    { id: 'h-pop', content: 'Pop. (K)', columnId: 'population' },
    { id: 'h-area', content: 'Area (km²)', columnId: 'area' },
    { id: 'h-gdp', content: 'GDP ($B)', columnId: 'gdp' },
    { id: 'h-growth', content: 'Growth %', columnId: 'growth' },
    { id: 'h-unemp', content: 'Unemp. %', columnId: 'unemployment' },
    { id: 'h-infl', content: 'Inflation %', columnId: 'inflation' },
  ]},
];

<BetterGrid
  columns={columns}
  data={data}
  headerRows={headerRows}
  frozenLeftColumns={3}
  selection={{ mode: 'range' }}
  height={400}
/>`} />
    </div>
  );
}
