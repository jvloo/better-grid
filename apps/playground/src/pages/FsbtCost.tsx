import { useMemo, useCallback, useRef, useState } from 'react';
import { useGrid } from '@better-grid/react';
import type { CellChange, ColumnDef } from '@better-grid/core';
import { timeSeries } from '@better-grid/core';
import { formatting, editing, sorting, hierarchy, cellRenderers, validation, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import { rowActions, RowActionIcons } from '@better-grid/pro';
import type { RowAction } from '@better-grid/pro';
import '@better-grid/core/styles.css';
import { FsbtProgramSummary } from './_FsbtProgramSummary';
import { FSBT_STYLES, parentRowCellStyle, parentRowStyle } from './_fsbt-cell-styles';
import {
  IconButton,
  ExpandAllIcon,
  CollapseAllIcon,
  ExportIcon,
} from './_toolbar-icons';

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

const COST_PARENT_MAX_CUSTOM_ROWS = 50;
const PROJECT_START = '2023-08-01';
const PROJECT_END = '2026-10-01';

function compareMonthIso(a: string, b: string): number {
  const first = parseIsoMonth(a);
  const second = parseIsoMonth(b);
  return first.getTime() - second.getTime();
}

function getChildCodeSuffix(code: string): number | undefined {
  const suffix = Number(code.split('.').at(-1));
  return Number.isFinite(suffix) ? suffix : undefined;
}

function formatChildCode(parentCode: string, suffix: number): string {
  return `${parentCode}.${String(suffix).padStart(2, '0')}`;
}

function renumberCustomCostChildren(rows: CostRow[], parentId: number): CostRow[] {
  const parent = rows.find(row => row.id === parentId);
  if (!parent) return rows;

  const regularSuffixes = rows
    .filter(row => row.parentId === parentId && !row.custom)
    .map(row => getChildCodeSuffix(row.code))
    .filter((suffix): suffix is number => typeof suffix === 'number');
  let nextSuffix = Math.max(0, ...regularSuffixes) + 1;

  return rows.map(row => {
    if (row.parentId !== parentId || !row.custom) return row;
    return { ...row, code: formatChildCode(parent.code, nextSuffix++) };
  });
}

function insertCustomCostRow(rows: CostRow[], sourceRow: CostRow): CostRow[] {
  const parentId = sourceRow.parentId ?? sourceRow.id;
  const parent = rows.find(row => row.id === parentId);
  if (!parent) return rows;

  const customCount = rows.filter(row => row.parentId === parentId && row.custom).length;
  if (customCount >= COST_PARENT_MAX_CUSTOM_ROWS) return rows;

  const nextId = Math.max(...rows.map(row => row.id)) + 1;
  const children = rows.filter(row => row.parentId === parentId);
  const lastChildIndex = Math.max(...children.map(child => rows.findIndex(row => row.id === child.id)));
  const insertIndex = lastChildIndex >= 0 ? lastChildIndex + 1 : rows.findIndex(row => row.id === parentId) + 1;
  const inputType: CostInputType = parent.code === '1' ? 'percent' : 'number';
  const row: CostRow = {
    id: nextId,
    parentId,
    code: formatChildCode(parent.code, 0),
    name: '',
    inputType,
    input: 0,
    escalation: 'cpi',
    amount: 0,
    start: sourceRow.start || parent.start,
    end: sourceRow.end || parent.end,
    variance: 0,
    custom: true,
  };

  const next = [...rows.slice(0, insertIndex), row, ...rows.slice(insertIndex)];
  return renumberCustomCostChildren(next, parentId);
}

function deleteCustomCostRow(rows: CostRow[], sourceRow: CostRow): CostRow[] {
  if (!sourceRow.custom || sourceRow.parentId == null) return rows;

  const othersLength = rows.filter(row => row.code.startsWith('13.')).length;
  if (sourceRow.code.startsWith('13') && othersLength <= 1) return rows;

  const next = rows.filter(row => row.id !== sourceRow.id);
  return renumberCustomCostChildren(next, sourceRow.parentId);
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

const MONTH_KEY_RE = /^m_(\d{4})_(\d{2})$/;

function parseIsoMonth(dateIso: string): Date {
  const [year, month] = dateIso.split('-').map(Number);
  return new Date(year!, month! - 1, 1);
}

function monthKey(date: Date): string {
  return `m_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthDiffInclusive(startIso: string, endIso: string): number {
  const start = parseIsoMonth(startIso);
  const end = parseIsoMonth(endIso);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

function addMonthsLocal(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getMonthlyEntries(row: CostRow): Array<[string, number]> {
  return Object.entries(row).filter(
    (entry): entry is [string, number] => MONTH_KEY_RE.test(entry[0]) && typeof entry[1] === 'number',
  );
}

function setMonthlyValue(row: CostRow, key: string, value: number): void {
  row[key] = value;
}

function distributeEvenly(row: CostRow): Array<[string, number]> {
  if (!row.start || !row.end || !row.amount) return [];

  const duration = monthDiffInclusive(row.start, row.end);
  if (duration <= 0) return [];

  const start = parseIsoMonth(row.start);
  const base = Math.floor(row.amount / duration);
  let remainder = row.amount - base * duration;
  const entries: Array<[string, number]> = [];

  for (let i = 0; i < duration; i += 1) {
    const value = base + (i === duration - 1 ? remainder : 0);
    remainder = 0;
    entries.push([monthKey(addMonthsLocal(start, i)), value]);
  }

  return entries;
}

function distributeMainConstruction(row: CostRow): Array<[string, number]> {
  if (!row.start || !row.end || !row.amount) return [];

  const duration = monthDiffInclusive(row.start, row.end);
  if (duration <= 0) return [];

  const start = parseIsoMonth(row.start);
  const cumulative = (monthNumber: number) => Math.sin(((monthNumber / duration) * Math.PI) / 2) ** 2;
  const entries: Array<[string, number]> = [];
  let roundedTotal = 0;

  for (let i = 0; i < duration; i += 1) {
    const weight = cumulative(i + 1) - cumulative(i);
    const value = i === duration - 1 ? row.amount - roundedTotal : Math.round(row.amount * weight);
    roundedTotal += value;
    entries.push([monthKey(addMonthsLocal(start, i)), value]);
  }

  return entries;
}

function buildCostRows(rows: CostRow[]): CostRow[] {
  const byId = new Map<number, CostRow>();
  const result = rows.map((row) => {
    const next = { ...row };
    for (const key of Object.keys(next)) {
      if (MONTH_KEY_RE.test(key)) delete next[key];
    }
    byId.set(next.id, next);
    return next;
  });

  for (const original of rows) {
    if (original.parentId === null) continue;

    const row = byId.get(original.id);
    if (!row) continue;

    const entries = getMonthlyEntries(original);
    const monthlyEntries = entries.length
      ? entries
      : original.code === '3.05'
        ? distributeMainConstruction(original)
        : distributeEvenly(original);

    for (const [key, value] of monthlyEntries) {
      setMonthlyValue(row, key, value);

      const parent = byId.get(original.parentId);
      if (parent) {
        const current = typeof parent[key] === 'number' ? parent[key] : 0;
        setMonthlyValue(parent, key, current + value);
      }
    }
  }

  return result;
}

function isMonthlyEditable(row: CostRow, column: ColumnDef<CostRow>): boolean {
  if (row.parentId === null || !row.start || !row.end || !row.amount) return false;
  const match = MONTH_KEY_RE.exec(column.id);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = parseIsoMonth(row.start);
  const end = parseIsoMonth(row.end);
  const current = new Date(year, month - 1, 1);

  return current >= start && current <= end;
}

// Data from QA app project 4288: https://qa-app.wiseway.ai/projects/4288/cost
// Total Development Cost: $161,041,739 (13 phases, 39 months Aug 2023 – Oct 2026)
const rawData: CostRow[] = [
  // 1. Land Cost — $27,000,000 (Wiseway special-cases this parent to show its input)
  { id: 1, parentId: null, code: '1', name: 'Land Cost', inputType: 'number', input: 27000000, escalation: 'none', amount: 27000000, start: '2023-08-01', end: '2024-01-31', variance: 0, custom: false, m_2023_08: 27000000 },
  { id: 2, parentId: 1, code: '1.01', name: 'Deposit', inputType: 'percent', input: 10, escalation: 'none', amount: 2700000, start: '2023-08-01', end: '2023-08-31', variance: 0, custom: false, m_2023_08: 2700000 },
  { id: 3, parentId: 1, code: '1.02', name: 'Settlement', inputType: 'percent', input: 90, escalation: 'none', amount: 24300000, start: '2024-01-01', end: '2024-01-31', variance: 0, custom: false, m_2024_01: 24300000 },
  { id: 53, parentId: 1, code: '1.03', name: '', inputType: 'percent', input: 0, escalation: 'cpi', amount: 0, start: '2023-08-01', end: '2024-01-31', variance: 0, custom: true, m_2023_08: 0, m_2023_09: 0, m_2023_10: 0, m_2023_11: 0, m_2023_12: 0, m_2024_01: 0 },

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

const INITIAL_COST_DATA: CostRow[] = buildCostRows(rawData);

// Monthly columns: Aug 2023 – Oct 2026 (39 months, matching Program)
const monthValueFormatter = (v: unknown): string => {
  if (v == null || typeof v !== 'number') return '';
  return v.toLocaleString('en-AU', { maximumFractionDigits: 0 });
};

const ts = timeSeries({
  start: '2023-08-01',
  end: '2026-10-01',
  locale: 'en-AU',
  columnWidth: 111,
  columnDefaults: {
    align: 'center' as never,
    cellType: 'currency' as never,
    precision: 0,
    hideZero: false,
    editable: isMonthlyEditable as never,
    valueFormatter: monthValueFormatter,
    cellRenderer: (container, ctx) => {
      container.textContent = monthValueFormatter(ctx.value);
    },
    cellStyle: parentRowCellStyle,
  },
});

// Compute pinned bottom totals row from root-level rows
function buildTotalsRow(rows: CostRow[]): CostRow {
  const rootRows = rows.filter(r => r.parentId === null);
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
    for (const row of rootRows) {
      const val = row[col.id];
      if (typeof val === 'number') sum += val;
    }
    if (sum !== 0) totals[col.id] = sum;
  }
  return totals;
}

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

function inputNoteCellStyle(value: unknown, row: unknown): Record<string, string> | undefined {
  return { ...(parentRowCellStyle(value, row) ?? {}), color: '#667085' };
}

function renderVarianceStatusIcon(container: HTMLElement, variance: number | undefined): void {
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';

  if (typeof variance !== 'number') {
    container.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="12" fill="#F7F7F7"/></svg>';
    return;
  }

  if (variance === 0) {
    container.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="12" fill="#E0F2FE"/><path d="M9.75 12L11.25 13.5L14.25 10.5M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" stroke="#026AA2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return;
  }

  container.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="12" fill="#FEF0C7"/><path d="M13.5 10.5L10.5 13.5M10.5 10.5L13.5 13.5M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z" stroke="#B54708" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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

/** Convert YYYY-MM-DD → "MM/YY" for the masked editor (e.g. "08/23"). */
function formatIsoToMMYY(v: unknown): string {
  if (!v || typeof v !== 'string') return '';
  const [yStr, mStr] = v.split('-');
  if (!yStr || !mStr) return '';
  return `${mStr}/${yStr.slice(2)}`;
}

/** Parse a partially-typed "MM/YY" (4 digits) into YYYY-MM-01 ISO. Matches FsbtProgram's parser exactly. */
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

function hasMaxTwoDecimals(value: number): boolean {
  return Number.isInteger(value * 100);
}

const ESCALATION_OPTIONS = [
  { value: 'cpi',     label: 'CPI' },
  { value: 'non-cpi', label: 'Non-CPI' },
] as const;

function validateCostInput(value: unknown, row: unknown): boolean | string {
  const cost = row as CostRow;
  if (value == null || value === '') return true;
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Input must be a valid number.';

  if (cost.code === '3.08') {
    if (n < 0 || n > 999.99) return 'Input must be between 0 and 999.99.';
    if (!hasMaxTwoDecimals(n)) return 'Input allows up to 2 decimal places.';
    return true;
  }

  if (cost.inputType === 'percent') {
    if (n < 0 || n > 100) return 'Input must be between 0 and 100.';
    if (!hasMaxTwoDecimals(n)) return 'Input allows up to 2 decimal places.';
  }

  if (cost.inputType === 'number') {
    if (n < 0 || n > 2147483647) return 'Input must be between 0 and 2147483647.';
    if (!Number.isInteger(n)) return 'Input must be a whole number.';
  }

  return true;
}

function validateStartDate(value: unknown, row: unknown): boolean | string {
  const cost = row as CostRow;
  if (!value) return true;
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Invalid date.';
  if (compareMonthIso(date, PROJECT_START) < 0) return 'Date must be after or equal to the project start date.';
  if (cost.end && compareMonthIso(date, cost.end) > 0) return 'Date must be before or equal to the end date.';
  return true;
}

function validateEndDate(value: unknown, row: unknown): boolean | string {
  const cost = row as CostRow;
  if (!value) return true;
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Invalid date.';
  if (compareMonthIso(date, PROJECT_END) > 0) return 'Date must be before or equal to the project end date.';
  if (cost.start && compareMonthIso(date, cost.start) < 0) return 'Date must be after or equal to the start date.';
  return true;
}

export function FsbtCost() {
  const [rows, setRows] = useState<CostRow[]>(() => INITIAL_COST_DATA);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const totalsRow = useMemo(() => buildTotalsRow(rows), [rows]);

  const handleCostDataChange = useCallback((changes: CellChange<CostRow>[]) => {
    setRows(prevRows => {
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

  const handleRowAction = useCallback((actionId: string, row: unknown) => {
    const sourceRow = row as CostRow;
    setRows(prevRows => {
      if (actionId === 'add') return insertCustomCostRow(prevRows, sourceRow);
      if (actionId === 'delete') return deleteCustomCostRow(prevRows, sourceRow);
      return prevRows;
    });
  }, []);

  const validateLandCostPercentTotal = useCallback((value: unknown, row: unknown): boolean | string => {
    const cost = row as CostRow;
    if (cost.parentId !== 1 || cost.inputType !== 'percent') return true;

    const n = Number(value);
    if (!Number.isFinite(n)) return true;

    const total = rowsRef.current.reduce((sum, candidate) => {
      if (candidate.parentId !== 1 || candidate.inputType !== 'percent') return sum;
      const input = candidate.id === cost.id ? n : Number(candidate.input ?? 0);
      return sum + (Number.isFinite(input) ? input : 0);
    }, 0);

    return total <= 100 || 'Land Cost percentage inputs must total 100 or less.';
  }, []);

  const columns = useMemo<ColumnDef<CostRow>[]>(
    () => [
      // ── Col 0: Menu — Wiseway's add/delete ⋮ (handled by rowActions plugin) ──
      {
        id: 'actions', header: '', width: 50, editable: false,
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
        rules: [{ validate: (v: unknown) => !v || String(v).trim().length >= 3 || 'Name is too short. Please re-enter.' }],
      },
      // ── Col 3: Input — percent rows show number + "%" suffix; parent rows except Land Cost render empty.
      //    Editable unless the row is inputType='none' (parent rollups). Land Cost (parent with code='1') is still editable.
      {
        id: 'input', accessorKey: 'input', header: 'Input', width: 110, align: 'center' as const,
        editable: ((row: CostRow) => row.inputType !== 'none') as unknown as boolean,
        cellType: 'number' as const,
        min: 0,
        max: ((row: CostRow) => {
          if (row.code === '3.08') return 999.99;
          if (row.inputType === 'percent') return 100;
          if (row.inputType === 'number') return 2147483647;
          return undefined;
        }) as never,
        precision: ((row: CostRow) => (row.inputType === 'percent' || row.code === '3.08' ? 2 : undefined)) as never,
        rules: [{ validate: validateCostInput }, { validate: validateLandCostPercentTotal }],
        prefix: (row: CostRow) => (row.inputType === 'number' ? '$' : undefined),
        unit: (row: CostRow) => (row.inputType === 'percent' ? '%' : undefined),
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          // Parent rows (except Land Cost, code='1') render empty — Wiseway's convention.
          const isParent = row.parentId === null;
          const isParentWithoutInput = isParent && row.code !== '1';
          if (isParentWithoutInput || row.inputType === 'none') {
            container.textContent = '';
            return;
          }
          if (row.input === null) {
            container.textContent = '';
            return;
          }
          container.textContent = row.inputType === 'percent' ? row.input.toFixed(2) : formatAU(row.input);
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Col 4: Input Note — derived from code via Wiseway's getCostInputNote() ──
      {
        id: 'inputNote', header: '', width: 140, align: 'left' as const, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.textContent = getCostInputNote(row.code);
        },
        cellStyle: inputNoteCellStyle,
      },
      // ── Col 5: Escalation — native Better Grid select (CPI / Non-CPI).
      {
        id: 'escalation', accessorKey: 'escalation', header: 'Escalation', width: 110, align: 'center' as const,
        editable: ((row: CostRow) => row.parentId !== null && row.escalation !== 'none') as unknown as boolean,
        cellEditor: 'select' as const,
        options: [...ESCALATION_OPTIONS],
        valueFormatter: (value) => ESCALATION_OPTIONS.find(option => option.value === value)?.label ?? '',
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
      // ── Col 7: Start — masked MM/YY input, matches FsbtProgram's Start column styling ──
      {
        id: 'start', accessorKey: 'start', header: 'Start', width: 85, placeholder: 'MM/YY',
        cellEditor: 'masked' as const, mask: 'MM/YY',
        editable: ((row: CostRow) => row.parentId !== null) as unknown as boolean,
        rules: [{ validate: validateStartDate }],
        valueFormatter: formatIsoToMMYY,
        valueParser: parseMMYYToIso,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          const isParent = row.parentId === null;
          container.textContent = row.start ? formatMonYY(row.start) : '';
          container.style.fontSize = FSBT_STYLES.infoFontSize;
          container.style.fontWeight = isParent ? FSBT_STYLES.parentFontWeight : FSBT_STYLES.childFontWeight;
          container.style.color = FSBT_STYLES.childText;
          container.style.backgroundColor = isParent ? FSBT_STYLES.parentRowBg : '';
          if (isParent) container.style.paddingLeft = '14px';
        },
      },
      // ── Col 8: End — masked MM/YY input, matches Program styling ──
      {
        id: 'end', accessorKey: 'end', header: 'End', width: 85, placeholder: 'MM/YY',
        cellEditor: 'masked' as const, mask: 'MM/YY',
        editable: ((row: CostRow) => row.parentId !== null) as unknown as boolean,
        rules: [{ validate: validateEndDate }],
        valueFormatter: formatIsoToMMYY,
        valueParser: parseMMYYToIso,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          const isParent = row.parentId === null;
          container.textContent = row.end ? formatMonYY(row.end) : '';
          container.style.fontSize = FSBT_STYLES.infoFontSize;
          container.style.fontWeight = isParent ? FSBT_STYLES.parentFontWeight : FSBT_STYLES.childFontWeight;
          container.style.color = isParent ? FSBT_STYLES.parentText : FSBT_STYLES.childText;
          container.style.backgroundColor = isParent ? FSBT_STYLES.parentRowBg : '';
          container.style.paddingLeft = '14px';
        },
      },
      // ── Col 9: Variance (read-only, computed) ──
      {
        id: 'variance', accessorKey: 'variance', header: 'Variance', width: 85, align: 'center' as const, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.textContent = typeof row.variance === 'number' ? formatAU(Math.round(row.variance)) : '';
        },
        cellStyle: parentRowCellStyle,
      },
      // ── Col 10: Variance status — valid/warning/empty circle icon ──
      {
        id: 'varianceStatus', header: '', width: 44, editable: false,
        cellRenderer: (container, ctx) => {
          const row = ctx.row as CostRow;
          container.style.backgroundColor = row.parentId === null ? FSBT_STYLES.parentRowBg : '';
          renderVarianceStatusIcon(container, typeof row.variance === 'number' ? row.variance : undefined);
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
    [validateLandCostPercentTotal],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-AU', currencyCode: 'AUD', accountingFormat: true }),
      // inputStyle: true makes editable cells always look like inputs/dropdowns (matching Wiseway), even when not focused.
      editing({ editTrigger: 'click', inputStyle: true, precision: 0 }),
      sorting(),
      hierarchy({ toggleColumn: 'collapse', toggleStyle: 'chevron' }),
      rowActions({
        column: 'actions',
        getActions: (row): RowAction[] | undefined => {
          const r = row as CostRow;
          if (r.parentId === null) return undefined;

          const customCount = rowsRef.current.filter(candidate => candidate.parentId === r.parentId && candidate.custom).length;
          const actions: RowAction[] = [
            {
              id: 'add',
              label: 'Add',
              icon: RowActionIcons.plus,
              disabled: customCount >= COST_PARENT_MAX_CUSTOM_ROWS,
              disabledTooltip: 'You have reached the maximum row limit.',
            },
          ];

          const othersLength = rowsRef.current.filter(candidate => candidate.code.startsWith('13.')).length;
          if (r.custom && (!r.code.startsWith('13') || othersLength > 1)) {
            actions.push({ id: 'delete', label: 'Delete', icon: RowActionIcons.trash });
          }

          return actions;
        },
        onAction: handleRowAction,
      }),
      cellRenderers(),
      validation(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'fsbt-cost-breakdown' }),
    ],
    [handleRowAction],
  );

  const pinnedBottomRows = useMemo(() => [totalsRow], [totalsRow]);

  const { grid, containerRef } = useGrid<CostRow>({
    data: rows,
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
    headerHeight: FSBT_STYLES.headerHeight,
    rowHeight: FSBT_STYLES.rowHeight,
    getRowStyle: parentRowStyle,
    onDataChange: handleCostDataChange,
  });

  const handleExpandAll = useCallback(() => grid.expandAll(), [grid]);
  const handleCollapseAll = useCallback(() => grid.collapseAll(), [grid]);
  const handleExport = useCallback(() => grid.plugins.export?.exportToCsv(), [grid]);

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
          <IconButton title="Expand All" onClick={handleExpandAll}><ExpandAllIcon /></IconButton>
          <IconButton title="Collapse All" onClick={handleCollapseAll}><CollapseAllIcon /></IconButton>
          <IconButton title="Export" onClick={handleExport}><ExportIcon /></IconButton>
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
