import { useMemo, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, editing, sorting, hierarchy, cellRenderers, validation, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';
import { FsbtProgramSummary } from './_FsbtProgramSummary';
import { FSBT_STYLES, parentRowCellStyle } from './_fsbt-cell-styles';

// ---------------------------------------------------------------------------
// Data model — mirrors Wiseway's feasibility/types/project-cost.ts
// (src/modules/feasibility/components/cost/cost-table.tsx in wise-frontend-app)
// Parent rows have inputType='none' and no input. Percent rows store the
// percentage value (e.g. 10.0) with inputType='percent'; number rows store the
// raw currency amount.
// ---------------------------------------------------------------------------

type CostInputType = 'number' | 'percent' | 'none';

interface CostRow {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  inputType: CostInputType;
  input: number | null;
  escalation: 'none' | 'cpi' | 'non-cpi';
  amount: number;
  start: string;
  end: string;
  variance: number;
  custom: boolean;
  [key: string]: string | number | boolean | null;
}

// Port of getCostInputNote from wise-frontend-app/src/modules/feasibility/utils/cost.utils.ts
function getCostInputNote(code: string): string {
  if (code.startsWith('1.')) return 'Land Cost';
  switch (code) {
    case '3.08': return 'Construction Cost';
    case '5.01':
    case '5.02':
    case '5.03':
    case '10.04':
    case '10.05':
    case '10.09': return 'Per lot';
    case '9.01':
    case '9.02':
    case '9.03':
    case '9.04':
    case '9.05': return 'p.a.';
    case '11.01': return 'Total Development Cost';
    case '12.01': return 'Total Development Cost excl. finance';
    default: return '';
  }
}

// Data from QA app project 4288: https://qa-app.wiseway.ai/projects/4288/cost
// Total Development Cost: $161,041,739 (13 phases, 39 months Aug 2023 – Oct 2026)
const data: CostRow[] = [
  // 1. Land Cost — $27,000,000 (Wiseway special-cases this parent to show its input)
  { id: 1, parentId: null, code: '1', name: 'Land Cost', inputType: 'number', input: 27000000, escalation: 'none', amount: 27000000, start: '2023-08-01', end: '2024-01-31', variance: 0, custom: false, m_2023_08: 27000000 },
  { id: 2, parentId: 1, code: '1.01', name: 'Deposit', inputType: 'percent', input: 10, escalation: 'none', amount: 2700000, start: '2023-08-01', end: '2023-08-31', variance: 0, custom: false, m_2023_08: 2700000 },
  { id: 3, parentId: 1, code: '1.02', name: 'Settlement', inputType: 'percent', input: 90, escalation: 'none', amount: 24300000, start: '2024-01-01', end: '2024-01-31', variance: 0, custom: false, m_2024_01: 24300000 },

  // 2. Acquisition Cost — $1,964,870
  { id: 4, parentId: null, code: '2', name: 'Acquisition Cost', inputType: 'none', input: null, escalation: 'none', amount: 1964870, start: '2023-08-01', end: '2024-01-31', variance: 0, custom: false },
  { id: 5, parentId: 4, code: '2.01', name: 'Stamp Duty', inputType: 'number', input: 1734870, escalation: 'none', amount: 1734870, start: '2024-01-01', end: '2024-01-31', variance: 0, custom: false, m_2024_01: 1734870 },
  { id: 6, parentId: 4, code: '2.02', name: 'DD Costs', inputType: 'number', input: 200000, escalation: 'cpi', amount: 200000, start: '2023-08-01', end: '2023-11-30', variance: 0, custom: false, m_2023_08: 50000, m_2023_09: 50000, m_2023_10: 50000, m_2023_11: 50000 },
  { id: 7, parentId: 4, code: '2.03', name: 'ASIC SPV Establishment', inputType: 'number', input: 30000, escalation: 'cpi', amount: 30000, start: '2023-08-01', end: '2023-08-31', variance: 0, custom: false, m_2023_08: 30000 },
  { id: 8, parentId: 4, code: '2.04', name: 'Sunk Cost', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2024-01-01', end: '2024-01-31', variance: 0, custom: false },
  { id: 9, parentId: 4, code: '2.05', name: 'Others', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2023-08-01', end: '2024-01-31', variance: 0, custom: false },

  // 3. Construction Cost — $114,471,000
  { id: 10, parentId: null, code: '3', name: 'Construction Cost', inputType: 'none', input: null, escalation: 'none', amount: 114471000, start: '2024-10-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 11, parentId: 10, code: '3.01', name: 'Demolition', inputType: 'number', input: 1500000, escalation: 'cpi', amount: 1500000, start: '2024-10-01', end: '2024-12-31', variance: 0, custom: false, m_2024_10: 500000, m_2024_11: 500000, m_2024_12: 500000 },
  { id: 12, parentId: 10, code: '3.03', name: 'Early Work', inputType: 'number', input: 1020000, escalation: 'cpi', amount: 1020000, start: '2025-01-01', end: '2025-06-30', variance: 0, custom: false, m_2025_01: 170000, m_2025_02: 170000, m_2025_03: 170000, m_2025_04: 170000, m_2025_05: 170000, m_2025_06: 170000 },
  { id: 13, parentId: 10, code: '3.05', name: 'Main Construction', inputType: 'number', input: 106500000, escalation: 'cpi', amount: 106500000, start: '2025-04-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 14, parentId: 10, code: '3.08', name: 'Construction Contingency', inputType: 'percent', input: 5, escalation: 'none', amount: 5451000, start: '2024-10-01', end: '2026-09-30', variance: 0, custom: false },

  // 4. Professional Fees — $2,500,506
  { id: 15, parentId: null, code: '4', name: 'Professional Fees', inputType: 'none', input: null, escalation: 'none', amount: 2500506, start: '2023-08-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 16, parentId: 15, code: '4.03', name: 'Architecture', inputType: 'number', input: 500506, escalation: 'cpi', amount: 500506, start: '2023-08-01', end: '2025-03-31', variance: 0, custom: false },
  { id: 17, parentId: 15, code: '4.11', name: 'External PM / Superintendent', inputType: 'number', input: 2000000, escalation: 'cpi', amount: 2000000, start: '2024-10-01', end: '2026-09-30', variance: 0, custom: false },

  // 5. Statutory Fees — $1,067,838
  { id: 18, parentId: null, code: '5', name: 'Statutory Fees', inputType: 'none', input: null, escalation: 'none', amount: 1067838, start: '2025-01-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 19, parentId: 18, code: '5.01', name: 'Water', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2025-01-01', end: '2025-01-31', variance: 0, custom: false },
  { id: 20, parentId: 18, code: '5.02', name: 'Sewer', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2025-01-01', end: '2025-01-31', variance: 0, custom: false },
  { id: 21, parentId: 18, code: '5.03', name: 'Gas', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2025-01-01', end: '2025-01-31', variance: 0, custom: false },
  { id: 22, parentId: 18, code: '5.04', name: 'Others', inputType: 'number', input: 1067838, escalation: 'cpi', amount: 1067838, start: '2025-01-01', end: '2026-09-30', variance: 0, custom: false },

  // 6. Marketing Costs — $2,063,000
  { id: 23, parentId: null, code: '6', name: 'Marketing Costs', inputType: 'none', input: null, escalation: 'none', amount: 2063000, start: '2025-01-01', end: '2026-10-31', variance: 0, custom: false },
  { id: 24, parentId: 23, code: '6.01', name: 'Advertisement', inputType: 'number', input: 513000, escalation: 'cpi', amount: 513000, start: '2025-03-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 25, parentId: 23, code: '6.02', name: 'Display Suites', inputType: 'number', input: 1000000, escalation: 'cpi', amount: 1000000, start: '2025-03-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 26, parentId: 23, code: '6.03', name: 'Creative Agency', inputType: 'number', input: 500000, escalation: 'cpi', amount: 500000, start: '2025-03-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 27, parentId: 23, code: '6.04', name: 'Render', inputType: 'number', input: 50000, escalation: 'cpi', amount: 50000, start: '2025-03-01', end: '2025-04-30', variance: 0, custom: false },
  { id: 28, parentId: 23, code: '6.05', name: 'Marketing Materials (Print)', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2025-03-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 29, parentId: 23, code: '6.06', name: 'Events', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2025-09-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 30, parentId: 23, code: '6.07', name: 'Others', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2025-03-01', end: '2026-09-30', variance: 0, custom: false },

  // 7. Pre-sale Commission — $2,998,271
  { id: 31, parentId: null, code: '7', name: 'Pre-sale Commission', inputType: 'none', input: null, escalation: 'none', amount: 2998271, start: '2025-09-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 32, parentId: 31, code: '7.01', name: 'Pre-sale Commission - Apt', inputType: 'number', input: 2550893, escalation: 'cpi', amount: 2550893, start: '2025-09-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 33, parentId: 31, code: '7.02', name: 'Pre-sale Commission - West G Floor', inputType: 'number', input: 447379, escalation: 'cpi', amount: 447379, start: '2025-09-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 34, parentId: 31, code: '7.03', name: 'Pre-sale Commission - Park', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2025-09-01', end: '2026-09-30', variance: 0, custom: false },

  // 8. Leasing Fee & Incentives — $0
  { id: 35, parentId: null, code: '8', name: 'Leasing Fee & Incentives', inputType: 'none', input: null, escalation: 'none', amount: 0, start: '2026-10-01', end: '2026-10-31', variance: 0, custom: false },

  // 9. Land Holding Costs — $1,930,936
  { id: 36, parentId: null, code: '9', name: 'Land Holding Costs', inputType: 'none', input: null, escalation: 'none', amount: 1930936, start: '2024-01-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 37, parentId: 36, code: '9.01', name: 'Land Tax', inputType: 'number', input: 600000, escalation: 'cpi', amount: 600000, start: '2024-01-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 38, parentId: 36, code: '9.02', name: 'Council Rates', inputType: 'number', input: 450000, escalation: 'cpi', amount: 450000, start: '2024-01-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 39, parentId: 36, code: '9.03', name: 'Water Rates', inputType: 'number', input: 280000, escalation: 'cpi', amount: 280000, start: '2024-01-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 40, parentId: 36, code: '9.04', name: 'Insurance', inputType: 'number', input: 500936, escalation: 'cpi', amount: 500936, start: '2024-01-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 41, parentId: 36, code: '9.05', name: 'Others', inputType: 'number', input: 100000, escalation: 'cpi', amount: 100000, start: '2024-01-01', end: '2026-09-30', variance: 0, custom: false },

  // 10. Legal Costs — $806,750
  { id: 42, parentId: null, code: '10', name: 'Legal Costs', inputType: 'none', input: null, escalation: 'none', amount: 806750, start: '2023-08-01', end: '2026-10-31', variance: 0, custom: false },
  { id: 43, parentId: 42, code: '10.01', name: 'Consultants', inputType: 'number', input: 250000, escalation: 'cpi', amount: 250000, start: '2023-08-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 44, parentId: 42, code: '10.02', name: 'Construction', inputType: 'number', input: 306750, escalation: 'cpi', amount: 306750, start: '2024-10-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 45, parentId: 42, code: '10.03', name: 'Master Contract of Sale', inputType: 'number', input: 250000, escalation: 'cpi', amount: 250000, start: '2025-09-01', end: '2026-10-31', variance: 0, custom: false },

  // 11. Project Contingency — $1,548,032
  { id: 46, parentId: null, code: '11', name: 'Project Contingency', inputType: 'none', input: null, escalation: 'none', amount: 1548032, start: '2026-06-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 47, parentId: 46, code: '11.01', name: 'Project Contingency', inputType: 'percent', input: 1, escalation: 'none', amount: 1548032, start: '2026-06-01', end: '2026-09-30', variance: 0, custom: false },

  // 12. Development Management Fees — $4,690,536
  { id: 48, parentId: null, code: '12', name: 'Development Management Fees', inputType: 'none', input: null, escalation: 'none', amount: 4690536, start: '2023-08-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 49, parentId: 48, code: '12.01', name: 'DM/PM Fees', inputType: 'percent', input: 3, escalation: 'none', amount: 4690536, start: '2023-08-01', end: '2026-09-30', variance: 0, custom: false },
  { id: 50, parentId: 48, code: '12.02', name: 'Others', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2023-08-01', end: '2026-09-30', variance: 0, custom: false },

  // 13. Other Costs — $0
  { id: 51, parentId: null, code: '13', name: 'Other Costs', inputType: 'none', input: null, escalation: 'none', amount: 0, start: '2023-08-01', end: '2026-10-31', variance: 0, custom: false },
  { id: 52, parentId: 51, code: '13.01', name: 'Others', inputType: 'number', input: 0, escalation: 'cpi', amount: 0, start: '2023-08-01', end: '2026-10-31', variance: 0, custom: false },
];

// Monthly columns: Aug 2023 – Oct 2026 (39 months, matching Program)
const ts = timeSeries({
  start: '2023-08-01',
  end: '2026-10-01',
  locale: 'en-AU',
  columnDefaults: {
    cellType: 'currency' as never,
    precision: 0,
    hideZero: true,
  },
});

// Compute pinned bottom totals row from root-level rows
function buildTotalsRow(): CostRow {
  const rootRows = data.filter(r => r.parentId === null);
  const totals: CostRow = {
    id: -1,
    parentId: null,
    code: '',
    name: 'TOTAL',
    inputType: 'none',
    input: null,
    escalation: 'none',
    amount: 0,
    start: '',
    end: '',
    variance: 0,
    custom: false,
  };
  for (const row of rootRows) {
    totals.amount += row.amount;
    totals.variance += row.variance;
  }
  for (const col of ts.columns) {
    let sum = 0;
    for (const row of data) {
      const val = row[col.id];
      if (typeof val === 'number') sum += val;
    }
    if (sum !== 0) totals[col.id] = sum;
  }
  return totals;
}

const totalsRow = buildTotalsRow();

// ---------------------------------------------------------------------------
// Cell-level helpers that mirror Wiseway's per-component styling
// ---------------------------------------------------------------------------

function formatAU(value: number): string {
  return value.toLocaleString('en-AU', { maximumFractionDigits: 0 });
}

function phaseCellStyle(_v: unknown, row: unknown): Record<string, string> | undefined {
  const r = row as CostRow;
  const base = parentRowCellStyle(_v, row) ?? {};
  // Wiseway's phase cell: parent padL 8px, child padL 28px (theme.spacing(1) / theme.spacing(3.5))
  return { ...base, paddingLeft: r.parentId === null ? '8px' : '28px' };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'] as const;

/** Convert YYYY-MM-DD → "Mon YY" (matches Program table). Blank pass-through. */
function formatMonYY(dateIso: string): string {
  if (!dateIso) return '';
  const [yStr, mStr] = dateIso.split('-');
  if (!yStr || !mStr) return dateIso;
  const m = parseInt(mStr, 10) - 1;
  return `${MONTH_NAMES[m] ?? mStr} ${yStr.slice(2)}`;
}

export function FsbtCost() {
  const columns = useMemo<ColumnDef<CostRow>[]>(
    () => [
      // ── Col 0: Menu — Wiseway's add/delete ⋮ (only shown on custom children when editable) ──
      {
        id: 'menu', header: '', width: 50, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.style.backgroundColor = row.parentId === null ? FSBT_STYLES.parentRowBg : '';
        },
      },
      // ── Col 1: Code — right-aligned, read-only. Explicit cellRenderer
      //    keeps inputStyle: true from painting an empty input here. ──
      {
        id: 'code', accessorKey: 'code', header: 'Code', width: 40, align: 'right' as const, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.textContent = row.code;
          container.style.paddingRight = '0';
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Col 2: Phase — 8px parent / 28px child padding, bold on parent.
      //    Editable only for custom children (Wiseway convention — only custom rows are named by the user).
      {
        id: 'name', accessorKey: 'name', header: 'Phase', width: 236, cellStyle: phaseCellStyle,
        editable: ((row: CostRow) => row.parentId !== null && row.custom) as unknown as boolean,
      },
      // ── Col 3: Input — percent rows show number + "%" suffix; parent rows except Land Cost render empty.
      //    Editable unless the row is inputType='none' (parent rollups). Land Cost (parent with code='1') is still editable.
      {
        id: 'input', accessorKey: 'input', header: 'Input', width: 110, align: 'center' as const,
        editable: ((row: CostRow) => row.inputType !== 'none') as unknown as boolean,
        cellType: 'number' as const, precision: 2,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;

          // Wiseway: parent rows render empty input UNLESS the parent has an explicit input (Land Cost, code='1')
          const isParent = row.parentId === null;
          const isParentWithoutInput = isParent && row.code !== '1';
          container.innerHTML = '';
          if (isParentWithoutInput || row.inputType === 'none') return;

          container.style.display = 'flex';
          container.style.alignItems = 'center';
          container.style.justifyContent = 'center';
          container.style.gap = '4px';

          const val = document.createElement('span');
          val.textContent = row.input !== null ? formatAU(row.input) : '';
          container.appendChild(val);

          if (row.inputType === 'percent') {
            const unit = document.createElement('span');
            unit.textContent = '%';
            unit.style.color = '#98A2B3';
            container.appendChild(unit);
          }
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Col 4: Input Note — derived from code via Wiseway's getCostInputNote() ──
      {
        id: 'inputNote', header: '', width: 140, align: 'left' as const, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.textContent = getCostInputNote(row.code);
          container.style.color = '#667085';
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Col 5: Escalation — CPI / Non-CPI dropdown, blank when 'none' or on parent rows ──
      {
        id: 'escalation', accessorKey: 'escalation', header: 'Escalation', width: 110, align: 'center' as const,
        cellEditor: 'dropdown' as const, options: ['none', 'cpi', 'non-cpi'],
        editable: ((row: CostRow) => row.parentId !== null) as unknown as boolean,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          if (row.escalation === 'cpi') container.textContent = 'CPI';
          else if (row.escalation === 'non-cpi') container.textContent = 'Non-CPI';
          else container.textContent = '';
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Col 6: Amount — plain number (Wiseway uses formatNumber, not currency), read-only ──
      {
        id: 'amount', accessorKey: 'amount', header: 'Amount', width: 110, align: 'center' as const, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.textContent = typeof row.amount === 'number' ? formatAU(Math.round(row.amount)) : '';
        },
        cellStyle: (_v, row) => {
          const r = row as CostRow;
          if (r.parentId === null) return { background: FSBT_STYLES.parentRowBg, fontWeight: '500', color: FSBT_STYLES.parentText, fontSize: FSBT_STYLES.infoFontSize };
          return { color: FSBT_STYLES.childText, fontSize: FSBT_STYLES.infoFontSize };
        },
      },
      // ── Col 7: Start — display as "Mon YY", editable for non-parents ──
      {
        id: 'start', accessorKey: 'start', header: 'Start', width: 85, align: 'center' as const,
        editable: ((row: CostRow) => row.parentId !== null) as unknown as boolean,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.textContent = formatMonYY(row.start);
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Col 8: End — display as "Mon YY", editable for non-parents ──
      {
        id: 'end', accessorKey: 'end', header: 'End', width: 85, align: 'center' as const,
        editable: ((row: CostRow) => row.parentId !== null) as unknown as boolean,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.textContent = formatMonYY(row.end);
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Col 9: Variance (read-only, computed) ──
      { id: 'variance', accessorKey: 'variance', header: 'Variance', width: 85, cellType: 'change' as const, align: 'center' as const, editable: false, cellStyle: parentRowCellStyle },
      // ── Col 10: Variance status — 44px icon slot (matches Wiseway's layout; status icon TBD) ──
      {
        id: 'varianceStatus', header: '', width: 44, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.style.backgroundColor = row.parentId === null ? FSBT_STYLES.parentRowBg : '';
        },
      },
      // ── Col 11: Collapse/expand chevron (at end of frozen row, matches FsbtProgram) ──
      {
        id: 'collapse', header: '', width: 40, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.style.backgroundColor = row.parentId === null ? FSBT_STYLES.parentRowBg : '';
        },
      },
      ...ts.columns,
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      // inputStyle: true makes editable cells always look like inputs/dropdowns (matching Wiseway), even when not focused.
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      sorting(),
      hierarchy({ toggleColumn: 'collapse', toggleStyle: 'chevron' }),
      cellRenderers(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-cost-breakdown' }),
    ],
    [],
  );

  const pinnedBottomRows = useMemo(() => [totalsRow], []);

  const { grid, containerRef } = useGrid<CostRow>({
    data,
    columns,
    plugins,
    // Freeze 12 columns (Wiseway's 11 defaults + our trailing collapse column).
    // Monthly columns scroll horizontally. freezeClip lets the user drag the
    // clip handle to hide some pinned columns when the viewport is narrow;
    // minVisible: 2 keeps at least Menu + Code visible at all times.
    frozenLeftColumns: 12,
    freezeClip: { minVisible: 2 },
    tableStyle: 'striped' as const,
    hierarchy: {
      getRowId: (row: CostRow) => row.id,
      getParentId: (row: CostRow) => row.parentId,
      defaultExpanded: true,
    },
    pinnedBottomRows,
    selection: { mode: 'range' as const, fillHandle: true },
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
  });

  const handleExpandAll = useCallback(() => grid.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.collapseAll(), [grid]);
  const handleExportCsv = useCallback(() => grid.plugins.export?.exportToCsv(), [grid]);
  const handleExportExcel = useCallback(() => grid.plugins.export?.exportToExcel(), [grid]);
  const handleUndo = useCallback(() => grid.plugins.undoRedo?.undo(), [grid]);
  const handleRedo = useCallback(() => grid.plugins.undoRedo?.redo(), [grid]);

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

      {/* Cost grid */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 12px', flexWrap: 'wrap' as const }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Cost</h2>
        <span style={pillStyle}>
          <span style={{ color: '#667085' }}>Total Development Cost</span>
          <strong style={{ fontWeight: 600 }}>$161,041,739</strong>
        </span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button onClick={handleExpandAll} style={btnStyle}>Expand All</button>
          <button onClick={handleCollapseAll} style={btnStyle}>Collapse All</button>
          <button onClick={handleUndo} style={btnStyle}>Undo</button>
          <button onClick={handleRedo} style={btnStyle}>Redo</button>
          <button onClick={handleExportCsv} style={btnStyle}>CSV</button>
          <button onClick={handleExportExcel} style={btnStyle}>Excel</button>
        </div>
      </div>
      <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13, lineHeight: 1.5 }}>
        Hierarchical development cost structure with monthly cashflow distribution. CPI and non-CPI escalation options.
      </p>
      <div
        ref={containerRef}
        style={{
          height: 540,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 12,
        }}
      />
    </div>
  );
}
