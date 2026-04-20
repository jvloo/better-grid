import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, editing, sorting, hierarchy, cellRenderers, validation, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';
import { FsbtProgramSummary } from './_FsbtProgramSummary';
import { FSBT_STYLES, parentRowCellStyle } from './_fsbt-cell-styles';

// ============================================================================
// Shared helpers — match FsbtCost's date formatting so every FSBT table has
// the same Mon-YY display and MM/YY masked editor round-trip.
// ============================================================================

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'] as const;

function formatMonYY(dateIso: string): string {
  if (!dateIso) return '';
  const [yStr, mStr] = dateIso.split('-');
  if (!yStr || !mStr) return dateIso;
  const m = parseInt(mStr, 10) - 1;
  return `${MONTH_NAMES[m] ?? mStr} ${yStr.slice(2)}`;
}

function formatIsoToMMYY(v: unknown): string {
  if (!v || typeof v !== 'string') return '';
  const [yStr, mStr] = v.split('-');
  if (!yStr || !mStr) return '';
  return `${mStr}/${yStr.slice(2)}`;
}

function parseMMYYToIso(v: string): string | undefined {
  const digits = v.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length < 4) return undefined;
  const month = digits.slice(0, 2);
  const yearSuffix = digits.slice(2, 4);
  if (!/^(0[1-9]|1[0-2])$/.test(month)) return undefined;
  const year = 2000 + Number(yearSuffix);
  return `${year}-${month}-01`;
}

function formatAU(value: number): string {
  return value.toLocaleString('en-AU', { maximumFractionDigits: 0 });
}

// Monthly-cell formatter: blanks out zeros (Wiseway convention — empty cells
// beat a sea of "0"s) and groups thousands with commas.
const monthValueFormatter = (v: unknown): string => {
  if (v == null || v === 0 || typeof v !== 'number') return '';
  return v.toLocaleString('en-AU', { maximumFractionDigits: 0 });
};

// ============================================================================
// Grid A: Build-to-Sell (BTS) General Table
// ============================================================================

interface BtsRow {
  id: number;
  type: string;
  stage: number;
  nsa: number;
  units: number;
  salePrice: number;
  growthRate: number | string;
  launchDate: string;
  projectedPrice: number;
  grossRevenue: number;
  gst: number;
  commUpfront: number;
  commBackend: number;
}

// Data from QA app project 4288: https://qa-app.wiseway.ai/projects/4288/revenue
// Total Gross Revenue: $224,739,528
const btsData: BtsRow[] = [
  { id: 1, type: 'Residential - BTS', stage: 1, nsa: 19500, units: 160, salePrice: 8803, growthRate: 6.0, launchDate: '2026-10-01', projectedPrice: 9331, grossRevenue: 181958010, gst: 9.09, commUpfront: 1.5, commBackend: 1.5 },
  { id: 2, type: 'Retail - BTS', stage: 1, nsa: 2600, units: 30, salePrice: 15898, growthRate: 3.5, launchDate: '2026-10-01', projectedPrice: 16454, grossRevenue: 42781518, gst: 9.09, commUpfront: 1.75, commBackend: 0.25 },
  { id: 3, type: 'Land - BTS', stage: 0, nsa: 0, units: 0, salePrice: 1960, growthRate: 'CPI', launchDate: '', projectedPrice: 1960, grossRevenue: 0, gst: 9.09, commUpfront: 0, commBackend: 0 },
];

const TOTAL_GROSS_REVENUE = btsData.reduce((s, r) => s + r.grossRevenue, 0); // $224,739,528

// ============================================================================
// Grid B: BTS Details Table — Gross Revenue / GST / Sales Commission / Net
// Each section has 3 product rows + a Total row. Columns scroll across the
// 39-month window; values are concentrated in the sale month (Oct 2026).
// ============================================================================

// Row shape uses a `kind` discriminator matching Wiseway's source, which
// models sections as { type: 'title' | 'item' | 'accumulation' } — there's
// no parent/child collapsing, just visual grouping, so hierarchy would be
// overkill. Flat array + cellStyle based on `kind` keeps it simple.
type BtsDetailKind = 'section' | 'item' | 'total';

interface BtsDetailRow {
  id: number;
  kind: BtsDetailKind;
  sectionLabel?: string;     // 'Gross Revenue', 'GST', etc. (section rows only)
  type?: string;             // 'Residential - BTS' on items, '' on sections
  description?: string;      // 'Apt', 'West G Floor', 'Park' on items
  input?: number | null;     // percent rate (9.09, 1.50) or null
  amount?: number;
  start?: string;
  end?: string;
  variance?: number;
  m_2026_10?: number;        // sale month — only month populated in Wiseway
  [key: string]: string | number | null | undefined;
}

// Numbers sourced from QA app project 4288 (Oct 26 launch). Residential Apt
// and Retail West G Floor carry all the revenue; Land Park is priced-in but
// unsold, so every section has it at $0.
const btsDetailsData: BtsDetailRow[] = [
  // ── Gross Revenue ──
  { id: 101, kind: 'section', sectionLabel: 'Gross Revenue' },
  { id: 102, kind: 'item', type: 'Residential - BTS', description: 'Apt',           input: null, amount: 181958010, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 181958010 },
  { id: 103, kind: 'item', type: 'Retail - BTS',       description: 'West G Floor', input: null, amount: 42781518,  start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 42781518 },
  { id: 104, kind: 'item', type: 'Land - BTS',         description: 'Park',         input: null, amount: 0,         start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 0 },
  { id: 105, kind: 'total', amount: 224739528, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 224739528 },

  // ── GST (9.09% ≈ 1/11 — Australian GST) ──
  { id: 201, kind: 'section', sectionLabel: 'GST' },
  { id: 202, kind: 'item', type: 'Residential - BTS', description: 'Apt',           input: 9.09, amount: 16540099,  start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 16540099 },
  { id: 203, kind: 'item', type: 'Retail - BTS',       description: 'West G Floor', input: 9.09, amount: 3888810,   start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 3888810 },
  { id: 204, kind: 'item', type: 'Land - BTS',         description: 'Park',         input: 9.09, amount: 0,         start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 0 },
  { id: 205, kind: 'total', amount: 20428909, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 20428909 },

  // ── Sales Commission - Back End (from General: Res 1.5%, Retail 0.25%) ──
  { id: 301, kind: 'section', sectionLabel: 'Sales Commission - Back End' },
  { id: 302, kind: 'item', type: 'Residential - BTS', description: 'Apt',           input: 1.50, amount: 2550893,   start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 2550893 },
  { id: 303, kind: 'item', type: 'Retail - BTS',       description: 'West G Floor', input: 0.25, amount: 63911,     start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 63911 },
  { id: 304, kind: 'item', type: 'Land - BTS',         description: 'Park',         input: 0.00, amount: 0,         start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 0 },
  { id: 305, kind: 'total', amount: 2614804, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 2614804 },

  // ── Net Revenue (= Gross − GST − Commission − other incentive deductions) ──
  { id: 401, kind: 'section', sectionLabel: 'Net Revenue' },
  { id: 402, kind: 'item', type: 'Residential - BTS', description: 'Apt',           input: null, amount: 152050199, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 152050199 },
  { id: 403, kind: 'item', type: 'Retail - BTS',       description: 'West G Floor', input: null, amount: 23176776,  start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 23176776 },
  { id: 404, kind: 'item', type: 'Land - BTS',         description: 'Park',         input: null, amount: 0,         start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 0 },
  { id: 405, kind: 'total', amount: 175226975, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 175226975 },
];

// Section/total row styling — Wiseway shades sections with a grey rule and
// bolds total rows. Centralised here so every column picks up the same look.
const SECTION_BG = '#F8F8F8';
const TOTAL_BORDER_TOP = '1.5px solid #EAECF0';

function btsDetailCellStyle(_v: unknown, row: unknown): Record<string, string> | undefined {
  const r = row as BtsDetailRow;
  if (r.kind === 'section') {
    return { background: SECTION_BG, fontWeight: '600', color: '#101828', fontSize: FSBT_STYLES.infoFontSize };
  }
  if (r.kind === 'total') {
    return { fontWeight: '600', borderTop: TOTAL_BORDER_TOP, fontSize: FSBT_STYLES.infoFontSize };
  }
  return { color: FSBT_STYLES.childText, fontSize: FSBT_STYLES.infoFontSize };
}

// ============================================================================
// Grid C: Holding Rental General Table — NLA / rental rates rollup
// Wiseway's "HoldingGeneralTable" — summary of the rentable stock before
// the monthly cashflow details. Since project 4288 has no holding stock
// configured, we mock plausible data using the same residential/retail/etc
// breakdown that appears in the Holding Rental Details table below.
// ============================================================================

interface HoldingGeneralRow {
  id: number;
  type: string;
  description: string;
  stage: number | null;
  nla: number;
  unit: number;
  grossRent: number;   // $/m² per annum
  outgoings: number;   // $/m² per annum
}

const holdingGeneralData: HoldingGeneralRow[] = [
  { id: 1, type: 'Residential', description: 'Apt',           stage: 1, nla: 6600, unit: 60, grossRent: 520, outgoings: 80 },
  { id: 2, type: 'Commercial',  description: 'Level 1-3',     stage: 1, nla: 3200, unit: 12, grossRent: 650, outgoings: 95 },
  { id: 3, type: 'Retail',      description: 'West G Floor',  stage: 1, nla: 1500, unit: 8,  grossRent: 850, outgoings: 120 },
  { id: 4, type: 'Parking',     description: 'Basement',      stage: 0, nla: 3124, unit: 40, grossRent: 250, outgoings: 40 },
];

interface HoldingRow {
  id: number;
  parentId: number | null;
  type: string;
  description: string;
  input: number;
  amount: number;
  start: string;
  end: string;
  variance: number;
  [key: string]: string | number | null;
}

// Holding data — sourced from QA project 4288. Parent rows (parentId: null)
// are the category rollups; children carry the per-item breakdown.
const holdingData: HoldingRow[] = [
  // Gross Rent
  { id: 1, parentId: null, type: 'Gross Rental Revenue', description: '', input: 0, amount: 8400000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 2, parentId: 1, type: '', description: 'Residential', input: 520, amount: 4264000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 710667, m_2026_02: 710667, m_2026_03: 710667, m_2026_04: 710667, m_2026_05: 710667, m_2026_06: 710665 },
  { id: 3, parentId: 1, type: '', description: 'Commercial', input: 650, amount: 2080000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 346667, m_2026_02: 346667, m_2026_03: 346667, m_2026_04: 346667, m_2026_05: 346667, m_2026_06: 346665 },
  { id: 4, parentId: 1, type: '', description: 'Retail', input: 850, amount: 1275000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 212500, m_2026_02: 212500, m_2026_03: 212500, m_2026_04: 212500, m_2026_05: 212500, m_2026_06: 212500 },
  { id: 5, parentId: 1, type: '', description: 'Parking', input: 250, amount: 781000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 130167, m_2026_02: 130167, m_2026_03: 130167, m_2026_04: 130167, m_2026_05: 130167, m_2026_06: 130165 },

  // Less Outgoings
  { id: 6, parentId: null, type: 'Less: Outgoings', description: '', input: 0, amount: -1260000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 7, parentId: 6, type: '', description: 'Property Management', input: 0, amount: -504000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -84000, m_2026_02: -84000, m_2026_03: -84000, m_2026_04: -84000, m_2026_05: -84000, m_2026_06: -84000 },
  { id: 8, parentId: 6, type: '', description: 'Maintenance & Repairs', input: 0, amount: -378000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -63000, m_2026_02: -63000, m_2026_03: -63000, m_2026_04: -63000, m_2026_05: -63000, m_2026_06: -63000 },
  { id: 9, parentId: 6, type: '', description: 'Insurance & Rates', input: 0, amount: -378000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -63000, m_2026_02: -63000, m_2026_03: -63000, m_2026_04: -63000, m_2026_05: -63000, m_2026_06: -63000 },

  // Incentive
  { id: 10, parentId: null, type: 'Less: Incentives', description: '', input: 0, amount: -420000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 11, parentId: 10, type: '', description: 'Leasing Incentive (5%)', input: 5, amount: -420000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -70000, m_2026_02: -70000, m_2026_03: -70000, m_2026_04: -70000, m_2026_05: -70000, m_2026_06: -70000 },

  // Net (rollup)
  { id: 12, parentId: null, type: 'Net Rental Revenue', description: '', input: 0, amount: 6720000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
];

// ============================================================================
// Grid E: Holding Sale Details — Sale Commission / Remaining Incentive / Net
// Same flat-with-kind shape as BTS Details. In project 4288 the holding-sale
// pool is empty, so values are $0 — we include the structure so the demo
// shows the three-section layout Wiseway users expect on this tab.
// ============================================================================

const holdingSaleData: BtsDetailRow[] = [
  { id: 501, kind: 'section', sectionLabel: 'Sale Commission' },
  { id: 502, kind: 'total', amount: 0, start: '2028-06-30', end: '2028-06-30', variance: 0 },
  { id: 503, kind: 'section', sectionLabel: 'Remaining Incentive (PV)' },
  { id: 504, kind: 'total', amount: 0, start: '2028-06-30', end: '2028-06-30', variance: 0 },
  { id: 505, kind: 'section', sectionLabel: 'Net Sale Revenue' },
  { id: 506, kind: 'total', amount: 0, start: '2028-06-30', end: '2028-06-30', variance: 0 },
];

// Monthly columns cover the same window as Program/Cost (Aug 2023 – Oct 2026)
// so the three FSBT grids line up when a user scrolls across tabs.
const holdingTs = timeSeries({
  start: '2023-08-01',
  end: '2026-10-01',
  locale: 'en-AU',
  columnDefaults: {
    cellType: 'currency' as never,
    precision: 0,
    hideZero: true,
    valueFormatter: monthValueFormatter,
  },
});

export function FsbtRevenue() {
  // ════════════════════════════════════════════════════════════════════════════
  // BTS Grid Setup
  // ════════════════════════════════════════════════════════════════════════════

  const formatInt = (v: unknown): string => (typeof v === 'number' ? v.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : '');
  const formatDollars = (v: unknown): string => (typeof v === 'number' ? '$' + v.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : '');
  const formatRate = (v: unknown): string => {
    if (typeof v === 'number') return v.toFixed(2) + '%';
    if (typeof v === 'string' && v) return v;
    return '';
  };

  const btsColumns = useMemo<ColumnDef<BtsRow>[]>(
    () => [
      { id: 'type', accessorKey: 'type', header: 'Type', width: 170, align: 'left' as const, sortable: true },
      { id: 'stage', accessorKey: 'stage', header: 'Stage', width: 105, align: 'center' as const },
      { id: 'nsa', accessorKey: 'nsa', header: 'NSA (m2)', width: 105, align: 'center' as const, valueFormatter: formatInt },
      { id: 'units', accessorKey: 'units', header: 'Unit/Lot/Tenancy', width: 105, align: 'center' as const, valueFormatter: formatInt },
      { id: 'salePrice', accessorKey: 'salePrice', header: 'Current Sale Price ($/m2)', width: 190, align: 'center' as const, editable: true, valueFormatter: formatDollars },
      { id: 'growthRate', accessorKey: 'growthRate', header: 'Growth Rate', width: 190, align: 'center' as const, editable: true, valueFormatter: formatRate },
      {
        id: 'launchDate', accessorKey: 'launchDate', header: 'Sales Launch Date', width: 190, align: 'center' as const,
        editable: true, placeholder: 'MM/YY',
        cellEditor: 'masked' as const, mask: 'MM/YY',
        valueFormatter: formatIsoToMMYY,
        valueParser: parseMMYYToIso,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsRow;
          container.textContent = row.launchDate ? formatMonYY(row.launchDate) : '';
        },
      },
      {
        id: 'projectedPrice',
        accessorKey: 'projectedPrice',
        header: 'Projected Sale Price ($/m2)',
        width: 190,
        align: 'center' as const,
        valueFormatter: formatDollars,
        cellStyle: () => ({ background: '#f5f5f5' }),
      },
      {
        id: 'grossRevenue',
        accessorKey: 'grossRevenue',
        header: 'Gross Revenue',
        width: 140,
        align: 'center' as const,
        valueFormatter: formatDollars,
      },
      { id: 'gst', accessorKey: 'gst', header: 'GST (%)', width: 120, align: 'center' as const, valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) : '') },
      { id: 'commUpfront', accessorKey: 'commUpfront', header: 'Sales Commission - Upfront (%)', width: 230, align: 'center' as const, editable: true, valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) : '') },
      { id: 'commBackend', accessorKey: 'commBackend', header: 'Sales Commission - Back End (%)', width: 230, align: 'center' as const, editable: true, valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) : '') },
    ],
    [],
  );

  // Totals row — Wiseway's QA app computes a simple (unweighted) arithmetic
  // mean across product rows for per-unit columns. E.g. Sale Price total is
  // (8,803 + 15,898 + 1,960) / 3 = 8,887 — matches the live app exactly.
  // Sum columns (NSA, Units, Gross Revenue) are additive as you'd expect.
  const btsTotalsRow = useMemo(() => {
    const n = btsData.length;
    const avg = (pick: (r: BtsRow) => number) =>
      btsData.reduce((s, r) => s + pick(r), 0) / n;
    return {
      id: -1,
      type: 'Total',
      stage: 1, // Wiseway shows the project stage (not a sum)
      nsa: btsData.reduce((s, r) => s + r.nsa, 0),
      units: btsData.reduce((s, r) => s + r.units, 0),
      salePrice: Math.round(avg(r => r.salePrice)),
      growthRate: null, // mix of number and 'CPI' — not averageable
      launchDate: null,
      projectedPrice: Math.round(avg(r => r.projectedPrice)),
      grossRevenue: btsData.reduce((s, r) => s + r.grossRevenue, 0),
      gst: avg(r => r.gst),
      commUpfront: avg(r => r.commUpfront),
      commBackend: avg(r => r.commBackend),
    } as unknown as BtsRow;
  }, []);

  const btsPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      sorting(),
      cellRenderers(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-bts' }),
    ],
    [],
  );

  const { grid: btsGrid, containerRef: btsRef } = useGrid<BtsRow>({
    data: btsData,
    columns: btsColumns,
    plugins: btsPlugins,
    pinnedBottomRows: [btsTotalsRow],
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    tableStyle: 'striped' as const,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Holding Revenue Grid Setup
  // ════════════════════════════════════════════════════════════════════════════

  const holdingColumns = useMemo<ColumnDef<HoldingRow>[]>(
    () => [
      // ── Type — left column, shows parent labels; children have type='' and
      //    rely on Description for their label, so the Type column is blank on
      //    children but styled with the parent/child tokens.
      { id: 'type', accessorKey: 'type', header: 'Type', width: 200, align: 'left' as const, cellStyle: parentRowCellStyle },
      // ── Description — widened from 80 to 180 so labels like "Maintenance &
      //    Repairs" and "Leasing Incentive (5%)" don't get clipped.
      { id: 'description', accessorKey: 'description', header: 'Description', width: 180, align: 'left' as const, cellStyle: parentRowCellStyle },
      // ── Input — per-m2 rate on children, blank on parents (matches Cost's
      //    pattern: explicit cellRenderer so non-editable parent cells don't
      //    fall through to raw String(0) when inputStyle wraps the column). ──
      {
        id: 'input', accessorKey: 'input', header: 'Input', width: 100, align: 'center' as const,
        cellType: 'currency' as const, precision: 0, hideZero: true,
        editable: ((row: HoldingRow) => row.parentId !== null) as unknown as boolean,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as HoldingRow;
          if (row.parentId === null) {
            container.textContent = '';
            return;
          }
          container.textContent = row.input > 0 ? '$' + formatAU(row.input) : '';
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Amount — sum for the section. Red when negative. Explicit
      //    cellRenderer: inputStyle wrap bypasses the currency cellType when
      //    no renderer/valueFormatter is set, so we format by hand here. ──
      {
        id: 'amount',
        accessorKey: 'amount',
        header: 'Amount',
        width: 120,
        align: 'center' as const,
        editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as HoldingRow;
          const v = row.amount;
          if (typeof v !== 'number') { container.textContent = ''; return; }
          const formatted = v < 0
            ? `($${formatAU(Math.abs(v))})`
            : `$${formatAU(v)}`;
          container.textContent = formatted;
        },
        cellStyle: (v: unknown, row: unknown) => {
          const base = parentRowCellStyle(v, row) ?? {};
          if (typeof v === 'number' && v < 0) return { ...base, color: '#dc2626' };
          return base;
        },
      },
      // ── Start / End — masked MM/YY editor, Mon-YY display, widths match Cost ──
      {
        id: 'start', accessorKey: 'start', header: 'Start', width: 110, align: 'left' as const, placeholder: 'MM/YY',
        cellEditor: 'masked' as const, mask: 'MM/YY',
        editable: ((row: HoldingRow) => row.parentId !== null) as unknown as boolean,
        valueFormatter: formatIsoToMMYY,
        valueParser: parseMMYYToIso,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as HoldingRow;
          const isParent = row.parentId === null;
          container.textContent = row.start ? formatMonYY(row.start) : '';
          container.style.fontSize = FSBT_STYLES.infoFontSize;
          container.style.fontWeight = isParent ? FSBT_STYLES.parentFontWeight : FSBT_STYLES.childFontWeight;
          container.style.color = FSBT_STYLES.childText;
          container.style.backgroundColor = isParent ? FSBT_STYLES.parentRowBg : '';
          container.style.paddingLeft = '14px';
        },
      },
      {
        id: 'end', accessorKey: 'end', header: 'End', width: 110, align: 'left' as const, placeholder: 'MM/YY',
        cellEditor: 'masked' as const, mask: 'MM/YY',
        editable: ((row: HoldingRow) => row.parentId !== null) as unknown as boolean,
        valueFormatter: formatIsoToMMYY,
        valueParser: parseMMYYToIso,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as HoldingRow;
          const isParent = row.parentId === null;
          container.textContent = row.end ? formatMonYY(row.end) : '';
          container.style.fontSize = FSBT_STYLES.infoFontSize;
          container.style.fontWeight = isParent ? FSBT_STYLES.parentFontWeight : FSBT_STYLES.childFontWeight;
          container.style.color = FSBT_STYLES.childText;
          container.style.backgroundColor = isParent ? FSBT_STYLES.parentRowBg : '';
          container.style.paddingLeft = '14px';
        },
      },
      // ── Variance — shown via change cellType (same as Cost) ──
      { id: 'variance', accessorKey: 'variance', header: 'Variance', width: 85, cellType: 'change' as const, align: 'center' as const, editable: false, cellStyle: parentRowCellStyle },
      // ── Variance status icon slot ──
      {
        id: 'varianceStatus', header: '', width: 44, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as HoldingRow;
          container.style.backgroundColor = row.parentId === null ? FSBT_STYLES.parentRowBg : '';
        },
      },
      // ── Collapse chevron — at end of frozen row (matches Cost's layout) ──
      {
        id: 'collapse', header: '', width: 40, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as HoldingRow;
          container.style.backgroundColor = row.parentId === null ? FSBT_STYLES.parentRowBg : '';
        },
      },
      ...holdingTs.columns.map(c => ({
        ...c,
        cellStyle: (v: unknown, row: unknown) => {
          const base = parentRowCellStyle(v, row) ?? {};
          if (typeof v === 'number' && v < 0) return { ...base, color: '#dc2626' };
          return base;
        },
        editable: ((row: HoldingRow) => row.parentId !== null) as unknown as boolean,
      })),
    ],
    [],
  );

  const holdingPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      hierarchy({ toggleColumn: 'collapse', toggleStyle: 'chevron' }),
      cellRenderers(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-holding' }),
    ],
    [],
  );

  const { grid: holdingGrid, containerRef: holdingRef } = useGrid<HoldingRow>({
    data: holdingData,
    columns: holdingColumns,
    // Freeze through the collapse column so the user can scroll monthly data
    // horizontally without losing the category/amount context.
    frozenLeftColumns: 9,
    freezeClip: { minVisible: 2 },
    plugins: holdingPlugins,
    tableStyle: 'striped' as const,
    hierarchy: {
      getRowId: (row: HoldingRow) => row.id,
      getParentId: (row: HoldingRow) => row.parentId,
      defaultExpanded: true,
    },
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // BTS Details Grid Setup (flat, section+total rows)
  // ════════════════════════════════════════════════════════════════════════════

  const btsDetailsColumns = useMemo<ColumnDef<BtsDetailRow>[]>(
    () => [
      // Type column — item rows show product name, section rows show section label
      {
        id: 'type', accessorKey: 'type', header: 'Type', width: 170, align: 'left' as const, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsDetailRow;
          if (row.kind === 'section') {
            container.textContent = row.sectionLabel ?? '';
          } else if (row.kind === 'total') {
            container.textContent = 'Total';
          } else {
            container.textContent = row.type ?? '';
          }
        },
        cellStyle: btsDetailCellStyle,
      },
      { id: 'description', accessorKey: 'description', header: 'Description', width: 150, align: 'left' as const, editable: false, cellStyle: btsDetailCellStyle },
      // Input — percent rate on GST / Commission items only
      {
        id: 'input', accessorKey: 'input', header: 'Input', width: 100, align: 'center' as const,
        editable: ((row: BtsDetailRow) => row.kind === 'item' && row.input !== null) as unknown as boolean,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsDetailRow;
          if (row.kind !== 'item' || row.input == null) { container.textContent = ''; return; }
          container.textContent = row.input.toFixed(2) + ' %';
        },
        cellStyle: btsDetailCellStyle,
      },
      // Amount — formatted currency, blank on section rows
      {
        id: 'amount', accessorKey: 'amount', header: 'Amount', width: 130, align: 'center' as const, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsDetailRow;
          if (row.kind === 'section' || row.amount == null) { container.textContent = ''; return; }
          container.textContent = formatAU(row.amount);
        },
        cellStyle: btsDetailCellStyle,
      },
      // Start / End — Mon YY display, masked MM/YY editor on items
      {
        id: 'start', accessorKey: 'start', header: 'Start', width: 85, align: 'left' as const, placeholder: 'MM/YY',
        cellEditor: 'masked' as const, mask: 'MM/YY',
        editable: ((row: BtsDetailRow) => row.kind === 'item') as unknown as boolean,
        valueFormatter: formatIsoToMMYY,
        valueParser: parseMMYYToIso,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsDetailRow;
          container.textContent = row.start ? formatMonYY(row.start) : '';
        },
        cellStyle: btsDetailCellStyle,
      },
      {
        id: 'end', accessorKey: 'end', header: 'End', width: 85, align: 'left' as const, placeholder: 'MM/YY',
        cellEditor: 'masked' as const, mask: 'MM/YY',
        editable: ((row: BtsDetailRow) => row.kind === 'item') as unknown as boolean,
        valueFormatter: formatIsoToMMYY,
        valueParser: parseMMYYToIso,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsDetailRow;
          container.textContent = row.end ? formatMonYY(row.end) : '';
        },
        cellStyle: btsDetailCellStyle,
      },
      { id: 'variance', accessorKey: 'variance', header: 'Variance', width: 85, cellType: 'change' as const, align: 'center' as const, editable: false, cellStyle: btsDetailCellStyle },
      ...holdingTs.columns.map(c => ({
        ...c,
        editable: false,
        cellStyle: btsDetailCellStyle,
      })),
    ],
    [],
  );

  const btsDetailsPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      cellRenderers(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-bts-details' }),
    ],
    [],
  );

  const { grid: btsDetailsGrid, containerRef: btsDetailsRef } = useGrid<BtsDetailRow>({
    data: btsDetailsData,
    columns: btsDetailsColumns,
    plugins: btsDetailsPlugins,
    frozenLeftColumns: 7,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Holding Rental General Grid Setup
  // ════════════════════════════════════════════════════════════════════════════

  const holdingGeneralTotalsRow = useMemo(() => {
    const n = holdingGeneralData.length;
    const avg = (pick: (r: HoldingGeneralRow) => number) =>
      holdingGeneralData.reduce((s, r) => s + pick(r), 0) / n;
    return {
      id: -1,
      type: 'Total',
      description: '',
      stage: 1,
      nla: holdingGeneralData.reduce((s, r) => s + r.nla, 0),
      unit: holdingGeneralData.reduce((s, r) => s + r.unit, 0),
      grossRent: Math.round(avg(r => r.grossRent)),
      outgoings: Math.round(avg(r => r.outgoings)),
    } as unknown as HoldingGeneralRow;
  }, []);

  const holdingGeneralColumns = useMemo<ColumnDef<HoldingGeneralRow>[]>(
    () => [
      { id: 'type', accessorKey: 'type', header: 'Type', width: 170, align: 'left' as const },
      { id: 'description', accessorKey: 'description', header: 'Description', width: 150, align: 'left' as const, editable: true },
      { id: 'stage', accessorKey: 'stage', header: 'Stage', width: 90, align: 'center' as const },
      { id: 'nla', accessorKey: 'nla', header: 'NLA (m2)', width: 110, align: 'center' as const, valueFormatter: formatInt, editable: true },
      { id: 'unit', accessorKey: 'unit', header: 'Unit', width: 90, align: 'center' as const, valueFormatter: formatInt, editable: true },
      { id: 'grossRent', accessorKey: 'grossRent', header: 'Gross Rent p.a. ($/m2)', width: 190, align: 'center' as const, valueFormatter: formatDollars, editable: true },
      { id: 'outgoings', accessorKey: 'outgoings', header: 'Outgoings p.a. ($/m2)', width: 190, align: 'center' as const, valueFormatter: formatDollars, editable: true },
    ],
    [],
  );

  const holdingGeneralPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      sorting(),
      cellRenderers(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-holding-general' }),
    ],
    [],
  );

  const { grid: holdingGeneralGrid, containerRef: holdingGeneralRef } = useGrid<HoldingGeneralRow>({
    data: holdingGeneralData,
    columns: holdingGeneralColumns,
    plugins: holdingGeneralPlugins,
    pinnedBottomRows: [holdingGeneralTotalsRow],
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    tableStyle: 'striped' as const,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Holding Sale Details Grid Setup (reuses BTS Details column layout)
  // ════════════════════════════════════════════════════════════════════════════

  const holdingSaleColumns = useMemo<ColumnDef<BtsDetailRow>[]>(() => btsDetailsColumns, [btsDetailsColumns]);

  const holdingSalePlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      cellRenderers(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-holding-sale' }),
    ],
    [],
  );

  const { grid: holdingSaleGrid, containerRef: holdingSaleRef } = useGrid<BtsDetailRow>({
    data: holdingSaleData,
    columns: holdingSaleColumns,
    plugins: holdingSalePlugins,
    frozenLeftColumns: 7,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Action Handlers
  // ════════════════════════════════════════════════════════════════════════════

  const handleBtsUndo = useCallback(() => btsGrid.plugins.undoRedo?.undo(), [btsGrid]);
  const handleBtsRedo = useCallback(() => btsGrid.plugins.undoRedo?.redo(), [btsGrid]);
  const handleBtsCsv = useCallback(() => btsGrid.plugins.export?.exportToCsv(), [btsGrid]);
  const handleBtsExcel = useCallback(() => btsGrid.plugins.export?.exportToExcel(), [btsGrid]);

  const handleHoldingExpandAll = useCallback(() => holdingGrid.expandAll(), [holdingGrid]);
  const handleHoldingCollapseAll = useCallback(() => holdingGrid.collapseAll(), [holdingGrid]);
  const handleHoldingUndo = useCallback(() => holdingGrid.plugins.undoRedo?.undo(), [holdingGrid]);
  const handleHoldingRedo = useCallback(() => holdingGrid.plugins.undoRedo?.redo(), [holdingGrid]);
  const handleHoldingCsv = useCallback(() => holdingGrid.plugins.export?.exportToCsv(), [holdingGrid]);
  const handleHoldingExcel = useCallback(() => holdingGrid.plugins.export?.exportToExcel(), [holdingGrid]);

  const handleBtsDetailsCsv = useCallback(() => btsDetailsGrid.plugins.export?.exportToCsv(), [btsDetailsGrid]);
  const handleHoldingGeneralCsv = useCallback(() => holdingGeneralGrid.plugins.export?.exportToCsv(), [holdingGeneralGrid]);
  const handleHoldingSaleCsv = useCallback(() => holdingSaleGrid.plugins.export?.exportToCsv(), [holdingSaleGrid]);

  const btnStyle = { padding: '5px 12px', border: '1px solid #d0d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 } as const;
  const pillStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', border: '1px solid #E4E7EC', borderRadius: 999, background: '#F9FAFB', fontSize: 13, color: '#101828' } as const;

  return (
    <div>
      {/* Program summary — matches Wiseway's feasibility layout where program is shown above each financial tab */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 12px' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Program</h2>
        <span style={pillStyle}>
          <strong style={{ fontWeight: 600 }}>39 Months</strong>
          <span style={{ color: '#667085' }}>(August 2023 – October 2026)</span>
        </span>
      </div>
      <div style={{ marginBottom: 24 }}>
        <FsbtProgramSummary />
      </div>

      {/* Revenue — top-line title + total pill + intro copy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 12px', flexWrap: 'wrap' as const }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Revenue</h2>
        <span style={pillStyle}>
          <span style={{ color: '#667085' }}>Total Gross Revenue</span>
          <strong style={{ fontWeight: 600 }}>${TOTAL_GROSS_REVENUE.toLocaleString('en-AU')}</strong>
        </span>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Revenue analysis for Build-to-Sell and Holding (rental) scenarios. BTS covers sale projections with growth rates and commissions; Holding covers monthly rental income, outgoings, and incentives.
      </p>

      {/* BTS Section */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' as const }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>BTS</h3>
          <span style={pillStyle}>
            <span style={{ color: '#667085' }}>Gross Revenue</span>
            <strong style={{ fontWeight: 600 }}>${TOTAL_GROSS_REVENUE.toLocaleString('en-AU')}</strong>
          </span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button onClick={handleBtsUndo} style={btnStyle}>Undo</button>
            <button onClick={handleBtsRedo} style={btnStyle}>Redo</button>
            <button onClick={handleBtsCsv} style={btnStyle}>CSV</button>
            <button onClick={handleBtsExcel} style={btnStyle}>Excel</button>
          </div>
        </div>
        <div
          ref={btsRef}
          style={{
            height: 280,
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 12,
          }}
        />
      </div>

      {/* BTS Details — multi-section breakdown (Gross / GST / Commission / Net) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, justifyContent: 'flex-end' }}>
          <button onClick={handleBtsDetailsCsv} style={btnStyle}>CSV</button>
        </div>
        <div
          ref={btsDetailsRef}
          style={{ height: 720, width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 12 }}
        />
      </div>

      {/* Holding Asset - Rental (two tables: General + Details) */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' as const }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Holding Asset - Rental</h3>
          <span style={pillStyle}>
            <span style={{ color: '#667085' }}>Gross Rental</span>
            <strong style={{ fontWeight: 600 }}>$8,400,000</strong>
          </span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button onClick={handleHoldingGeneralCsv} style={btnStyle}>General CSV</button>
          </div>
        </div>
        <div
          ref={holdingGeneralRef}
          style={{ height: 260, width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 12, marginBottom: 24 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, justifyContent: 'flex-end' }}>
          <button onClick={handleHoldingExpandAll} style={btnStyle}>Expand All</button>
          <button onClick={handleHoldingCollapseAll} style={btnStyle}>Collapse All</button>
          <button onClick={handleHoldingUndo} style={btnStyle}>Undo</button>
          <button onClick={handleHoldingRedo} style={btnStyle}>Redo</button>
          <button onClick={handleHoldingCsv} style={btnStyle}>CSV</button>
          <button onClick={handleHoldingExcel} style={btnStyle}>Excel</button>
        </div>
        <div
          ref={holdingRef}
          style={{ height: 480, width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 12 }}
        />
      </div>

      {/* Holding Asset - Sale — third section, mirrors Wiseway's empty-state layout */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' as const }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Holding Asset - Sale</h3>
          <span style={pillStyle}>
            <span style={{ color: '#667085' }}>Net Sale Revenue</span>
            <strong style={{ fontWeight: 600 }}>$0</strong>
          </span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button onClick={handleHoldingSaleCsv} style={btnStyle}>CSV</button>
          </div>
        </div>
        <div
          ref={holdingSaleRef}
          style={{ height: 320, width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 12 }}
        />
      </div>
    </div>
  );
}
