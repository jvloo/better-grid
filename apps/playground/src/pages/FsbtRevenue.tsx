import { useMemo, useCallback, useState, type CSSProperties } from 'react';
import { useGrid, BetterGrid } from '@better-grid/react';
import type { CellChange, ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, editing, sorting, hierarchy, validation, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import type { ExportApi } from '@better-grid/plugins';
import '@better-grid/core/styles.css';
import { FsbtProgramSummary } from './_FsbtProgramSummary';
import { FSBT_STYLES, parentRowCellStyle, parentRowStyle } from './_fsbt-cell-styles';
import {
  IconButton,
  ExpandAllIcon,
  CollapseAllIcon,
  ExportIcon,
} from './_toolbar-icons';

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

// Monthly-cell formatter: blanks out zeros (the production reference convention — empty cells
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

// Data from QA app project 4288: the production reference app
// Total Gross Revenue: $224,739,528
//
// growthRate encodes escalation using the same convention as the production reference's
// `RevenueBTSEscalationCPI | number` union: string 'cpi' / 'non-cpi' for the
// two preset options, or a number for the "Custom" percent option.
const btsData: BtsRow[] = [
  { id: 1, type: 'Residential - BTS', stage: 1, nsa: 19500, units: 160, salePrice: 8803, growthRate: 6.0, launchDate: '2026-10-01', projectedPrice: 9331, grossRevenue: 181958010, gst: 9.09, commUpfront: 1.5, commBackend: 1.5 },
  { id: 2, type: 'Retail - BTS', stage: 1, nsa: 2600, units: 30, salePrice: 15898, growthRate: 3.5, launchDate: '2026-10-01', projectedPrice: 16454, grossRevenue: 42781518, gst: 9.09, commUpfront: 1.75, commBackend: 0.25 },
  { id: 3, type: 'Land - BTS', stage: 0, nsa: 0, units: 0, salePrice: 1960, growthRate: 'cpi', launchDate: '', projectedPrice: 1960, grossRevenue: 0, gst: 9.09, commUpfront: 0, commBackend: 0 },
];

// Growth Rate select options — three fixed choices per the production reference spec.
const GROWTH_RATE_OPTIONS: Array<{ value: 'cpi' | 'non-cpi' | 'custom'; label: string }> = [
  { value: 'non-cpi', label: 'Non CPI' },
  { value: 'cpi',     label: 'CPI' },
  { value: 'custom',  label: 'Custom' },
];

function growthRateSelectValue(v: number | string): 'cpi' | 'non-cpi' | 'custom' {
  if (v === 'cpi' || v === 'non-cpi') return v;
  return 'custom';
}

const TOTAL_GROSS_REVENUE = btsData.reduce((s, r) => s + r.grossRevenue, 0); // $224,739,528

// ============================================================================
// Grid B: BTS Details Table — Gross Revenue / GST / Sales Commission / Net
// Each section has 3 product rows + a Total row. Columns scroll across the
// 39-month window; values are concentrated in the sale month (Oct 2026).
// ============================================================================

// Row shape uses a `kind` discriminator matching the production reference's source, which
// models sections as { type: 'title' | 'item' | 'accumulation' } — there's
// no parent/child collapsing, just visual grouping, so hierarchy would be
// overkill. Flat array + cellStyle based on `kind` keeps it simple.
type BtsDetailKind = 'section' | 'item' | 'total';

// Section name maps to the production reference's RevenueBTSItemKeys: 'gross' | 'gst' |
// 'commission' | 'net'. The edit matrix depends on this field — per
// the production reference, Gross/GST/Commission allow editing both Input and Monthly cells,
// while Net allows only Monthly edits.
type BtsSectionName = 'gross' | 'gst' | 'commission' | 'net' | 'sale-commission' | 'remaining-incentive' | 'net-sale';

interface BtsDetailRow {
  id: number;
  kind: BtsDetailKind;
  sectionName?: BtsSectionName; // carried on item+total rows so edit rules apply
  sectionLabel?: string;     // 'Gross Revenue', 'GST', etc. (section rows only)
  type?: string;             // 'Residential - BTS' on items, '' on sections
  description?: string;      // 'Apt', 'West G Floor', 'Park' on items
  input?: number | null;     // percent rate (9.09, 1.50) or null
  amount?: number;
  start?: string;
  end?: string;
  variance?: number;
  m_2026_10?: number;        // sale month — only month populated in the production reference
  [key: string]: string | number | null | undefined;
}

// Numbers sourced from QA app project 4288 (Oct 26 launch). Residential Apt
// and Retail West G Floor carry all the revenue; Land Park is priced-in but
// unsold, so every section has it at $0.
const btsDetailsData: BtsDetailRow[] = [
  // ── Gross Revenue ──
  { id: 101, kind: 'section', sectionName: 'gross',      sectionLabel: 'Gross Revenue' },
  { id: 102, kind: 'item',    sectionName: 'gross',      type: 'Residential - BTS', description: 'Apt',           input: null, amount: 181958010, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 181958010 },
  { id: 103, kind: 'item',    sectionName: 'gross',      type: 'Retail - BTS',       description: 'West G Floor', input: null, amount: 42781518,  start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 42781518 },
  { id: 104, kind: 'item',    sectionName: 'gross',      type: 'Land - BTS',         description: 'Park',         input: null, amount: 0,         start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 0 },
  { id: 105, kind: 'total',   sectionName: 'gross',      amount: 224739528, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 224739528 },

  // ── GST (9.09% ≈ 1/11 — Australian GST) ──
  { id: 201, kind: 'section', sectionName: 'gst',        sectionLabel: 'GST' },
  { id: 202, kind: 'item',    sectionName: 'gst',        type: 'Residential - BTS', description: 'Apt',           input: 9.09, amount: 16540099,  start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 16540099 },
  { id: 203, kind: 'item',    sectionName: 'gst',        type: 'Retail - BTS',       description: 'West G Floor', input: 9.09, amount: 3888810,   start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 3888810 },
  { id: 204, kind: 'item',    sectionName: 'gst',        type: 'Land - BTS',         description: 'Park',         input: 9.09, amount: 0,         start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 0 },
  { id: 205, kind: 'total',   sectionName: 'gst',        amount: 20428909, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 20428909 },

  // ── Sales Commission - Back End (from General: Res 1.5%, Retail 0.25%) ──
  { id: 301, kind: 'section', sectionName: 'commission', sectionLabel: 'Sales Commission - Back End' },
  { id: 302, kind: 'item',    sectionName: 'commission', type: 'Residential - BTS', description: 'Apt',           input: 1.50, amount: 2550893,   start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 2550893 },
  { id: 303, kind: 'item',    sectionName: 'commission', type: 'Retail - BTS',       description: 'West G Floor', input: 0.25, amount: 63911,     start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 63911 },
  { id: 304, kind: 'item',    sectionName: 'commission', type: 'Land - BTS',         description: 'Park',         input: 0.00, amount: 0,         start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 0 },
  { id: 305, kind: 'total',   sectionName: 'commission', amount: 2614804, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 2614804 },

  // ── Net Revenue (= Gross − GST − Commission − other incentive deductions) ──
  { id: 401, kind: 'section', sectionName: 'net',        sectionLabel: 'Net Revenue' },
  { id: 402, kind: 'item',    sectionName: 'net',        type: 'Residential - BTS', description: 'Apt',           input: null, amount: 152050199, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 152050199 },
  { id: 403, kind: 'item',    sectionName: 'net',        type: 'Retail - BTS',       description: 'West G Floor', input: null, amount: 23176776,  start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 23176776 },
  { id: 404, kind: 'item',    sectionName: 'net',        type: 'Land - BTS',         description: 'Park',         input: null, amount: 0,         start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 0 },
  { id: 405, kind: 'total',   sectionName: 'net',        amount: 175226975, start: '2026-10-01', end: '2026-10-01', variance: 0, m_2026_10: 175226975 },
];

// Edit matrix from the production reference's bts-details-table.tsx:EDITABLE_FIELD —
// Gross/GST/Commission allow Input + Monthly edits; Net allows only Monthly.
const BTS_DETAILS_INPUT_EDITABLE = new Set<BtsSectionName>(['gross', 'gst', 'commission']);
const BTS_DETAILS_MONTHLY_EDITABLE = new Set<BtsSectionName>(['gross', 'gst', 'commission', 'net']);

// Section/total row styling — the production reference shades sections with a grey rule and
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

// Row-strip style for BTS Details / Holding Sale. Section rows paint a
// full-width grey band so the monthly area doesn't break the grey visually.
function btsDetailRowStyle(row: BtsDetailRow): Record<string, string> | undefined {
  if (row.kind === 'section') return { background: SECTION_BG };
  return undefined;
}

// ============================================================================
// Grid C: Holding Rental General Table — NLA / rental rates rollup
// the production reference's "HoldingGeneralTable" — summary of the rentable stock before
// the monthly cashflow details. Since project 4288 has no holding stock
// configured, we mock plausible data using the same residential/retail/etc
// breakdown that appears in the Holding Rental Details table below.
// ============================================================================

// Shape mirrors the production reference's RevenueHoldingGeneralItem exactly — 30 fields
// across 4 logical groups (basic / development-costs / on-completion / exit).
interface HoldingGeneralRow {
  id: number;
  // Basic (read-only metadata + editable rate inputs)
  type: string;
  description: string;
  stage: number | null;
  nla: number;
  unit: number;
  grossRent: number;             // $/m² per annum — editable
  outgoings: number;             // $/m² per annum — editable
  netRent: number;               // = grossRent − outgoings (computed)
  annualNetRent: number;         // = netRent × nla (computed)
  preCommit: string;             // month string e.g. 'Jan 26' — editable
  leaseTerm: number;             // months — editable
  leaseStart: string;            // ISO — editable
  leaseEnd: string;              // ISO — computed from start + term
  rentReview: number;            // % — editable
  reviewFrequency: number;       // years — editable
  // Development Costs group (8)
  lettingFee: number;            // % — editable
  payableCommitment: number;     // % — editable
  totalLettingFee: number;       // computed
  incentives: number;            // % — editable
  incentivesPaidUpfront: number; // % — editable
  // Remaining Incentives: toggle between "rent-free" and "discount" — matches
  // the production reference's holding-general-table-row.tsx:57-68 (remainingIncentiveOptions).
  // Controls how Discount Months is applied downstream.
  remainingIncentives: 'rent-free' | 'discount';
  discountMonths: number;        // months — editable
  totalIncentives: number;       // computed
  // On Completion group (2)
  completionCapRate: number;     // % — editable
  completionCapValue: number;    // computed
  // Exit group (5)
  exitCapRate: number;           // % — editable
  exitCapValue: number;          // computed
  exitGST: number;               // % — editable
  exitCommission: number;        // % — editable
  settlementDate: string;        // ISO — editable
}

// Plausible mock — project 4288 has no holding stock, so these are illustrative
// values sized in line with the Holding Rental Details table (which does have data).
const holdingGeneralData: HoldingGeneralRow[] = [
  {
    id: 1, type: 'Residential', description: 'Apt',          stage: 1, nla: 6600, unit: 60,
    grossRent: 520, outgoings: 80, netRent: 440, annualNetRent: 2904000,
    preCommit: '2026-01-01', leaseTerm: 24, leaseStart: '2026-01-01', leaseEnd: '2028-01-01',
    rentReview: 3.5, reviewFrequency: 1,
    lettingFee: 2.0, payableCommitment: 100, totalLettingFee: 58080,
    incentives: 5.0, incentivesPaidUpfront: 100, remainingIncentives: 'discount' as const,
    discountMonths: 0, totalIncentives: 145200,
    completionCapRate: 5.25, completionCapValue: 55314286,
    exitCapRate: 5.50, exitCapValue: 52800000, exitGST: 9.09, exitCommission: 1.5, settlementDate: '2028-06-30',
  },
  {
    id: 2, type: 'Commercial', description: 'Level 1-3',     stage: 1, nla: 3200, unit: 12,
    grossRent: 650, outgoings: 95, netRent: 555, annualNetRent: 1776000,
    preCommit: '2026-01-01', leaseTerm: 60, leaseStart: '2026-01-01', leaseEnd: '2031-01-01',
    rentReview: 3.0, reviewFrequency: 1,
    lettingFee: 3.0, payableCommitment: 100, totalLettingFee: 62400,
    incentives: 10.0, incentivesPaidUpfront: 50, remainingIncentives: 'discount' as const,
    discountMonths: 3, totalIncentives: 208000,
    completionCapRate: 6.00, completionCapValue: 29600000,
    exitCapRate: 6.25, exitCapValue: 28416000, exitGST: 9.09, exitCommission: 1.5, settlementDate: '2028-06-30',
  },
  {
    id: 3, type: 'Retail', description: 'West G Floor',      stage: 1, nla: 1500, unit: 8,
    grossRent: 850, outgoings: 120, netRent: 730, annualNetRent: 1095000,
    preCommit: '2026-01-01', leaseTerm: 60, leaseStart: '2026-01-01', leaseEnd: '2031-01-01',
    rentReview: 3.0, reviewFrequency: 1,
    lettingFee: 3.0, payableCommitment: 100, totalLettingFee: 38250,
    incentives: 15.0, incentivesPaidUpfront: 50, remainingIncentives: 'rent-free' as const,
    discountMonths: 6, totalIncentives: 164250,
    completionCapRate: 5.75, completionCapValue: 19043478,
    exitCapRate: 6.00, exitCapValue: 18250000, exitGST: 9.09, exitCommission: 1.5, settlementDate: '2028-06-30',
  },
  {
    id: 4, type: 'Parking', description: 'Basement',         stage: 0, nla: 3124, unit: 40,
    grossRent: 250, outgoings: 40, netRent: 210, annualNetRent: 656040,
    preCommit: '2026-01-01', leaseTerm: 12, leaseStart: '2026-01-01', leaseEnd: '2027-01-01',
    rentReview: 3.0, reviewFrequency: 1,
    lettingFee: 1.0, payableCommitment: 100, totalLettingFee: 6560,
    incentives: 0, incentivesPaidUpfront: 100, remainingIncentives: 'discount' as const,
    discountMonths: 0, totalIncentives: 0,
    completionCapRate: 7.00, completionCapValue: 9372000,
    exitCapRate: 7.25, exitCapValue: 9048000, exitGST: 9.09, exitCommission: 1.5, settlementDate: '2028-06-30',
  },
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
  // Gross Rental Income (matches the production reference holding-general-table section label)
  { id: 1, parentId: null, type: 'Gross Rental Income', description: '', input: 0, amount: 8400000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 2, parentId: 1, type: '', description: 'Residential', input: 520, amount: 4264000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 710667, m_2026_02: 710667, m_2026_03: 710667, m_2026_04: 710667, m_2026_05: 710667, m_2026_06: 710665 },
  { id: 3, parentId: 1, type: '', description: 'Commercial', input: 650, amount: 2080000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 346667, m_2026_02: 346667, m_2026_03: 346667, m_2026_04: 346667, m_2026_05: 346667, m_2026_06: 346665 },
  { id: 4, parentId: 1, type: '', description: 'Retail', input: 850, amount: 1275000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 212500, m_2026_02: 212500, m_2026_03: 212500, m_2026_04: 212500, m_2026_05: 212500, m_2026_06: 212500 },
  { id: 5, parentId: 1, type: '', description: 'Parking', input: 250, amount: 781000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: 130167, m_2026_02: 130167, m_2026_03: 130167, m_2026_04: 130167, m_2026_05: 130167, m_2026_06: 130165 },

  // Outgoings (matches the production reference exactly — no "Less:" prefix)
  { id: 6, parentId: null, type: 'Outgoings', description: '', input: 0, amount: -1260000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 7, parentId: 6, type: '', description: 'Property Management', input: 0, amount: -504000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -84000, m_2026_02: -84000, m_2026_03: -84000, m_2026_04: -84000, m_2026_05: -84000, m_2026_06: -84000 },
  { id: 8, parentId: 6, type: '', description: 'Maintenance & Repairs', input: 0, amount: -378000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -63000, m_2026_02: -63000, m_2026_03: -63000, m_2026_04: -63000, m_2026_05: -63000, m_2026_06: -63000 },
  { id: 9, parentId: 6, type: '', description: 'Insurance & Rates', input: 0, amount: -378000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -63000, m_2026_02: -63000, m_2026_03: -63000, m_2026_04: -63000, m_2026_05: -63000, m_2026_06: -63000 },

  // Incentive (singular, matches the production reference exactly — no "Less:" prefix)
  { id: 10, parentId: null, type: 'Incentive', description: '', input: 0, amount: -420000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
  { id: 11, parentId: 10, type: '', description: 'Leasing Incentive (5%)', input: 5, amount: -420000, start: '2026-01-01', end: '2028-06-30', variance: 0, m_2026_01: -70000, m_2026_02: -70000, m_2026_03: -70000, m_2026_04: -70000, m_2026_05: -70000, m_2026_06: -70000 },

  // Net (rollup)
  { id: 12, parentId: null, type: 'Net Rental Revenue', description: '', input: 0, amount: 6720000, start: '2026-01-01', end: '2028-06-30', variance: 0 },
];

// ============================================================================
// Grid E: Holding Sale Details — Sale Commission / Remaining Incentive / Net
// Same flat-with-kind shape as BTS Details. In project 4288 the holding-sale
// pool is empty, so values are $0 — we include the structure so the demo
// shows the three-section layout the production reference users expect on this tab.
// ============================================================================

const holdingSaleData: BtsDetailRow[] = [
  { id: 501, kind: 'section', sectionName: 'sale-commission',      sectionLabel: 'Sale Commission' },
  { id: 502, kind: 'total',   sectionName: 'sale-commission',      amount: 0, start: '2028-06-30', end: '2028-06-30', variance: 0 },
  { id: 503, kind: 'section', sectionName: 'remaining-incentive',  sectionLabel: 'Remaining Incentive (PV)' },
  { id: 504, kind: 'total',   sectionName: 'remaining-incentive',  amount: 0, start: '2028-06-30', end: '2028-06-30', variance: 0 },
  { id: 505, kind: 'section', sectionName: 'net-sale',             sectionLabel: 'Net Sale Revenue' },
  { id: 506, kind: 'total',   sectionName: 'net-sale',             amount: 0, start: '2028-06-30', end: '2028-06-30', variance: 0 },
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

  const [btsRows, setBtsRows] = useState<BtsRow[]>(() => btsData);

  const formatInt = (v: unknown): string => (typeof v === 'number' ? v.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : '');
  const formatDollars = (v: unknown): string => (typeof v === 'number' ? '$' + v.toLocaleString('en-AU', { maximumFractionDigits: 0 }) : '');
  const formatRate = (v: unknown): string => {
    if (typeof v === 'number') return v.toFixed(2) + '%';
    if (v === 'cpi') return 'CPI';
    if (v === 'non-cpi') return 'Non-CPI';
    return '';
  };

  const btsColumns = useMemo<ColumnDef<BtsRow>[]>(
    () => [
      // Type/Stage/NSA/Unit — read-only metadata (sourced from Project Brief)
      { id: 'type', field: 'type', headerName: 'Type', width: 170, align: 'left' as const, sortable: true, editable: false },
      { id: 'stage', field: 'stage', headerName: 'Stage', width: 105, align: 'center' as const, editable: false },
      { id: 'nsa', field: 'nsa', headerName: 'NSA (m2)', width: 105, align: 'center' as const, valueFormatter: formatInt, editable: false },
      { id: 'units', field: 'units', headerName: 'Unit/Lot/Tenancy', width: 105, align: 'center' as const, valueFormatter: formatInt, editable: false },
      // the production reference shows plain numbers here (no $ prefix) — the column header
      //    already says "$/m²" so the unit is implied.
      { id: 'salePrice', field: 'salePrice', headerName: 'Current Sale Price ($/m2)', width: 190, align: 'center' as const, editable: true, valueFormatter: formatInt },
      // Growth Rate — native Better Grid compound select. Custom reveals a
      // sibling percent input and stores the numeric percentage directly.
      //    Width: 190 matches the production reference BtsGeneralTable header minWidth.
      {
        id: 'growthRate', field: 'growthRate', headerName: 'Growth Rate',
        width: 190, align: 'center' as const,
        editable: ((row: BtsRow) => row.id !== -1) as unknown as boolean,
        cellEditor: 'selectWithInput' as const,
        options: GROWTH_RATE_OPTIONS,
        selectInput: { optionValue: 'custom', type: 'number', unit: '%', precision: 2, width: 60, defaultValue: 0, min: 0 },
        selectValue: (value) => growthRateSelectValue(value as number | string),
        selectInputValue: (value) => (typeof value === 'number' ? value : 0),
        parseSelectWithInputValue: ({ optionValue, inputValue }) =>
          optionValue === 'custom' ? Number(inputValue) : optionValue,
        valueFormatter: formatRate,
      },
      {
        id: 'launchDate', field: 'launchDate', headerName: 'Sales Launch Date', width: 190, align: 'center' as const,
        // Pinned Total row (id === -1) is display-only — otherwise the
        // inputStyle wrap renders the "MM/YY" placeholder over a null value.
        editable: ((row: BtsRow) => row.id !== -1) as unknown as boolean,
        placeholder: 'MM/YY',
        cellEditor: 'masked' as const, mask: 'MM/YY',
        valueFormatter: formatIsoToMMYY,
        valueParser: parseMMYYToIso,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsRow;
          container.textContent = row.launchDate ? formatMonYY(row.launchDate) : '';
        },
      },
      // Projected Sale Price — computed from Current × growth; read-only
      {
        id: 'projectedPrice',
        field: 'projectedPrice',
        headerName: 'Projected Sale Price ($/m2)',
        width: 190,
        align: 'center' as const,
        editable: false,
        valueFormatter: formatInt,
        cellStyle: () => ({ background: '#f5f5f5' }),
      },
      // Gross Revenue — computed from Projected × NSA; read-only. Plain number
      //    (no $ prefix) matching the production reference; width: 105 matches the production reference source.
      {
        id: 'grossRevenue',
        field: 'grossRevenue',
        headerName: 'Gross Revenue',
        width: 105,
        align: 'center' as const,
        editable: false,
        valueFormatter: formatInt,
      },
      // Percent columns use '%' unit adornment (shows on both body input-box
      //    and the pinned Total row via the same valueFormatter path).
      { id: 'gst',         field: 'gst',         headerName: 'GST (%)',                      width: 120, align: 'center' as const, editable: true, unit: '%', valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) : '') },
      { id: 'commUpfront', field: 'commUpfront', headerName: 'Sales Commission - Upfront (%)', width: 230, align: 'center' as const, editable: true, unit: '%', valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) : '') },
      { id: 'commBackend', field: 'commBackend', headerName: 'Sales Commission - Back End (%)', width: 230, align: 'center' as const, editable: true, unit: '%', valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) : '') },
    ],
    [],
  );

  // Totals row — the production reference's QA app computes a simple (unweighted) arithmetic
  // mean across product rows for per-unit columns. E.g. Sale Price total is
  // (8,803 + 15,898 + 1,960) / 3 = 8,887 — matches the live app exactly.
  // Sum columns (NSA, Units, Gross Revenue) are additive as you'd expect.
  const btsTotalsRow = useMemo(() => {
    const n = btsRows.length;
    const avg = (pick: (r: BtsRow) => number) =>
      btsRows.reduce((s, r) => s + pick(r), 0) / n;
    return {
      id: -1,
      type: 'Total',
      stage: 1, // the production reference shows the project stage (not a sum)
      nsa: btsRows.reduce((s, r) => s + r.nsa, 0),
      units: btsRows.reduce((s, r) => s + r.units, 0),
      salePrice: Math.round(avg(r => r.salePrice)),
      growthRate: null, // mix of number and 'CPI' — not averageable
      launchDate: null,
      projectedPrice: Math.round(avg(r => r.projectedPrice)),
      grossRevenue: btsRows.reduce((s, r) => s + r.grossRevenue, 0),
      gst: avg(r => r.gst),
      commUpfront: avg(r => r.commUpfront),
      commBackend: avg(r => r.commBackend),
    } as unknown as BtsRow;
  }, [btsRows]);

  const handleBtsDataChange = useCallback((changes: CellChange<BtsRow>[]) => {
    setBtsRows(prevRows => {
      const byId = new Map(changes.map(change => [change.row.id, change.row]));
      let changed = false;
      const nextRows = prevRows.map(row => {
        const updated = byId.get(row.id);
        if (!updated) return row;
        changed = true;
        return { ...row, ...updated };
      });
      return changed ? nextRows : prevRows;
    });
  }, []);

  const btsPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      sorting(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-bts' }),
    ],
    [],
  );

  // mode: null + plugins escape hatch — keeps the explicit plugin list while
  // we wire up the new grouped layout options (frozen, pinned, headers).
  const btsGrid = useGrid<BtsRow>({
    data: btsRows,
    columns: btsColumns,
    mode: null,
    plugins: btsPlugins,
    pinned: { bottom: [btsTotalsRow] },
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    striped: true,
    rowStyle: parentRowStyle,
    onCellChange: handleBtsDataChange,
  });
  // ════════════════════════════════════════════════════════════════════════════
  // Holding Revenue Grid Setup
  // ════════════════════════════════════════════════════════════════════════════

  const holdingColumns = useMemo<ColumnDef<HoldingRow>[]>(
    () => [
      // ── Type — left column, shows parent labels; width 200 matches
      //    the production reference holding-rental-details-table defaultColumns.
      { id: 'type', field: 'type', headerName: 'Type', width: 200, align: 'left' as const, cellStyle: parentRowCellStyle },
      // ── Description — 80 matches the production reference; longer labels truncate per
      //    native CSS (same behaviour as the live app).
      { id: 'description', field: 'description', headerName: 'Description', width: 80, align: 'left' as const, cellStyle: parentRowCellStyle },
      // ── Input — per-m2 rate on children, blank on parents. READ-ONLY per
      //    the production reference: the Input value is sourced from the Holding General table
      //    above and never edited in the Details table. Only monthly cells
      //    are editable here (see holdingTs.columns below).
      {
        id: 'input', field: 'input', headerName: 'Input', width: 100, align: 'center' as const,
        cellType: 'currency' as const, precision: 0, hideZero: true, editable: false,
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
      //    no renderer/valueFormatter is set, so we format by hand here.
      //    Width 100 matches the production reference.
      {
        id: 'amount',
        field: 'amount',
        headerName: 'Amount',
        width: 100,
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
      // ── Start / End — masked MM/YY editor, Mon-YY display, width 80
      //    matches the production reference holding-rental-details-table.
      {
        id: 'start', field: 'start', headerName: 'Start', width: 80, align: 'left' as const, placeholder: 'MM/YY',
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
        id: 'end', field: 'end', headerName: 'End', width: 80, align: 'left' as const, placeholder: 'MM/YY',
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
      // ── Variance — shown via change cellType. Width 80 matches the production reference.
      { id: 'variance', field: 'variance', headerName: 'Variance', width: 80, cellType: 'change' as const, align: 'center' as const, editable: false, cellStyle: parentRowCellStyle },
      // ── Variance status icon slot ──
      {
        id: 'varianceStatus', headerName: '', width: 44, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as HoldingRow;
          container.style.backgroundColor = row.parentId === null ? FSBT_STYLES.parentRowBg : '';
        },
      },
      // ── Collapse chevron — at end of frozen row (matches Cost's layout) ──
      {
        id: 'collapse', headerName: '', width: 40, editable: false,
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
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-holding' }),
    ],
    [],
  );

  const holdingGrid = useGrid<HoldingRow>({
    data: holdingData,
    columns: holdingColumns,
    mode: null,
    // Freeze through the collapse column so the user can scroll monthly data
    // horizontally without losing the category/amount context.
    frozen: { left: 9, clip: { minVisible: 2 } },
    plugins: holdingPlugins,
    striped: true,
    hierarchy: {
      getRowId: (row: HoldingRow) => row.id,
      getParentId: (row: HoldingRow) => row.parentId,
      defaultExpanded: true,
    },
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    rowStyle: parentRowStyle,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // BTS Details Grid Setup (flat, section+total rows)
  // ════════════════════════════════════════════════════════════════════════════

  const btsDetailsColumns = useMemo<ColumnDef<BtsDetailRow>[]>(
    () => [
      // Type column — item rows show product name, section rows show section
      //    label. Width 200 matches the production reference bts-details-table defaultColumns.
      {
        id: 'type', field: 'type', headerName: 'Type', width: 200, align: 'left' as const, editable: false,
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
      // Description — 80px matches the production reference; labels like "West G Floor"
      //    truncate to "West G Flo…" per native CSS text-overflow.
      { id: 'description', field: 'description', headerName: 'Description', width: 80, align: 'left' as const, editable: false, cellStyle: btsDetailCellStyle },
      // Input — editable on Gross (flat $) / GST+Commission (percent);
      //    read-only on Net per the production reference's EDITABLE_FIELD matrix.
      {
        id: 'input', field: 'input', headerName: 'Input', width: 100, align: 'center' as const,
        editable: ((row: BtsDetailRow) =>
          row.kind === 'item' && !!row.sectionName && BTS_DETAILS_INPUT_EDITABLE.has(row.sectionName)
        ) as unknown as boolean,
        // Percent unit badge for GST/Commission rows (the production reference shows "1.50 %")
        unit: ((row: BtsDetailRow) =>
          row.sectionName === 'gst' || row.sectionName === 'commission' ? '%' : undefined
        ) as unknown as string,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsDetailRow;
          if (row.kind !== 'item' || row.input == null) { container.textContent = ''; return; }
          // GST/Commission display percent; Gross would display flat $ (blank here — the production reference default)
          const suffix = (row.sectionName === 'gst' || row.sectionName === 'commission') ? '' : '';
          container.textContent = row.input.toFixed(2) + suffix;
        },
        cellStyle: btsDetailCellStyle,
      },
      // Amount — formatted currency, blank on section rows. Width 100
      //    matches the production reference.
      {
        id: 'amount', field: 'amount', headerName: 'Amount', width: 100, align: 'center' as const, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as BtsDetailRow;
          if (row.kind === 'section' || row.amount == null) { container.textContent = ''; return; }
          container.textContent = formatAU(row.amount);
        },
        cellStyle: btsDetailCellStyle,
      },
      // Start / End — Mon YY display, masked MM/YY editor on items
      {
        id: 'start', field: 'start', headerName: 'Start', width: 80, align: 'left' as const, placeholder: 'MM/YY',
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
        id: 'end', field: 'end', headerName: 'End', width: 80, align: 'left' as const, placeholder: 'MM/YY',
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
      { id: 'variance', field: 'variance', headerName: 'Variance', width: 80, cellType: 'change' as const, align: 'center' as const, editable: false, cellStyle: btsDetailCellStyle },
      // Variance status icon slot — 44px column at position 8 matches the production
      // reference's revenue-details-table-cell-variance-status renderer; shown on item
      // rows only (sections + totals leave the slot blank).
      {
        id: 'varianceStatus', headerName: '', width: 44, editable: false,
        cellRenderer: (container) => {
          // Icon-only slot — variance icon is rendered downstream via the change/badge
          // cellType once a non-zero variance is present. For now we leave the slot
          // empty (mirrors the production reference's $0-variance state on every row).
          container.textContent = '';
        },
        cellStyle: btsDetailCellStyle,
      },
      // Monthly — editable on every section per the production reference (users can override
      // the auto-computed per-month distribution).
      ...holdingTs.columns.map(c => ({
        ...c,
        editable: ((row: BtsDetailRow) =>
          row.kind === 'item' && !!row.sectionName && BTS_DETAILS_MONTHLY_EDITABLE.has(row.sectionName)
        ) as unknown as boolean,
        cellStyle: btsDetailCellStyle,
      })),
    ],
    [],
  );

  const btsDetailsPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-bts-details' }),
    ],
    [],
  );

  const btsDetailsGrid = useGrid<BtsDetailRow>({
    data: btsDetailsData,
    columns: btsDetailsColumns,
    mode: null,
    plugins: btsDetailsPlugins,
    frozen: { left: 8, clip: { minVisible: 2 } },
    striped: true,
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    rowStyle: btsDetailRowStyle,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Holding Rental General Grid Setup
  // ════════════════════════════════════════════════════════════════════════════

  // Sum fields that are additive across rows; average per-m² rates.
  const holdingGeneralTotalsRow = useMemo(() => {
    const sum = (pick: (r: HoldingGeneralRow) => number) =>
      holdingGeneralData.reduce((s, r) => s + pick(r), 0);
    return {
      id: -1,
      type: 'Total',
      description: '',
      stage: 1,
      nla: sum(r => r.nla),
      unit: sum(r => r.unit),
      // per-m² rates: totals shown blank; the production reference Footer leaves them empty
      grossRent: null,
      outgoings: null,
      netRent: null,
      annualNetRent: sum(r => r.annualNetRent),
      preCommit: '', leaseTerm: null, leaseStart: '', leaseEnd: '',
      rentReview: null, reviewFrequency: null,
      lettingFee: null, payableCommitment: null, totalLettingFee: sum(r => r.totalLettingFee),
      // Remaining Incentives is a per-row toggle (rent-free / discount), not a
      // summable number — totals row leaves it blank, matching the production reference.
      incentives: null, incentivesPaidUpfront: null, remainingIncentives: null,
      discountMonths: null, totalIncentives: sum(r => r.totalIncentives),
      completionCapRate: null, completionCapValue: sum(r => r.completionCapValue),
      exitCapRate: null, exitCapValue: sum(r => r.exitCapValue),
      exitGST: null, exitCommission: null, settlementDate: '',
    } as unknown as HoldingGeneralRow;
  }, []);

  // Shared formatter factories (kept inline so the 30-column array stays readable).
  const pct = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) + '%' : '');
  const dateMonYY = (v: unknown) => (typeof v === 'string' && v ? formatMonYY(v) : '');
  const computedCellStyle = () => ({ background: '#f5f5f5' });

  const holdingGeneralColumns = useMemo<ColumnDef<HoldingGeneralRow>[]>(
    () => [
      // ── Basic (15) — read-only metadata + editable rate inputs ──
      { id: 'type',               field: 'type',               headerName: 'Type',                    width: 130, align: 'left' as const,   editable: false },
      { id: 'description',        field: 'description',        headerName: 'Description',             width: 140, align: 'left' as const,   editable: false },
      { id: 'stage',              field: 'stage',              headerName: 'Stage',                   width: 80,  align: 'center' as const, editable: false },
      { id: 'nla',                field: 'nla',                headerName: 'NLA (m²)',                width: 100, align: 'center' as const, editable: false, valueFormatter: formatInt },
      { id: 'unit',               field: 'unit',               headerName: 'Unit',                    width: 70,  align: 'center' as const, editable: false, valueFormatter: formatInt },
      { id: 'grossRent',          field: 'grossRent',          headerName: 'Gross Rent p.a. ($/m²)',  width: 130, align: 'center' as const, editable: true,  prefix: '$', valueFormatter: formatDollars },
      { id: 'outgoings',          field: 'outgoings',          headerName: 'Outgoings p.a. ($/m²)',   width: 130, align: 'center' as const, editable: true,  prefix: '$', valueFormatter: formatDollars },
      { id: 'netRent',            field: 'netRent',            headerName: 'Net Rent p.a. ($/m²)',    width: 130, align: 'center' as const, editable: false, valueFormatter: formatDollars, cellStyle: computedCellStyle },
      { id: 'annualNetRent',      field: 'annualNetRent',      headerName: 'Annual Net Rent',         width: 140, align: 'center' as const, editable: false, valueFormatter: formatDollars, cellStyle: computedCellStyle },
      { id: 'preCommit',          field: 'preCommit',          headerName: 'Pre-commit Month',        width: 110, align: 'center' as const, editable: true,  valueFormatter: dateMonYY },
      { id: 'leaseTerm',          field: 'leaseTerm',          headerName: 'Lease Term (months)',     width: 110, align: 'center' as const, editable: true },
      { id: 'leaseStart',         field: 'leaseStart',         headerName: 'Lease Start Date',        width: 110, align: 'center' as const, editable: true,  valueFormatter: dateMonYY },
      { id: 'leaseEnd',           field: 'leaseEnd',           headerName: 'Lease End Date',          width: 110, align: 'center' as const, editable: false, valueFormatter: dateMonYY, cellStyle: computedCellStyle },
      { id: 'rentReview',         field: 'rentReview',         headerName: 'Rent Review (%)',         width: 110, align: 'center' as const, editable: true,  unit: '%', valueFormatter: pct },
      { id: 'reviewFrequency',    field: 'reviewFrequency',    headerName: 'Review Frequency (year)', width: 100, align: 'center' as const, editable: true },
      // ── Development Costs group (8) ──
      { id: 'lettingFee',         field: 'lettingFee',         headerName: 'Letting Fee (%)',         width: 110, align: 'center' as const, editable: true,  unit: '%', valueFormatter: pct },
      { id: 'payableCommitment',  field: 'payableCommitment',  headerName: '% Payable Commitment',    width: 130, align: 'center' as const, editable: true,  unit: '%', valueFormatter: pct },
      { id: 'totalLettingFee',    field: 'totalLettingFee',    headerName: 'Total Letting Fee',       width: 140, align: 'center' as const, editable: false, valueFormatter: formatDollars, cellStyle: computedCellStyle },
      { id: 'incentives',         field: 'incentives',         headerName: 'Incentives (%)',          width: 110, align: 'center' as const, editable: true,  unit: '%', valueFormatter: pct },
      { id: 'incentivesPaidUpfront', field: 'incentivesPaidUpfront', headerName: '% Incentives Paid Upfront', width: 140, align: 'center' as const, editable: true, unit: '%', valueFormatter: pct },
      // Remaining Incentives — dropdown matching the production reference's
      // holding-general-table-row.tsx:57-68 (remainingIncentiveOptions):
      // 'rent-free' → "Rent Free" vs 'discount' → "Discount".
      {
        id: 'remainingIncentives',
        field: 'remainingIncentives',
        headerName: 'Remaining Incentives',
        width: 140,
        align: 'center' as const,
        editable: ((row: HoldingGeneralRow) => row.type !== 'Total') as unknown as boolean,
        cellEditor: 'select' as const,
        options: [
          { value: 'rent-free', label: 'Rent Free' },
          { value: 'discount',  label: 'Discount' },
        ],
        valueFormatter: (v) =>
          v === 'rent-free' ? 'Rent Free' : v === 'discount' ? 'Discount' : '',
      },
      { id: 'discountMonths',     field: 'discountMonths',     headerName: 'Discount Months',         width: 110, align: 'center' as const, editable: true },
      { id: 'totalIncentives',    field: 'totalIncentives',    headerName: 'Total Incentives',        width: 140, align: 'center' as const, editable: false, valueFormatter: formatDollars, cellStyle: computedCellStyle },
      // ── On Completion group (2) — headers intentionally brief; the group header provides "On Completion" context ──
      { id: 'completionCapRate',  field: 'completionCapRate',  headerName: 'Cap Rate (%)',            width: 130, align: 'center' as const, editable: true,  unit: '%', valueFormatter: pct },
      { id: 'completionCapValue', field: 'completionCapValue', headerName: 'Cap Value',               width: 150, align: 'center' as const, editable: false, valueFormatter: formatDollars, cellStyle: computedCellStyle },
      // ── Exit group (5) — headers intentionally brief; the group header provides "Exit" context ──
      { id: 'exitCapRate',        field: 'exitCapRate',        headerName: 'Cap Rate (%)',            width: 120, align: 'center' as const, editable: true,  unit: '%', valueFormatter: pct },
      { id: 'exitCapValue',       field: 'exitCapValue',       headerName: 'Cap Value',               width: 140, align: 'center' as const, editable: false, valueFormatter: formatDollars, cellStyle: computedCellStyle },
      { id: 'exitGST',            field: 'exitGST',            headerName: 'GST (%)',                 width: 110, align: 'center' as const, editable: true,  unit: '%', valueFormatter: pct },
      { id: 'exitCommission',     field: 'exitCommission',     headerName: 'Sales Commission (%)',    width: 150, align: 'center' as const, editable: true, unit: '%', valueFormatter: pct },
      { id: 'settlementDate',     field: 'settlementDate',     headerName: 'Settlement Date',         width: 120, align: 'center' as const, editable: true,  valueFormatter: dateMonYY },
    ],
    [],
  );

  const holdingGeneralPlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      sorting(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-holding-general' }),
    ],
    [],
  );

  // Multi-header groups match the production reference's holding-general-table layout —
  // "Development Costs" / "On Completion" / "Exit" banner above the 15 detail
  // columns that make up each logical section. Since `headerLayout` replaces
  // the grid's default per-column header row, we also emit a second row that
  // mirrors each column's `header` so the normal column labels still show
  // below the group banner.
  const holdingGeneralHeaderLayout = useMemo(
    () => [
      {
        id: 'holding-general-groups',
        height: 32,
        cells: [
          { id: 'hg-empty',          content: '',                  colSpan: 15 },
          { id: 'hg-dev-costs',      content: 'Development Costs', colSpan: 8 },
          { id: 'hg-on-completion',  content: 'On Completion',     colSpan: 2 },
          { id: 'hg-exit',           content: 'Exit',              colSpan: 5 },
        ],
      },
      {
        id: 'holding-general-columns',
        height: FSBT_STYLES.headerHeight,
        cells: holdingGeneralColumns.map((col) => ({
          id: `hg-col-${col.id}`,
          columnId: col.id,
          content: col.headerName,
        })),
      },
    ],
    [holdingGeneralColumns],
  );

  const holdingGeneralGrid = useGrid<HoldingGeneralRow>({
    data: holdingGeneralData,
    columns: holdingGeneralColumns,
    mode: null,
    plugins: holdingGeneralPlugins,
    pinned: { bottom: [holdingGeneralTotalsRow] },
    headers: holdingGeneralHeaderLayout,
    // Freeze Type + Description so category context is visible while the
    // user scrolls across the 30-column rent / lease / cap-rate layout.
    frozen: { left: 2, clip: { minVisible: 1 } },
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    striped: true,
    rowStyle: parentRowStyle,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Holding Sale Details Grid Setup (reuses BTS Details column layout)
  // ════════════════════════════════════════════════════════════════════════════

  const holdingSaleColumns = useMemo<ColumnDef<BtsDetailRow>[]>(() => btsDetailsColumns, [btsDetailsColumns]);

  const holdingSalePlugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-revenue-holding-sale' }),
    ],
    [],
  );

  const holdingSaleGrid = useGrid<BtsDetailRow>({
    data: holdingSaleData,
    columns: holdingSaleColumns,
    mode: null,
    plugins: holdingSalePlugins,
    frozen: { left: 8, clip: { minVisible: 2 } },
    striped: true,
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    rowStyle: btsDetailRowStyle,
  });

  // ════════════════════════════════════════════════════════════════════════════
  // Action Handlers
  // ════════════════════════════════════════════════════════════════════════════

  const handleBtsExport = useCallback(() => (btsGrid.api.plugins as { export?: ExportApi }).export?.exportToExcel(), [btsGrid]);

  const handleHoldingExpandAll = useCallback(() => holdingGrid.api.expandAll(), [holdingGrid]);
  const handleHoldingCollapseAll = useCallback(() => holdingGrid.api.collapseAll(), [holdingGrid]);
  const handleHoldingExport = useCallback(() => (holdingGrid.api.plugins as { export?: ExportApi }).export?.exportToExcel(), [holdingGrid]);

  const handleBtsDetailsExport = useCallback(() => (btsDetailsGrid.api.plugins as { export?: ExportApi }).export?.exportToExcel(), [btsDetailsGrid]);
  const handleHoldingGeneralExport = useCallback(() => (holdingGeneralGrid.api.plugins as { export?: ExportApi }).export?.exportToExcel(), [holdingGeneralGrid]);
  const handleHoldingSaleExport = useCallback(() => (holdingSaleGrid.api.plugins as { export?: ExportApi }).export?.exportToExcel(), [holdingSaleGrid]);

  const pillStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', border: '1px solid #E4E7EC', borderRadius: 999, background: '#F9FAFB', fontSize: 13, color: '#101828' } as const;

  return (
    <div>
      {/* Program summary — matches the production reference's feasibility layout where program is shown above each financial tab */}
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
            <IconButton title="Export" onClick={handleBtsExport}><ExportIcon /></IconButton>
          </div>
        </div>
        <BetterGrid<BtsRow>
          grid={btsGrid}
          height={280}
          style={{
            borderRadius: 12,
            '--bg-scrollbar-inset': '12px',
            '--bg-header-bg': '#D0D5DD',
          } as CSSProperties}
        />
      </div>

      {/* BTS Details — multi-section breakdown (Gross / GST / Commission / Net) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, justifyContent: 'flex-end' }}>
          <IconButton title="Export" onClick={handleBtsDetailsExport}><ExportIcon /></IconButton>
        </div>
        <BetterGrid<BtsDetailRow>
          grid={btsDetailsGrid}
          height={720}
          style={{ borderRadius: 12, '--bg-scrollbar-inset': '12px', '--bg-header-bg': '#D0D5DD' } as CSSProperties}
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
            <IconButton title="Export" onClick={handleHoldingGeneralExport}><ExportIcon /></IconButton>
          </div>
        </div>
        <BetterGrid<HoldingGeneralRow>
          grid={holdingGeneralGrid}
          height={260}
          style={{ borderRadius: 12, marginBottom: 24, '--bg-scrollbar-inset': '12px', '--bg-header-bg': '#D0D5DD' } as CSSProperties}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, justifyContent: 'flex-end' }}>
          <IconButton title="Expand All" onClick={handleHoldingExpandAll}><ExpandAllIcon /></IconButton>
          <IconButton title="Collapse All" onClick={handleHoldingCollapseAll}><CollapseAllIcon /></IconButton>
          <IconButton title="Export" onClick={handleHoldingExport}><ExportIcon /></IconButton>
        </div>
        <BetterGrid<HoldingRow>
          grid={holdingGrid}
          height={480}
          style={{ borderRadius: 12, '--bg-scrollbar-inset': '12px', '--bg-header-bg': '#D0D5DD' } as CSSProperties}
        />
      </div>

      {/* Holding Asset - Sale — third section, mirrors the production reference's empty-state layout */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' as const }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Holding Asset - Sale</h3>
          <span style={pillStyle}>
            <span style={{ color: '#667085' }}>Net Sale Revenue</span>
            <strong style={{ fontWeight: 600 }}>$0</strong>
          </span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <IconButton title="Export" onClick={handleHoldingSaleExport}><ExportIcon /></IconButton>
          </div>
        </div>
        <BetterGrid<BtsDetailRow>
          grid={holdingSaleGrid}
          height={320}
          style={{ borderRadius: 12, '--bg-scrollbar-inset': '12px', '--bg-header-bg': '#D0D5DD' } as CSSProperties}
        />
      </div>
    </div>
  );
}

