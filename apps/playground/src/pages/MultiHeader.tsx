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
  density: number;
  hdi: number;
  gdp: number;
  growth: number;
  unemployment: number;
  inflation: number;
  exports: number;
  fdi: number;
}

const data: RegionRow[] = [
  { id: 1, region: 'North America', country: 'USA', city: 'New York', population: 8336, area: 783, density: 10646, hdi: 0.921, gdp: 1200, growth: 2.1, unemployment: 4.2, inflation: 3.1, exports: 420, fdi: 85 },
  { id: 2, region: 'North America', country: 'USA', city: 'Los Angeles', population: 3979, area: 1214, density: 3277, hdi: 0.921, gdp: 890, growth: 1.8, unemployment: 5.1, inflation: 3.4, exports: 310, fdi: 62 },
  { id: 3, region: 'North America', country: 'Canada', city: 'Toronto', population: 2794, area: 630, density: 4435, hdi: 0.929, gdp: 420, growth: 2.3, unemployment: 5.8, inflation: 2.9, exports: 180, fdi: 38 },
  { id: 4, region: 'Europe', country: 'UK', city: 'London', population: 8982, area: 1572, density: 5714, hdi: 0.929, gdp: 950, growth: 1.5, unemployment: 3.8, inflation: 4.2, exports: 350, fdi: 72 },
  { id: 5, region: 'Europe', country: 'Germany', city: 'Berlin', population: 3645, area: 892, density: 4087, hdi: 0.942, gdp: 620, growth: 0.9, unemployment: 5.4, inflation: 3.7, exports: 280, fdi: 55 },
  { id: 6, region: 'Europe', country: 'France', city: 'Paris', population: 2161, area: 105, density: 20581, hdi: 0.903, gdp: 780, growth: 1.2, unemployment: 7.1, inflation: 3.5, exports: 260, fdi: 48 },
  { id: 7, region: 'Asia', country: 'Japan', city: 'Tokyo', population: 13960, area: 2191, density: 6372, hdi: 0.925, gdp: 1800, growth: 1.1, unemployment: 2.6, inflation: 2.1, exports: 650, fdi: 28 },
  { id: 8, region: 'Asia', country: 'China', city: 'Shanghai', population: 24870, area: 6341, density: 3923, hdi: 0.768, gdp: 1100, growth: 5.2, unemployment: 4.5, inflation: 1.8, exports: 520, fdi: 95 },
  { id: 9, region: 'Asia', country: 'Singapore', city: 'Singapore', population: 5686, area: 729, density: 7799, hdi: 0.939, gdp: 550, growth: 3.8, unemployment: 2.1, inflation: 2.5, exports: 390, fdi: 110 },
  { id: 10, region: 'Oceania', country: 'Australia', city: 'Sydney', population: 5312, area: 12368, density: 429, hdi: 0.951, gdp: 480, growth: 2.5, unemployment: 3.5, inflation: 3.8, exports: 210, fdi: 42 },
  { id: 11, region: 'South America', country: 'Brazil', city: 'São Paulo', population: 12330, area: 1521, density: 8106, hdi: 0.754, gdp: 700, growth: 1.4, unemployment: 8.9, inflation: 4.6, exports: 190, fdi: 35 },
  { id: 12, region: 'South America', country: 'Argentina', city: 'Buenos Aires', population: 3076, area: 203, density: 15153, hdi: 0.842, gdp: 320, growth: -1.2, unemployment: 7.1, inflation: 72.4, exports: 65, fdi: 8 },
  { id: 13, region: 'Africa', country: 'South Africa', city: 'Johannesburg', population: 5783, area: 1645, density: 3515, hdi: 0.713, gdp: 180, growth: 1.9, unemployment: 29.8, inflation: 5.4, exports: 85, fdi: 12 },
  { id: 14, region: 'Africa', country: 'Nigeria', city: 'Lagos', population: 15388, area: 1171, density: 13141, hdi: 0.539, gdp: 140, growth: 3.3, unemployment: 33.3, inflation: 18.6, exports: 55, fdi: 6 },
  { id: 15, region: 'Asia', country: 'India', city: 'Mumbai', population: 20411, area: 603, density: 33849, hdi: 0.644, gdp: 370, growth: 6.8, unemployment: 6.9, inflation: 5.1, exports: 160, fdi: 45 },
  { id: 16, region: 'Asia', country: 'South Korea', city: 'Seoul', population: 9776, area: 605, density: 16159, hdi: 0.925, gdp: 980, growth: 2.6, unemployment: 2.9, inflation: 3.3, exports: 440, fdi: 18 },
  { id: 17, region: 'Europe', country: 'Spain', city: 'Madrid', population: 3223, area: 604, density: 5336, hdi: 0.905, gdp: 410, growth: 2.5, unemployment: 11.7, inflation: 3.1, exports: 175, fdi: 30 },
  { id: 18, region: 'Europe', country: 'Italy', city: 'Rome', population: 2873, area: 1285, density: 2236, hdi: 0.895, gdp: 390, growth: 0.7, unemployment: 7.6, inflation: 5.9, exports: 195, fdi: 25 },
  { id: 19, region: 'North America', country: 'Mexico', city: 'Mexico City', population: 9209, area: 1485, density: 6202, hdi: 0.758, gdp: 310, growth: 3.1, unemployment: 3.3, inflation: 4.7, exports: 145, fdi: 32 },
  { id: 20, region: 'Oceania', country: 'New Zealand', city: 'Auckland', population: 1657, area: 1086, density: 1526, hdi: 0.937, gdp: 95, growth: 2.2, unemployment: 3.4, inflation: 4.1, exports: 35, fdi: 5 },
];

export function MultiHeader() {
  const headerRows = useMemo<HeaderRow[]>(
    () => [
      {
        id: 'groups',
        height: 30,
        cells: [
          { id: 'g-loc', content: 'Location', colSpan: 4 },
          { id: 'g-demo', content: 'Demographics', colSpan: 4 },
          { id: 'g-econ', content: 'Economic Indicators', colSpan: 6 },
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
          { id: 'h-density', content: 'Density', columnId: 'density' },
          { id: 'h-hdi', content: 'HDI', columnId: 'hdi' },
          { id: 'h-gdp', content: 'GDP ($B)', columnId: 'gdp' },
          { id: 'h-growth', content: 'Growth %', columnId: 'growth' },
          { id: 'h-unemp', content: 'Unemp. %', columnId: 'unemployment' },
          { id: 'h-infl', content: 'Inflation %', columnId: 'inflation' },
          { id: 'h-exports', content: 'Exports ($B)', columnId: 'exports' },
          { id: 'h-fdi', content: 'FDI ($B)', columnId: 'fdi' },
        ],
      },
    ],
    [],
  );

  const columns = useMemo<ColumnDef<RegionRow>[]>(
    () => [
      { id: 'id', header: '#', width: 40 },
      { id: 'region', header: 'Region', width: 130 },
      { id: 'country', header: 'Country', width: 110 },
      { id: 'city', header: 'City', width: 110 },
      { id: 'population', header: 'Pop. (K)', width: 90, align: 'right' },
      { id: 'area', header: 'Area (km²)', width: 100, align: 'right' },
      { id: 'density', header: 'Density', width: 85, align: 'right' },
      { id: 'hdi', header: 'HDI', width: 65, align: 'right' },
      { id: 'gdp', header: 'GDP ($B)', width: 90, align: 'right' },
      { id: 'growth', header: 'Growth %', width: 90, align: 'right' },
      { id: 'unemployment', header: 'Unemp. %', width: 90, align: 'right' },
      { id: 'inflation', header: 'Inflation %', width: 100, align: 'right' },
      { id: 'exports', header: 'Exports ($B)', width: 110, align: 'right' },
      { id: 'fdi', header: 'FDI ($B)', width: 90, align: 'right' },
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
        <strong>Header structure:</strong> Location (4 cols) &bull; Demographics (4 cols) &bull; Economic Indicators (6 cols)
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

const headerRows = [
  { id: 'groups', height: 30, cells: [
    { id: 'g-loc', content: 'Location', colSpan: 4 },
    { id: 'g-demo', content: 'Demographics', colSpan: 4 },
    { id: 'g-econ', content: 'Economic Indicators', colSpan: 6 },
  ]},
  { id: 'columns', height: 30, cells: [
    { id: 'h-id', content: '#', columnId: 'id' },
    { id: 'h-region', content: 'Region', columnId: 'region' },
    // ... 12 more column headers
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
