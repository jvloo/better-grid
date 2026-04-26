import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { BetterGrid, defineColumn as col, useGrid } from '@better-grid/react';
import { useGridForm } from '@better-grid/react/rhf';
import type { ColumnDef } from '@better-grid/core';
import {
  autoDetect,
  type ClipboardApi,
  type ExportApi,
  type FilteringApi,
  type GroupingApi,
  type PaginationApi,
  type SearchApi,
  type SortingApi,
  type UndoRedoApi,
  type ValidationApi,
} from '@better-grid/plugins';
import {
  aggregation,
  gantt,
  mergeCells,
  proRenderers,
  rowActions,
  RowActionIcons,
  type RowAction,
} from '@better-grid/pro';
import '@better-grid/core/styles.css';

type FreeApis = {
  clipboard?: ClipboardApi;
  export?: ExportApi;
  filtering?: FilteringApi;
  pagination?: PaginationApi;
  search?: SearchApi;
  sorting?: SortingApi;
  undoRedo?: UndoRedoApi;
  validation?: ValidationApi;
};

interface QaEditRow {
  id: number;
  item: string;
  notes: string;
  quantity: number;
  unitCost: number;
  margin: number;
  alwaysPct: number;
  period: string;
  startDate: string;
  endDate: string;
  category: string;
  phase: string;
  region: string;
  owner: string;
  escalation: 'None' | 'CPI' | { type: 'Custom'; rate: number };
  forecast: number;
  actual: number;
  variance: number;
  taxRate: number;
  lockedCode: string;
  longCode: string;
  approved: boolean;
}

const categoryValues = ['Cost', 'Revenue', 'Risk', 'Neutral'] as const;
const phaseValues = ['Land', 'Design', 'Authority', 'Construction', 'Sales', 'Handover'] as const;
const regionValues = ['North', 'South', 'East', 'West', 'Central'] as const;
const ownerValues = ['Xavier', 'Maya', 'Chen', 'Aisha', 'Rina', 'Omar', 'Priya', 'Daniel'] as const;

const qaEditSeedRows: QaEditRow[] = [
  {
    id: 1,
    item: 'Land Cost',
    notes: 'Long clipped text: acquisition package includes valuation, legal, stamp duty, survey and contingency notes',
    quantity: 12,
    unitCost: 2700000,
    margin: 0.125,
    alwaysPct: 0.075,
    period: '01/26',
    startDate: '2026-01-15',
    endDate: '2026-04-30',
    category: 'Cost',
    phase: 'Land',
    region: 'Central',
    owner: 'Xavier',
    escalation: { type: 'Custom', rate: 0.045 },
    forecast: 2750000,
    actual: 2700000,
    variance: 50000,
    taxRate: 0.06,
    lockedCode: 'LC-001',
    longCode: 'LAND-COST-PACKAGE-LEGAL-STAMP-DUTY-SURVEY-CONTINGENCY-2026',
    approved: true,
  },
  {
    id: 2,
    item: 'Construction',
    notes: 'Boundary max test: quantity is intentionally too high until edited',
    quantity: 640,
    unitCost: 1225000,
    margin: 0.08,
    alwaysPct: 0.035,
    period: '02/26',
    startDate: '2026-03-01',
    endDate: '2026-02-15',
    category: 'Risk',
    phase: 'Construction',
    region: 'North',
    owner: 'Maya',
    escalation: 'CPI',
    forecast: 1180000,
    actual: 1225000,
    variance: -45000,
    taxRate: 0.08,
    lockedCode: 'CN-002',
    longCode: 'CONSTRUCTION-BOUNDARY-MAX-QUANTITY-VALIDATION-ROW',
    approved: false,
  },
  {
    id: 3,
    item: '',
    notes: 'Required-name validation starts active on this row',
    quantity: -5,
    unitCost: -12500,
    margin: 0,
    alwaysPct: 0,
    period: '13/26',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    category: 'Revenue',
    phase: 'Sales',
    region: 'South',
    owner: 'Chen',
    escalation: 'None',
    forecast: 18000,
    actual: -12500,
    variance: 30500,
    taxRate: 1.2,
    lockedCode: 'RV-003',
    longCode: 'REQUIRED-NAME-NEGATIVE-COST-INVALID-PERIOD-TAX-EDGE',
    approved: true,
  },
  {
    id: 4,
    item: 'Marketing Launch',
    notes: 'Autocomplete accepts a new owner value, dropdowns should remain keyboard reachable',
    quantity: 80,
    unitCost: 45000,
    margin: 0.225,
    alwaysPct: 0.115,
    period: '12/26',
    startDate: '2026-07-01',
    endDate: '2026-11-15',
    category: 'Revenue',
    phase: 'Sales',
    region: 'East',
    owner: 'Aisha',
    escalation: { type: 'Custom', rate: 0.09 },
    forecast: 52000,
    actual: 45000,
    variance: 7000,
    taxRate: 0.11,
    lockedCode: 'ML-004',
    longCode: 'MARKETING-LAUNCH-AUTOCOMPLETE-CREATED-OWNER-KEYBOARD-REACHABLE',
    approved: false,
  },
];

const generatedQaEditRows: QaEditRow[] = Array.from({ length: 52 }, (_, index) => {
  const id = index + qaEditSeedRows.length + 1;
  const month = (index % 12) + 1;
  const startMonth = String(month).padStart(2, '0');
  const endMonth = String(Math.min(12, month + 1)).padStart(2, '0');
  const category = categoryValues[index % categoryValues.length]!;
  const phase = phaseValues[index % phaseValues.length]!;
  const forecast = 75000 + index * 28750;
  const actual = forecast + (index % 4 === 0 ? -12500 : 18500);

  return {
    id,
    item: `${phase} Item ${id}`,
    notes: index % 5 === 0
      ? `Overflow QA row ${id}: this sentence is intentionally long enough to clip, float the editor, and preserve cursor position while testing horizontal scroll.`
      : `Routine QA row ${id}`,
    quantity: index % 17 === 0 ? 501 : (index * 13) % 480,
    unitCost: index % 19 === 0 ? -2500 : 15000 + index * 4200,
    margin: ((index % 24) + 1) / 100,
    alwaysPct: ((index % 18) + 1) / 100,
    period: index % 23 === 0 ? '00/26' : `${startMonth}/26`,
    startDate: `2026-${startMonth}-01`,
    endDate: index % 29 === 0 ? `2026-${startMonth}-01` : `2026-${endMonth}-20`,
    category,
    phase,
    region: regionValues[index % regionValues.length]!,
    owner: ownerValues[index % ownerValues.length]!,
    escalation: index % 4 === 0 ? { type: 'Custom', rate: ((index % 9) + 1) / 100 } : (index % 3 === 0 ? 'None' : 'CPI'),
    forecast,
    actual,
    variance: forecast - actual,
    taxRate: index % 31 === 0 ? 1.1 : ((index % 12) + 1) / 100,
    lockedCode: `${phase.slice(0, 2).toUpperCase()}-${String(id).padStart(3, '0')}`,
    longCode: `${phase.toUpperCase()}-${regionValues[index % regionValues.length]!.toUpperCase()}-QA-${String(id).padStart(3, '0')}-LONG-CODE-WITH-ELLIPSIS-CHECK`,
    approved: index % 2 === 0,
  };
});

const qaEditRows: QaEditRow[] = [...qaEditSeedRows, ...generatedQaEditRows];

const categoryOptions = [
  ...categoryValues.map((value) => ({ label: value, value })),
];

const phaseOptions = phaseValues.map((value) => ({ label: value, value }));
const regionOptions = regionValues.map((value) => ({ label: value, value }));

const escalationOptions = [
  { label: 'None', value: 'None' },
  { label: 'CPI', value: 'CPI' },
  { label: 'Custom', value: 'Custom' },
];

function parsePercentInput(value: string, previous = 0): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-') return previous;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return previous;
  return num > 1 ? num / 100 : num;
}

function formatEscalation(value: QaEditRow['escalation']): string {
  if (typeof value === 'object') return `Custom ${(value.rate * 100).toFixed(2)}%`;
  return value;
}

function makeQaEditColumns(): ColumnDef<QaEditRow>[] {
  return [
    col.text('item', {
      headerName: 'Input',
      width: 150,
      sortable: true,
      required: true,
      inputEllipsis: true,
      placeholder: 'Required',
      validationMessageRenderer: (issue) => `Input name is required (${issue.code})`,
    }),
    col.text('notes', {
      headerName: 'Overflow Notes',
      width: 170,
      sortable: true,
      inputEllipsis: true,
      placeholder: 'Click clipped text',
    }),
    col.number('quantity', {
      headerName: 'Qty 0-500',
      width: 110,
      cellEditor: 'number',
      precision: 0,
      min: 0,
      max: 500,
      sortable: true,
      rules: [{ validate: (value) => Number(value) >= 0 && Number(value) <= 500 || 'Quantity must stay between 0 and 500' }],
    }),
    col.currency('unitCost', {
      headerName: 'Unit Cost',
      width: 130,
      precision: 0,
      prefix: '$',
      sortable: true,
      rules: [{ validate: (value) => Number(value) >= 0 || 'Cost cannot be negative' }],
      meta: { negativeColor: '#c2410c' },
    }),
    col.currency('forecast', {
      headerName: 'Forecast',
      width: 125,
      precision: 0,
      prefix: '$',
      sortable: true,
      rules: [{ validate: (value) => Number(value) >= 0 || 'Forecast cannot be negative' }],
    }),
    col.currency('actual', {
      headerName: 'Actual',
      width: 120,
      precision: 0,
      prefix: '$',
      sortable: true,
      rules: [{ validate: (value) => Number(value) >= 0 || 'Actual cannot be negative' }],
    }),
    col.changeIndicator('variance', {
      headerName: 'Variance',
      width: 115,
      editable: false,
      sortable: true,
    }),
    col.percent('margin', {
      headerName: 'Margin',
      width: 110,
      precision: 2,
      suffix: '%',
      sortable: true,
      valueParser: (value, row) => parsePercentInput(value, row.margin),
      rules: [{ validate: (value) => Number(value) >= 0 && Number(value) <= 1 || 'Margin must be 0% to 100%' }],
    }),
    col.percent('alwaysPct', {
      headerName: 'Always Input',
      width: 126,
      precision: 2,
      suffix: '%',
      alwaysInput: true,
      valueParser: (value, row) => parsePercentInput(value, row.alwaysPct),
      rules: [{ validate: (value) => Number(value) >= 0 && Number(value) <= 1 || 'Always input percent must be 0% to 100%' }],
    }),
    col.percent('taxRate', {
      headerName: 'Tax %',
      width: 98,
      precision: 2,
      suffix: '%',
      valueParser: (value, row) => parsePercentInput(value, row.taxRate),
      rules: [{ validate: (value) => Number(value) >= 0 && Number(value) <= 1 || 'Tax must be 0% to 100%' }],
    }),
    col.text('period', {
      headerName: 'Period MM/YY',
      width: 116,
      cellEditor: 'masked',
      mask: 'MM/YY',
      placeholder: 'MM/YY',
      inputEditCursor: true,
      rules: [{
        validate: (value) => {
          const text = String(value ?? '');
          if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(text)) return 'Use MM/YY with month 01-12';
          return true;
        },
      }],
    }),
    col.date('startDate', {
      headerName: 'Start',
      width: 120,
      dateFormat: 'iso',
      sortable: true,
    }),
    col.date('endDate', {
      headerName: 'End >= Start',
      width: 130,
      dateFormat: 'iso',
      sortable: true,
      rules: [{
        validate: (value, row) => {
          if (!row.startDate || !value) return true;
          return new Date(String(value)).getTime() >= new Date(row.startDate).getTime()
            || 'End date must be on or after start date';
        },
      }],
    }),
    col.badge('category', {
      headerName: 'Category',
      width: 118,
      cellEditor: 'select',
      options: categoryOptions,
      sortable: true,
    }),
    col.badge('phase', {
      headerName: 'Phase',
      width: 126,
      cellEditor: 'select',
      options: phaseOptions,
      sortable: true,
    }),
    col.text('region', {
      headerName: 'Region',
      width: 112,
      cellEditor: 'select',
      options: regionOptions,
      sortable: true,
    }),
    col.text('owner', {
      headerName: 'Owner',
      width: 120,
      cellEditor: 'autocomplete',
      options: [...ownerValues],
      meta: { allowCreate: true },
    }),
    col.text('escalation', {
      headerName: 'Escalation',
      width: 170,
      cellEditor: 'selectWithInput',
      options: escalationOptions,
      selectInput: { optionValue: 'Custom', type: 'number', suffix: '%', width: 74, defaultValue: 4.5, min: -10, max: 25, precision: 2 },
      selectValue: (value) => typeof value === 'object' && value !== null ? 'Custom' : value,
      selectInputValue: (value) => typeof value === 'object' && value !== null ? Number((value as { rate: number }).rate * 100).toFixed(2) : undefined,
      parseSelectWithInputValue: ({ optionValue, inputValue }) => optionValue === 'Custom'
        ? { type: 'Custom', rate: Number(inputValue) / 100 }
        : optionValue,
      valueFormatter: (value) => formatEscalation(value as QaEditRow['escalation']),
    }),
    col.text('lockedCode', {
      headerName: 'Locked Code',
      width: 120,
      editable: false,
      inputEllipsis: true,
    }),
    col.text('longCode', {
      headerName: 'Long Code',
      width: 160,
      inputEllipsis: true,
      placeholder: 'Long identifier',
    }),
    col.boolean('approved', { headerName: 'Approved', width: 92, sortable: true }),
  ] as ColumnDef<QaEditRow>[];
}

interface RenderRow {
  id: number;
  name: string;
  status: string;
  progress: number;
  active: boolean;
  rating: number;
  change: number;
  indicator: number;
  amount: number;
  percent: number;
  date: string;
  timeline: { start: string; end: string };
  info: { text: string; tooltip: string; type?: 'info' | 'warning' | 'error' };
  link: string;
  loading: null;
  spark: number[];
  heat: number;
  circle: number;
  avatar: string;
  chart: Array<{ value: number; label: string; color?: string }>;
  slider: number;
}

const rendererSeedRows: RenderRow[] = [
  {
    id: 1,
    name: 'North Tower',
    status: 'active',
    progress: 86,
    active: true,
    rating: 5,
    change: 12.4,
    indicator: 3.1,
    amount: 7420000,
    percent: 0.61,
    date: '2026-01-15',
    timeline: { start: '2026-01-01', end: '2026-04-30' },
    info: { text: 'Healthy', tooltip: 'Ahead of planned absorption', type: 'info' },
    link: 'https://better-grid.local/north',
    loading: null,
    spark: [4, 6, 5, 9, 13, 12, 16],
    heat: 84,
    circle: 72,
    avatar: 'Xavier Loo',
    chart: [{ value: 55, label: 'Sold' }, { value: 25, label: 'Held' }, { value: 20, label: 'Open' }],
    slider: 65,
  },
  {
    id: 2,
    name: 'Retail Podium',
    status: 'pending',
    progress: 43,
    active: false,
    rating: 3,
    change: -4.8,
    indicator: -1.2,
    amount: 2380000,
    percent: 0.28,
    date: '2026-03-20',
    timeline: { start: '2026-03-01', end: '2026-09-30' },
    info: { text: 'Watch', tooltip: 'Tenant mix still moving', type: 'warning' },
    link: 'https://better-grid.local/retail',
    loading: null,
    spark: [9, 8, 7, 5, 6, 4, 5],
    heat: 42,
    circle: 44,
    avatar: 'Maya Tan',
    chart: [{ value: 35, label: 'Sold' }, { value: 30, label: 'Held' }, { value: 35, label: 'Open' }],
    slider: 41,
  },
  {
    id: 3,
    name: 'Basement Works',
    status: 'inactive',
    progress: 8,
    active: false,
    rating: 1,
    change: -22,
    indicator: -9.3,
    amount: -125000,
    percent: 0,
    date: '2025-12-08',
    timeline: { start: '2025-11-01', end: '2026-02-28' },
    info: { text: 'Blocked', tooltip: 'Design hold and authority dependency', type: 'error' },
    link: 'https://better-grid.local/basement',
    loading: null,
    spark: [12, 10, 7, 3, 2, 1, 1],
    heat: 12,
    circle: 18,
    avatar: 'Chen Wei',
    chart: [{ value: 10, label: 'Sold' }, { value: 15, label: 'Held' }, { value: 75, label: 'Open' }],
    slider: 12,
  },
];

const rendererRows: RenderRow[] = [
  ...rendererSeedRows,
  ...Array.from({ length: 33 }, (_, index): RenderRow => {
    const id = index + rendererSeedRows.length + 1;
    const progress = (index * 17) % 101;
    const direction = index % 4 === 0 ? -1 : 1;
    const name = `${phaseValues[index % phaseValues.length]} Renderer ${id}`;

    return {
      id,
      name,
      status: index % 3 === 0 ? 'active' : index % 3 === 1 ? 'pending' : 'inactive',
      progress,
      active: index % 2 === 0,
      rating: (index % 5) + 1,
      change: direction * ((index % 9) + 0.5),
      indicator: direction * ((index % 6) + 0.7),
      amount: direction * (125000 + index * 37500),
      percent: progress / 100,
      date: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 24) + 1).padStart(2, '0')}`,
      timeline: {
        start: `2026-${String((index % 8) + 1).padStart(2, '0')}-01`,
        end: `2026-${String(Math.min(12, (index % 8) + 4)).padStart(2, '0')}-28`,
      },
      info: {
        text: index % 5 === 0 ? 'Edge' : index % 2 === 0 ? 'Healthy' : 'Watch',
        tooltip: `Renderer row ${id} tooltip with overflow and hover coverage`,
        type: index % 5 === 0 ? 'error' : index % 2 === 0 ? 'info' : 'warning',
      },
      link: `https://better-grid.local/qa/${id}`,
      loading: null,
      spark: Array.from({ length: 8 }, (_, sparkIndex) => ((index + 2) * (sparkIndex + 3)) % 18),
      heat: progress,
      circle: (progress + 15) % 101,
      avatar: ownerValues[index % ownerValues.length]!,
      chart: [
        { value: Math.max(10, progress), label: 'Sold' },
        { value: 30, label: 'Held' },
        { value: Math.max(5, 100 - progress - 30), label: 'Open' },
      ],
      slider: progress,
    };
  }),
];

function makeRendererColumns(): ColumnDef<RenderRow>[] {
  return [
    col.text('name', { headerName: 'Name', width: 140 }),
    col.badge('status', {
      headerName: 'Badge',
      width: 105,
      options: [
        { label: 'Active', value: 'active', color: '#166534', bg: '#dcfce7' },
        { label: 'Pending', value: 'pending', color: '#92400e', bg: '#fef3c7' },
        { label: 'Inactive', value: 'inactive', color: '#991b1b', bg: '#fee2e2' },
      ],
    }),
    col.progress('progress', { headerName: 'Progress', width: 120 }),
    col.boolean('active', { headerName: 'Bool', width: 70 }),
    col.rating('rating', { headerName: 'Rating', width: 100 }),
    col.change('change', { headerName: 'Change', width: 95 }),
    col.changeIndicator('indicator', { headerName: 'Indicator', width: 105 }),
    col.currency('amount', { headerName: 'Currency', width: 115, precision: 0 }),
    col.percent('percent', { headerName: 'Percent', width: 90 }),
    col.date('date', { headerName: 'Date', width: 115 }),
    col.timeline('timeline', { headerName: 'Timeline', width: 150, meta: { timelineStart: '2025-11-01', timelineEnd: '2026-12-31' } }),
    col.tooltip('info', { headerName: 'Tooltip', width: 100 }),
    col.link('link', { headerName: 'Link', width: 120 }),
    col.loading('loading', { headerName: 'Loading', width: 90 }),
    col.custom('spark', { headerName: 'Sparkline', width: 130, cellType: 'sparkline', meta: { sparklineType: 'area', sparklineColor: '#0f766e' } }),
    col.custom('heat', { headerName: 'Heatmap', width: 90, cellType: 'heatmap', meta: { min: 0, max: 100, colorScale: ['#eff6ff', '#38bdf8', '#0f766e'] } }),
    col.custom('circle', { headerName: 'Circle', width: 90, cellType: 'circularProgress', meta: { max: 100 } }),
    col.custom('avatar', { headerName: 'Avatar', width: 100, cellType: 'avatar' }),
    col.custom('chart', { headerName: 'Mini Chart', width: 100, cellType: 'miniChart', meta: { chartType: 'donut' } }),
    col.custom('slider', { headerName: 'Slider', width: 130, cellType: 'slider', meta: { min: 0, max: 100 } }),
  ] as ColumnDef<RenderRow>[];
}

interface StructureRow {
  id: number;
  parentId: number | null;
  phase: string;
  task: string;
  team: string;
  budget: number;
  actual: number;
  variance: number;
  duration: number;
  progress: number;
  reviewDate: string;
  region: string;
  status: string;
}

const structureGroups = [
  { phase: 'Planning', team: 'PMO', tasks: ['Authority review', 'Design freeze', 'Land survey', 'Funding gate'] },
  { phase: 'Design', team: 'Design', tasks: ['Architecture', 'Engineering', 'Value management', 'Tender pack'] },
  { phase: 'Procurement', team: 'Commercial', tasks: ['Main contractor', 'Long lead items', 'Consultant awards', 'Variation log'] },
  { phase: 'Delivery', team: 'Construction', tasks: ['Basement', 'Tower shell', 'Facade', 'M&E rough-in', 'Fit out'] },
  { phase: 'Sales', team: 'Sales', tasks: ['Launch campaign', 'Broker incentives', 'Pricing refresh', 'CRM hygiene'] },
  { phase: 'Handover', team: 'Operations', tasks: ['Defects triage', 'Resident onboarding', 'Facilities setup', 'Authority closeout'] },
  { phase: 'Closeout', team: 'Finance', tasks: ['Final account', 'Retention release', 'Audit pack', 'Archive'] },
];

let structureId = 1;
const structureRows: StructureRow[] = structureGroups.flatMap((group, groupIndex) => {
  const parentId = structureId++;
  const children = group.tasks.map((task, taskIndex): StructureRow => {
    const budget = 60000 + groupIndex * 85000 + taskIndex * 32000;
    const actual = budget + ((groupIndex + taskIndex) % 3 === 0 ? -18000 : 24000);
    return {
      id: structureId++,
      parentId,
      phase: group.phase,
      task,
      team: taskIndex % 2 === 0 ? group.team : ownerValues[(groupIndex + taskIndex) % ownerValues.length]!,
      budget,
      actual,
      variance: budget - actual,
      duration: 15 + taskIndex * 8 + groupIndex,
      progress: ((groupIndex * 17) + (taskIndex * 11)) % 101,
      reviewDate: `2026-${String(((groupIndex + taskIndex) % 12) + 1).padStart(2, '0')}-10`,
      region: regionValues[(groupIndex + taskIndex) % regionValues.length]!,
      status: actual > budget ? 'Risk' : taskIndex % 4 === 0 ? 'Closed' : 'Open',
    };
  });
  const budget = children.reduce((sum, row) => sum + row.budget, 0);
  const actual = children.reduce((sum, row) => sum + row.actual, 0);
  return [{
    id: parentId,
    parentId: null,
    phase: group.phase,
    task: group.phase,
    team: group.team,
    budget,
    actual,
    variance: budget - actual,
    duration: children.reduce((sum, row) => sum + row.duration, 0),
    progress: Math.round(children.reduce((sum, row) => sum + row.progress, 0) / children.length),
    reviewDate: children[0]?.reviewDate ?? '2026-01-10',
    region: regionValues[groupIndex % regionValues.length]!,
    status: actual > budget ? 'Risk' : 'Open',
  }, ...children];
});

function makeStructureColumns(): ColumnDef<StructureRow>[] {
  return [
    col.text('task', { headerName: 'Task', width: 190, sortable: true }),
    col.text('phase', { headerName: 'Phase', width: 110, sortable: true }),
    col.text('team', { headerName: 'Team', width: 120, sortable: true }),
    col.currency('budget', { headerName: 'Budget', width: 120, precision: 0, sortable: true }),
    col.currency('actual', { headerName: 'Actual', width: 120, precision: 0, sortable: true }),
    col.changeIndicator('variance', { headerName: 'Variance', width: 115, sortable: true }),
    col.number('duration', { headerName: 'Days', width: 80, precision: 0, sortable: true }),
    col.progress('progress', { headerName: 'Progress', width: 120 }),
    col.date('reviewDate', { headerName: 'Review', width: 115, sortable: true }),
    col.text('region', { headerName: 'Region', width: 105, sortable: true }),
    col.badge('status', {
      headerName: 'Status',
      width: 100,
      options: [
        { label: 'Open', value: 'Open', color: '#155e75', bg: '#cffafe' },
        { label: 'Risk', value: 'Risk', color: '#9a3412', bg: '#ffedd5' },
        { label: 'Closed', value: 'Closed', color: '#166534', bg: '#dcfce7' },
      ],
    }),
  ] as ColumnDef<StructureRow>[];
}

interface AutoRow {
  id: number;
  label: string;
  rawNumber: number;
  rawInteger: number;
  rawDate: string;
  rawBool: boolean;
  mixed: string | number;
  nullable: number | null;
  textEdge: string;
}

const autoRows: AutoRow[] = Array.from({ length: 72 }, (_, index) => ({
  id: index + 1,
  label: `Auto row ${index + 1}`,
  rawNumber: index % 2 === 0 ? index * 10 + 0.5 : -index * 7,
  rawInteger: index * 1000,
  rawDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-15`,
  rawBool: index % 3 !== 0,
  mixed: index % 5 === 0 ? 'manual' : index * 3,
  nullable: index % 7 === 0 ? null : index * 2,
  textEdge: index % 8 === 0 ? '000123' : `edge-${index + 1}`,
}));

const autoColumns = [
  { id: 'label', field: 'label', headerName: 'Label', width: 130 },
  { id: 'rawNumber', field: 'rawNumber', headerName: 'Auto Number', width: 130 },
  { id: 'rawInteger', field: 'rawInteger', headerName: 'Auto Integer', width: 125 },
  { id: 'rawDate', field: 'rawDate', headerName: 'Auto Date', width: 120 },
  { id: 'rawBool', field: 'rawBool', headerName: 'Auto Bool', width: 105 },
  { id: 'mixed', field: 'mixed', headerName: 'Mixed Edge', width: 120 },
  { id: 'nullable', field: 'nullable', headerName: 'Nullable', width: 105 },
  { id: 'textEdge', field: 'textEdge', headerName: 'Text Edge', width: 120 },
] as ColumnDef<AutoRow>[];

interface ProRow {
  id: number;
  phase: string;
  task: string;
  owner: string;
  budget: number;
  actual: number;
  variance: number;
  startColumn: number;
  endColumn: number;
  start: string;
  end: string;
  duration: number;
  actions: string;
  [key: `m_${number}`]: string;
}

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const proSeedRows: ProRow[] = [
  { id: 1, phase: 'Planning', task: 'Concept design', owner: 'Maya', budget: 180000, actual: 172000, variance: 8000, startColumn: 0, endColumn: 2, start: '2026-01-01', end: '2026-03-31', duration: 3, actions: '' },
  { id: 2, phase: 'Planning', task: 'Authority lodgement', owner: 'Chen', budget: 90000, actual: 106000, variance: -16000, startColumn: 2, endColumn: 4, start: '2026-03-01', end: '2026-05-31', duration: 3, actions: '' },
  { id: 3, phase: 'Delivery', task: 'Basement works', owner: 'Aisha', budget: 580000, actual: 640000, variance: -60000, startColumn: 1, endColumn: 5, start: '2026-02-01', end: '2026-06-30', duration: 5, actions: '' },
  { id: 4, phase: 'Delivery', task: 'Tower frame', owner: 'Xavier', budget: 820000, actual: 790000, variance: 30000, startColumn: 4, endColumn: 7, start: '2026-05-01', end: '2026-08-31', duration: 4, actions: '' },
  { id: 5, phase: 'Sales', task: 'Launch campaign', owner: 'Maya', budget: 210000, actual: 198000, variance: 12000, startColumn: 3, endColumn: 6, start: '2026-04-01', end: '2026-07-31', duration: 4, actions: '' },
  { id: 6, phase: 'Sales', task: 'Broker suite', owner: 'Rina', budget: 160000, actual: 176000, variance: -16000, startColumn: 6, endColumn: 10, start: '2026-07-01', end: '2026-11-30', duration: 5, actions: '' },
  { id: 7, phase: 'Handover', task: 'Defects triage', owner: 'Omar', budget: 120000, actual: 99000, variance: 21000, startColumn: 8, endColumn: 11, start: '2026-09-01', end: '2026-12-31', duration: 4, actions: '' },
  { id: 8, phase: 'Closeout', task: 'Final account', owner: 'Priya', budget: 95000, actual: 103000, variance: -8000, startColumn: 9, endColumn: 11, start: '2026-10-01', end: '2026-12-31', duration: 3, actions: '' },
];

const generatedProRows: ProRow[] = Array.from({ length: 24 }, (_, index) => {
  const id = index + proSeedRows.length + 1;
  const phase = phaseValues[index % phaseValues.length]!;
  const startColumn = index % 10;
  const duration = (index % 4) + 2;
  const endColumn = Math.min(monthLabels.length - 1, startColumn + duration);
  const budget = 140000 + index * 47000;
  const actual = budget + (index % 3 === 0 ? 26000 : -18000);

  return {
    id,
    phase,
    task: `${phase} pro task ${id}`,
    owner: ownerValues[index % ownerValues.length]!,
    budget,
    actual,
    variance: budget - actual,
    startColumn,
    endColumn,
    start: `2026-${String(startColumn + 1).padStart(2, '0')}-01`,
    end: `2026-${String(endColumn + 1).padStart(2, '0')}-28`,
    duration: endColumn - startColumn + 1,
    actions: '',
  };
});

const proRows: ProRow[] = [
  ...proSeedRows,
  ...generatedProRows,
].map((row) => {
  const next = { ...row } as ProRow;
  for (let i = 0; i < monthLabels.length; i++) next[`m_${i}`] = '';
  return next;
});

function makeProColumns(): ColumnDef<ProRow>[] {
  return [
    {
      id: 'actions',
      field: 'actions',
      headerName: 'Actions',
      width: 74,
      editable: false,
      cellRenderer: (container) => {
        container.textContent = '...';
        container.style.color = '#667085';
        container.style.textAlign = 'center';
        container.style.background = '#fafafa';
      },
    },
    col.text('phase', { headerName: 'Phase', width: 110 }),
    col.text('task', { headerName: 'Task', width: 160 }),
    col.text('owner', { headerName: 'Owner', width: 105 }),
    col.currency('budget', { headerName: 'Budget', width: 115, precision: 0 }),
    col.currency('actual', { headerName: 'Actual', width: 115, precision: 0 }),
    col.changeIndicator('variance', { headerName: 'Variance', width: 105, editable: false }),
    ...monthLabels.map((month, index) => col.custom(`m_${index}`, {
      headerName: month,
      width: 74,
      align: 'center',
      cellType: 'gantt',
      editable: false,
    } as Partial<ColumnDef<ProRow>> & Record<string, unknown>)),
  ] as ColumnDef<ProRow>[];
}

const proMerges = [
  { row: 0, col: 1, rowSpan: 2 },
  { row: 2, col: 1, rowSpan: 2 },
];

const pageShell: CSSProperties = {
  display: 'grid',
  gap: 28,
  paddingBottom: 32,
};

const introStyle: CSSProperties = {
  color: '#475467',
  fontSize: 14,
  lineHeight: 1.6,
  margin: '4px 0 0',
  maxWidth: 980,
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
};

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
};

const buttonStyle: CSSProperties = {
  border: '1px solid #d0d5dd',
  borderRadius: 6,
  background: '#fff',
  color: '#344054',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  padding: '7px 10px',
};

const statusStyle: CSSProperties = {
  color: '#667085',
  fontSize: 12,
  minHeight: 18,
};

const gridFrameStyle: CSSProperties = {
  border: '1px solid #d0d5dd',
  borderRadius: 8,
  overflow: 'hidden',
  background: '#fff',
};

function Section({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section style={sectionStyle}>
      <div>
        <h2 style={{ fontSize: 18, margin: 0, color: '#101828' }}>{title}</h2>
        <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13, lineHeight: 1.5 }}>{detail}</p>
      </div>
      {children}
    </section>
  );
}

function ToolbarButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" style={buttonStyle} onClick={onClick}>{children}</button>;
}

function FeatureGrid() {
  const [rows, setRows] = useState(qaEditRows);
  const [status, setStatus] = useState('Ready. Invalid seed rows are intentional.');
  const columns = useMemo(makeQaEditColumns, []);

  const grid = useGrid<QaEditRow>({
    data: rows,
    columns,
    mode: 'view',
    features: {
      format: { locale: 'en-US', currencyCode: 'USD', accountingFormat: true },
      edit: { editTrigger: 'click', inputStyle: true, editorMode: 'inline', inputEllipsis: true, inputEditCursor: true },
      sort: { multiSort: true, maxSortColumns: 4 },
      filter: true,
      search: true,
      clipboard: { includeHeaders: true },
      undo: { maxHistory: 20 },
      validation: { validateOn: 'all' },
      export: { filename: 'better-grid-qa-matrix' },
    },
    selection: { mode: 'range', multiRange: true, fillHandle: true },
    rowHeight: 42,
    virtualization: { overscanRows: 4, overscanColumns: 3 },
    onCellChange: (changes) => {
      setRows((prev) => {
        const next = [...prev];
        for (const change of changes) next[change.rowIndex] = change.row as QaEditRow;
        return next;
      });
      setStatus(`Changed ${changes.map((c) => `${c.columnId}@${c.rowIndex + 1}`).join(', ')}`);
    },
  });

  const apis = grid.api.plugins as FreeApis;

  const validateAll = useCallback(() => {
    const errors = apis.validation?.validate() ?? [];
    setStatus(`Validation found ${errors.length} issue(s): ${errors.slice(0, 3).map((e) => e.message).join(' | ') || 'none'}`);
  }, [apis.validation]);

  const clearValidation = useCallback(() => {
    apis.validation?.clearErrors();
    setStatus('Validation markers cleared.');
  }, [apis.validation]);

  const sortCost = useCallback(() => {
    apis.sorting?.setSortState([{ columnId: 'unitCost', direction: 'desc' }]);
    setStatus('Sorted Unit Cost descending.');
  }, [apis.sorting]);

  const filterRisk = useCallback(() => {
    apis.filtering?.setFilter('category', 'Risk', 'eq');
    setStatus('Filtered Category = Risk.');
  }, [apis.filtering]);

  const clearFilter = useCallback(() => {
    apis.filtering?.clearFilters();
    setStatus('Filters cleared.');
  }, [apis.filtering]);

  const runSearch = useCallback(() => {
    const count = apis.search?.search('cost') ?? 0;
    setStatus(`Search for "cost" found ${count} match(es).`);
  }, [apis.search]);

  const csvPreview = useCallback(() => {
    const csv = apis.export?.toCsvString({ separator: ',' }) ?? '';
    setStatus(`CSV preview ${csv.split('\n').length} lines, ${csv.length} chars.`);
  }, [apis.export]);

  const selectFillRange = useCallback(() => {
    grid.api.setSelection({
      active: { rowIndex: 0, colIndex: 3 },
      ranges: [{ startRow: 0, endRow: 3, startCol: 3, endCol: 3 }],
    });
    apis.clipboard?.fillDown();
    setStatus('Selected Unit Cost rows 1-4 and ran fill down.');
  }, [apis.clipboard, grid.api]);

  return (
    <Section
      title="Editing, Validation, Formatting, Sort, Filter, Search, Export"
      detail="Exercises click-to-edit, cursor placement, double-click select-all, clipped inputs, prefix/suffix adornments, select-with-input, masked period, min/max, date dependency, undo/redo, copy/fill, and CSV extraction."
    >
      <div style={toolbarStyle}>
        <ToolbarButton onClick={validateAll}>Validate all</ToolbarButton>
        <ToolbarButton onClick={clearValidation}>Clear validation</ToolbarButton>
        <ToolbarButton onClick={sortCost}>Sort cost desc</ToolbarButton>
        <ToolbarButton onClick={filterRisk}>Filter risk</ToolbarButton>
        <ToolbarButton onClick={clearFilter}>Clear filter</ToolbarButton>
        <ToolbarButton onClick={runSearch}>Search cost</ToolbarButton>
        <ToolbarButton onClick={() => { apis.search?.next(); setStatus('Moved to next search match.'); }}>Next match</ToolbarButton>
        <ToolbarButton onClick={() => { apis.undoRedo?.undo(); setStatus('Undo requested.'); }}>Undo</ToolbarButton>
        <ToolbarButton onClick={() => { apis.undoRedo?.redo(); setStatus('Redo requested.'); }}>Redo</ToolbarButton>
        <ToolbarButton onClick={selectFillRange}>Fill down</ToolbarButton>
        <ToolbarButton onClick={csvPreview}>CSV preview</ToolbarButton>
      </div>
      <div style={statusStyle}>{status}</div>
      <BetterGrid grid={grid} height={330} style={gridFrameStyle} />
    </Section>
  );
}

function RendererGrid() {
  const columns = useMemo(makeRendererColumns, []);
  const grid = useGrid<RenderRow>({
    data: rendererRows,
    columns,
    mode: 'view',
    features: {
      format: { locale: 'en-US', currencyCode: 'USD', negativeColor: '#b42318' },
      edit: { editTrigger: 'click' },
    },
    plugins: [proRenderers()],
    selection: { mode: 'range' },
    rowHeight: 44,
  });

  return (
    <Section
      title="Built-In and Pro Cell Renderers"
      detail="Covers badges, progress, booleans, ratings, change indicators, currency, percent, dates, timeline, tooltip, link, loading, sparkline, heatmap, circular progress, avatar, mini chart, and slider."
    >
      <BetterGrid grid={grid} height={250} style={gridFrameStyle} />
    </Section>
  );
}

function StructureGrid() {
  const columns = useMemo(makeStructureColumns, []);
  const totals = useMemo<StructureRow[]>(() => [{
    id: -1,
    parentId: null,
    phase: 'Totals',
    task: 'Pinned bottom total',
    team: '',
    budget: structureRows.filter((row) => row.parentId === null).reduce((sum, row) => sum + row.budget, 0),
    actual: structureRows.filter((row) => row.parentId === null).reduce((sum, row) => sum + row.actual, 0),
    variance: structureRows.filter((row) => row.parentId === null).reduce((sum, row) => sum + row.variance, 0),
    duration: structureRows.filter((row) => row.parentId === null).reduce((sum, row) => sum + row.duration, 0),
    progress: Math.round(structureRows.filter((row) => row.parentId === null).reduce((sum, row) => sum + row.progress, 0) / structureGroups.length),
    reviewDate: '2026-12-31',
    region: 'All',
    status: 'Open',
  }], []);

  const grid = useGrid<StructureRow>({
    data: structureRows,
    columns,
    mode: 'view',
    features: {
      format: { locale: 'en-US', currencyCode: 'USD' },
      hierarchy: { indentColumn: 'task', toggleColumn: 'task', toggleStyle: 'triangle' },
      sort: { multiSort: true },
      filter: true,
      grouping: {
        groupBy: [],
        aggregations: { budget: 'sum', actual: 'sum', variance: 'sum' },
        groupColumnHeader: 'Group',
        defaultExpanded: true,
      },
    },
    headers: [
      { id: 'h1', cells: [
        { id: 'plan', content: 'Work Breakdown', colSpan: 3 },
        { id: 'money', content: 'Financials', colSpan: 3 },
        { id: 'schedule', content: 'Schedule', colSpan: 3 },
        { id: 'state', content: 'State', colSpan: 2 },
      ] },
      { id: 'h2', cells: [
        { id: 'task', content: 'Task' },
        { id: 'phase', content: 'Phase' },
        { id: 'team', content: 'Team' },
        { id: 'budget', content: 'Budget' },
        { id: 'actual', content: 'Actual' },
        { id: 'variance', content: 'Variance' },
        { id: 'duration', content: 'Days' },
        { id: 'progress', content: 'Progress' },
        { id: 'review', content: 'Review' },
        { id: 'region', content: 'Region' },
        { id: 'status', content: 'Status' },
      ] },
    ],
    pinned: { bottom: totals },
    frozen: { top: 1, left: 2, clip: { minVisible: 1 } },
    hierarchy: {
      getRowId: (row) => row.id,
      getParentId: (row) => row.parentId,
      defaultExpanded: true,
    },
    selection: { mode: 'range', multiRange: true },
    rowHeight: (rowIndex) => rowIndex % 3 === 0 ? 42 : 36,
  });

  const [status, setStatus] = useState('Hierarchy starts expanded with frozen columns and pinned totals.');
  const apis = grid.api.plugins as { grouping?: GroupingApi };

  return (
    <Section
      title="Hierarchy, Grouping, Frozen Columns, Pinned Rows, Multi-Headers"
      detail="Covers tree rows, group transforms, grouped headers, frozen top/left regions, freeze clipping, variable row height, pinned totals, range and multi-range selection."
    >
      <div style={toolbarStyle}>
        <ToolbarButton onClick={() => { grid.api.expandAll(); setStatus('Hierarchy expanded.'); }}>Expand hierarchy</ToolbarButton>
        <ToolbarButton onClick={() => { grid.api.collapseAll(); setStatus('Hierarchy collapsed.'); }}>Collapse hierarchy</ToolbarButton>
        <ToolbarButton onClick={() => { apis.grouping?.setGroupBy(['phase']); setStatus('Grouped by phase.'); }}>Group by phase</ToolbarButton>
        <ToolbarButton onClick={() => { apis.grouping?.setGroupBy([]); setStatus('Grouping cleared.'); }}>Clear grouping</ToolbarButton>
        <ToolbarButton onClick={() => { grid.api.setFreezeClipWidth(130); setStatus('Freeze clip width set to 130px.'); }}>Clip frozen</ToolbarButton>
        <ToolbarButton onClick={() => { grid.api.setFreezeClipWidth(null); setStatus('Freeze clip cleared.'); }}>Clear clip</ToolbarButton>
      </div>
      <div style={statusStyle}>{status}</div>
      <BetterGrid grid={grid} height={330} style={gridFrameStyle} />
    </Section>
  );
}

function PaginationAutoDetectGrid() {
  const [status, setStatus] = useState('Auto-detect should infer number, date and boolean columns.');
  const grid = useGrid<AutoRow>({
    data: autoRows,
    columns: autoColumns,
    mode: 'view',
    features: {
      format: { locale: 'en-US', currencyCode: 'USD' },
      pagination: { pageSize: 6, pageSizeOptions: [3, 6, 9] },
      search: true,
      export: { filename: 'auto-detect-page' },
    },
    plugins: [autoDetect({ sampleSize: 12 })],
    selection: { mode: 'range' },
    rowHeight: 36,
  });
  const apis = grid.api.plugins as FreeApis;

  return (
    <Section
      title="Pagination and Auto-Detect"
      detail="Covers inferred cell types and alignment, page size controls, page navigation, search on paged data, and export over the current plugin-shaped data."
    >
      <div style={toolbarStyle}>
        <ToolbarButton onClick={() => { apis.pagination?.nextPage(); setStatus(`Page ${Number(apis.pagination?.getPage() ?? 0) + 1} of ${apis.pagination?.getPageCount() ?? 1}`); }}>Next page</ToolbarButton>
        <ToolbarButton onClick={() => { apis.pagination?.prevPage(); setStatus(`Page ${Number(apis.pagination?.getPage() ?? 0) + 1} of ${apis.pagination?.getPageCount() ?? 1}`); }}>Previous page</ToolbarButton>
        <ToolbarButton onClick={() => { const count = apis.search?.search('auto') ?? 0; setStatus(`Search found ${count} paged match(es).`); }}>Search auto</ToolbarButton>
        <ToolbarButton onClick={() => { const csv = apis.export?.toCsvString() ?? ''; setStatus(`Export preview ${csv.length} chars.`); }}>Export preview</ToolbarButton>
      </div>
      <div style={statusStyle}>{status}</div>
      <BetterGrid grid={grid} height={250} style={{ ...gridFrameStyle, borderRadius: '8px 8px 0 0' }} />
    </Section>
  );
}

function ProGrid() {
  const [rows, setRows] = useState(proRows);
  const [status, setStatus] = useState('Row actions, merge cells, pinned aggregation and Gantt are active.');
  const columns = useMemo(makeProColumns, []);

  const plugins = useMemo(() => [
    rowActions({
      column: 'actions',
      getActions: (row): RowAction[] => {
        const r = row as ProRow;
        return [
          { id: 'add', label: `Add under ${r.phase}`, icon: RowActionIcons.plus },
          { id: 'delete', label: 'Delete row', icon: RowActionIcons.trash, disabled: r.actual > r.budget, disabledTooltip: 'Disabled when actual exceeds budget' },
        ];
      },
      onAction: (actionId, row) => setStatus(`Row action "${actionId}" on ${(row as ProRow).task}`),
    }),
    mergeCells({ cells: proMerges }),
    aggregation<ProRow>({
      pinnedBottom: [
        { id: 'total', label: 'Aggregate total', labelField: 'task', fn: 'sum', fields: ['budget', 'actual', 'variance'] },
      ],
    }),
    gantt({
      dateColumnPrefix: 'm_',
      startColumnField: 'startColumn',
      endColumnField: 'endColumn',
      varianceField: 'variance',
      startDateField: 'start',
      endDateField: 'end',
      durationField: 'duration',
      columnToDate: (columnIndex) => `2026-${String(columnIndex + 1).padStart(2, '0')}-01`,
      colors: { neutral: '#0ea5e9', ahead: '#16a34a', late: '#dc2626' },
    }),
  ], []);

  const grid = useGrid<ProRow>({
    data: rows,
    columns,
    mode: 'view',
    features: {
      format: { locale: 'en-US', currencyCode: 'USD', accountingFormat: true },
      edit: { editTrigger: 'click', inputStyle: true },
      export: { filename: 'pro-qa-matrix' },
    },
    plugins,
    frozen: { left: 7, clip: { minVisible: 2 } },
    selection: { mode: 'range', fillHandle: true },
    rowHeight: 40,
    onCellChange: (changes) => {
      setRows((prev) => {
        const next = [...prev];
        for (const change of changes) next[change.rowIndex] = change.row as ProRow;
        return next;
      });
      setStatus(`Pro grid changed ${changes.length} cell(s).`);
    },
  });

  const exportCsv = useCallback(() => {
    const csv = (grid.api.plugins as FreeApis).export?.toCsvString() ?? '';
    setStatus(`Pro export preview ${csv.split('\n').length} lines with merge metadata available for Excel.`);
  }, [grid.api.plugins]);

  return (
    <Section
      title="Pro Plugins: Row Actions, Merge Cells, Aggregation, Gantt"
      detail="Covers action menu mechanics, merged body cells, computed pinned totals, frozen program columns, Gantt bars, drag state, and export soft integration."
    >
      <div style={toolbarStyle}>
        <ToolbarButton onClick={exportCsv}>Pro CSV preview</ToolbarButton>
        <ToolbarButton onClick={() => { grid.api.setFreezeClipWidth(210); setStatus('Pro frozen section clipped to 210px.'); }}>Clip frozen</ToolbarButton>
        <ToolbarButton onClick={() => { grid.api.setFreezeClipWidth(null); setStatus('Pro frozen clip cleared.'); }}>Clear clip</ToolbarButton>
      </div>
      <div style={statusStyle}>{status}</div>
      <BetterGrid grid={grid} height={310} style={gridFrameStyle} />
    </Section>
  );
}

// ─── Section 6: Clipboard, Fill, Undo/Redo ───────────────────────────────────

interface ClipRow { id: number; label: string; amount: number; currency: string; date: string; status: string }

const clipSeedRows: ClipRow[] = [
  { id: 1, label: 'Alpha', amount: 1000, currency: 'USD', date: '2026-01-10', status: 'Open' },
  { id: 2, label: 'Beta', amount: 2500, currency: 'AUD', date: '2026-02-14', status: 'Closed' },
  { id: 3, label: 'Gamma', amount: 750, currency: 'USD', date: '2026-03-05', status: 'Open' },
  { id: 4, label: 'Delta', amount: 4200, currency: 'GBP', date: '2026-04-20', status: 'Pending' },
  { id: 5, label: 'Epsilon', amount: 900, currency: 'USD', date: '2026-05-01', status: 'Open' },
  { id: 6, label: 'Zeta', amount: 1800, currency: 'AUD', date: '2026-06-15', status: 'Closed' },
  { id: 7, label: 'Eta', amount: 3300, currency: 'USD', date: '2026-07-08', status: 'Pending' },
  { id: 8, label: 'Theta', amount: 5500, currency: 'GBP', date: '2026-08-22', status: 'Open' },
];

const clipColumns: ColumnDef<ClipRow>[] = [
  col.text('label', { headerName: 'Label', width: 120, editable: true }),
  col.number('amount', { headerName: 'Amount', width: 110, precision: 0, editable: true }),
  col.text('currency', { headerName: 'Currency', width: 110, editable: true, cellEditor: 'select', options: [{ label: 'USD', value: 'USD' }, { label: 'AUD', value: 'AUD' }, { label: 'GBP', value: 'GBP' }] }),
  col.date('date', { headerName: 'Date', width: 120, editable: true }),
  col.text('status', { headerName: 'Status', width: 110, cellEditor: 'select', options: [{ label: 'Open', value: 'Open' }, { label: 'Closed', value: 'Closed' }, { label: 'Pending', value: 'Pending' }], editable: true }),
] as ColumnDef<ClipRow>[];

function ClipboardUndoGrid() {
  const [rows, setRows] = useState(clipSeedRows);
  const [status, setStatus] = useState('Edit cells, copy ranges, fill down, undo or redo.');

  const grid = useGrid<ClipRow>({
    data: rows,
    columns: clipColumns,
    mode: 'view',
    features: {
      format: { locale: 'en-US', currencyCode: 'USD' },
      edit: { editTrigger: 'dblclick' },
      clipboard: true,
      undo: { maxHistory: 50 },
    },
    selection: { mode: 'range', fillHandle: true },
    rowHeight: 36,
    onCellChange: (changes) => {
      setRows((prev) => {
        const next = [...prev];
        for (const ch of changes) next[ch.rowIndex] = ch.row as ClipRow;
        return next;
      });
      setStatus(`Changed ${changes.map((c) => `${c.columnId}@r${c.rowIndex + 1}`).join(', ')}`);
    },
  });

  const apis = grid.api.plugins as { undoRedo?: UndoRedoApi; clipboard?: ClipboardApi };

  return (
    <Section
      title="Clipboard, Fill, Undo/Redo"
      detail="Verifies clipboard copy/paste, fill-down via fill handle, undo/redo stack, and select-all range. Uses dblclick-to-edit and range selection."
    >
      <div style={toolbarStyle}>
        <ToolbarButton onClick={() => { apis.undoRedo?.undo(); setStatus('Undo requested.'); }}>Undo (⌘Z)</ToolbarButton>
        <ToolbarButton onClick={() => { apis.undoRedo?.redo(); setStatus('Redo requested.'); }}>Redo (⇧⌘Z)</ToolbarButton>
        <ToolbarButton onClick={() => {
          const rowCount = rows.length;
          const colCount = clipColumns.length;
          grid.api.setSelection({
            active: { rowIndex: 0, colIndex: 0 },
            ranges: [{ startRow: 0, endRow: rowCount - 1, startCol: 0, endCol: colCount - 1 }],
          });
          setStatus('Selected all cells.');
        }}>Select all</ToolbarButton>
        <ToolbarButton onClick={() => {
          const rowCount = rows.length;
          const colCount = clipColumns.length;
          grid.api.setSelection({
            active: { rowIndex: 0, colIndex: 0 },
            ranges: [{ startRow: 0, endRow: rowCount - 1, startCol: 0, endCol: colCount - 1 }],
          });
          document.execCommand('copy');
          setStatus('Copied all cells to clipboard.');
        }}>Copy</ToolbarButton>
        <ToolbarButton onClick={() => {
          grid.api.setSelection({
            active: { rowIndex: 0, colIndex: 0 },
            ranges: [{ startRow: 0, endRow: rows.length - 1, startCol: 0, endCol: clipColumns.length - 1 }],
          });
          const empty = rows.map((r) => ({ ...r, label: '', amount: 0, currency: '', date: '', status: '' }));
          setRows(empty);
          setStatus('Cleared all cell values.');
        }}>Clear all</ToolbarButton>
        <span style={{ fontSize: 12, color: '#667085', fontStyle: 'italic' }}>
          <kbd style={{ background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 3, padding: '1px 4px', fontSize: 11 }}>Tip</kbd>
          {' '}Copy a cell, paste below, or select a range and Ctrl+D to fill down.
        </span>
      </div>
      <div style={statusStyle}>{status}</div>
      <BetterGrid grid={grid} height={300} style={gridFrameStyle} />
    </Section>
  );
}

// ─── Section 7: RHF Bridge ────────────────────────────────────────────────────

interface RhfQaRow { id: number; name: string; qty: number; rate: number }
interface RhfQaForm { items: RhfQaRow[] }

const rhfQaSeed: RhfQaRow[] = [
  { id: 1, name: 'Alpha', qty: 10, rate: 25.5 },
  { id: 2, name: 'Beta', qty: 5, rate: 48 },
  { id: 3, name: 'Gamma', qty: 20, rate: 12.75 },
  { id: 4, name: 'Delta', qty: 8, rate: 99.99 },
];

const rhfQaColumns: ColumnDef<RhfQaRow>[] = [
  col.text('name', { headerName: 'Name', width: 140, editable: true }),
  col.number('qty', { headerName: 'Qty', width: 90, precision: 0, editable: true, alwaysInput: true }),
  col.currency('rate', { headerName: 'Rate', width: 110, precision: 2, editable: true, alwaysInput: true }),
] as ColumnDef<RhfQaRow>[];

function RhfQaTable({ data }: { data: RhfQaRow[] }) {
  const grid = useGrid<RhfQaRow>({
    columns: rhfQaColumns,
    data,
    mode: 'view',
    features: {
      format: { locale: 'en-US', currencyCode: 'USD' },
      edit: { editTrigger: 'click' },
    },
    selection: { mode: 'range' },
    rowHeight: 36,
  });

  useGridForm<RhfQaRow, RhfQaForm>({ grid, baseName: 'items', shouldValidate: true });

  return <BetterGrid grid={grid} height={180} style={gridFrameStyle} />;
}

function RhfBridgeGrid() {
  const methods = useForm<RhfQaForm>({ defaultValues: { items: rhfQaSeed } });
  const data = useMemo(() => methods.getValues('items'), [methods]);
  const watched = methods.watch();
  const dirtyCount = Object.keys(methods.formState.dirtyFields.items ?? {}).length;

  return (
    <Section
      title="RHF Bridge: useGridForm cell-commit → form state"
      detail="Wraps a 3-column grid in a FormProvider. Every cell commit is forwarded to RHF via useGridForm. The pre block shows live form state as you edit."
    >
      <FormProvider {...methods}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <RhfQaTable data={data} />
          </div>
          <div style={{ flex: '0 0 260px', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
            <div style={{ marginBottom: 6, color: '#667085' }}>
              isDirty: <strong>{methods.formState.isDirty.toString()}</strong>
              {' '}| dirtyFields count: <strong>{dirtyCount}</strong>
            </div>
            <pre style={{
              margin: 0, padding: 10, background: '#f8f9fa', border: '1px solid #e0e0e0',
              borderRadius: 6, fontSize: 11, lineHeight: 1.5, maxHeight: 180, overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {JSON.stringify(watched, null, 2)}
            </pre>
          </div>
        </div>
      </FormProvider>
    </Section>
  );
}

// ─── Section 8: Column Visibility Toggle ─────────────────────────────────────

interface HideRow { id: number; name: string; qty: number; status: string }

const hideRows: HideRow[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  qty: (i + 1) * 15,
  status: i % 2 === 0 ? 'Open' : 'Closed',
}));

const hideColumns: ColumnDef<HideRow>[] = [
  col.text('id', { headerName: 'ID', width: 70, hide: true }),
  col.text('name', { headerName: 'Name', width: 160 }),
  col.number('qty', { headerName: 'Qty', width: 90, precision: 0 }),
  col.text('status', { headerName: 'Status', width: 110 }),
] as ColumnDef<HideRow>[];

function ColumnHideToggleGrid() {
  const [status, setStatus] = useState('ID column starts hidden. Visible columns: 3.');
  const [statusHidden, setStatusHidden] = useState(false);

  const grid = useGrid<HideRow>({
    data: hideRows,
    columns: hideColumns,
    mode: 'view',
    selection: { mode: 'cell' },
    rowHeight: 36,
  });

  const updateStatus = useCallback((msg: string) => {
    const visibleCount = grid.api.getColumns().length;
    setStatus(`${msg} Visible columns: ${visibleCount}.`);
  }, [grid.api]);

  return (
    <Section
      title="Column visibility: hide / setColumnHidden runtime toggle"
      detail="Validates setColumnHidden updates aria-colcount and resets freeze-clip. ID starts hidden via hide: true in the column def."
    >
      <div style={toolbarStyle}>
        <ToolbarButton onClick={() => { grid.api.setColumnHidden('id', false); updateStatus('ID shown.'); }}>Show ID</ToolbarButton>
        <ToolbarButton onClick={() => { grid.api.setColumnHidden('id', true); updateStatus('ID hidden.'); }}>Hide ID</ToolbarButton>
        <ToolbarButton onClick={() => {
          const nextHidden = !statusHidden;
          grid.api.setColumnHidden('status', nextHidden);
          setStatusHidden(nextHidden);
          updateStatus(`Status ${nextHidden ? 'hidden' : 'shown'}.`);
        }}>Toggle Status</ToolbarButton>
        <ToolbarButton onClick={() => {
          grid.api.setColumnHidden('id', true);
          grid.api.setColumnHidden('status', true);
          setStatusHidden(true);
          updateStatus('ID and Status hidden.');
        }}>Hide all</ToolbarButton>
        <ToolbarButton onClick={() => {
          grid.api.setColumnHidden('id', false);
          grid.api.setColumnHidden('status', false);
          setStatusHidden(false);
          updateStatus('All columns shown.');
        }}>Show all</ToolbarButton>
      </div>
      <div style={statusStyle}>{status}</div>
      <BetterGrid grid={grid} height={250} style={gridFrameStyle} />
    </Section>
  );
}

// ─── Section 9: Empty Data + Single Row ──────────────────────────────────────

interface EdgeRow { id: number; name: string; value: number }

const edgeColumns: ColumnDef<EdgeRow>[] = [
  col.text('id', { headerName: 'ID', width: 70 }),
  col.text('name', { headerName: 'Name', width: 150 }),
  col.number('value', { headerName: 'Value', width: 100, precision: 0 }),
] as ColumnDef<EdgeRow>[];

function EmptyGrid() {
  const grid = useGrid<EdgeRow>({ data: [], columns: edgeColumns, mode: null, rowHeight: 36 });
  return <BetterGrid grid={grid} height={160} style={gridFrameStyle} />;
}

function SingleRowGrid() {
  const grid = useGrid<EdgeRow>({
    data: [{ id: 1, name: 'Solo', value: 42 }],
    columns: edgeColumns,
    mode: null,
    rowHeight: 36,
  });
  return <BetterGrid grid={grid} height={160} style={gridFrameStyle} />;
}

function EmptyDataAndSingleRowGrid() {
  return (
    <Section
      title="Empty data + single row edge cases"
      detail="Both grids should render headers + correct cells (or empty body) without console errors."
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#667085' }}>Left: data=[] (empty)</p>
          <EmptyGrid />
        </div>
        <div style={{ flex: '1 1 300px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#667085' }}>Right: single row</p>
          <SingleRowGrid />
        </div>
      </div>
    </Section>
  );
}

// ─── Section 10: selection: false (read-only display) ────────────────────────

interface ReadOnlyRow { id: number; product: string; price: number }

const readOnlyRows: ReadOnlyRow[] = [
  { id: 1, product: 'Widget A', price: 29.99 },
  { id: 2, product: 'Widget B', price: 49.99 },
  { id: 3, product: 'Widget C', price: 14.99 },
  { id: 4, product: 'Widget D', price: 89.99 },
];

const readOnlyColumns: ColumnDef<ReadOnlyRow>[] = [
  col.text('id', { headerName: 'ID', width: 70 }),
  col.text('product', { headerName: 'Product', width: 180 }),
  col.currency('price', { headerName: 'Price', width: 110, precision: 2 }),
] as ColumnDef<ReadOnlyRow>[];

function SelectionDisabledGrid() {
  const grid = useGrid<ReadOnlyRow>({
    data: readOnlyRows,
    columns: readOnlyColumns,
    mode: 'view',
    features: { format: { locale: 'en-US', currencyCode: 'USD' } },
    selection: false,
    rowHeight: 36,
  });

  return (
    <Section
      title="selection: false (read-only display)"
      detail="Cells should not show the active-cell border on click. No selection overlay renders."
    >
      <div style={statusStyle}>Cells should not show the active-cell border on click.</div>
      <BetterGrid grid={grid} height={200} style={gridFrameStyle} />
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function QaMatrix() {
  return (
    <div style={pageShell}>
      <div>
        <p style={{ margin: 0, color: '#0f766e', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>QA Matrix</p>
        <h1 style={{ fontSize: 26, margin: '4px 0 0', color: '#101828' }}>Better Grid Full Feature Test Page</h1>
        <p style={introStyle}>
          Use this page as the smoke, regression, and exploratory QA surface before releases. It keeps edge cases visible:
          invalid seed values, overflowing editable text, native dropdowns, select-with-input, masked periods, prefix and suffix inputs,
          grouped hierarchy, pro renderers, Gantt bars, row actions, export APIs, pagination, autodetect, frozen areas, pinned rows,
          clipboard, undo/redo, RHF integration, column visibility, and empty-data edge cases.
        </p>
      </div>

      <FeatureGrid />
      <RendererGrid />
      <StructureGrid />
      <PaginationAutoDetectGrid />
      <ProGrid />
      <ClipboardUndoGrid />
      <RhfBridgeGrid />
      <ColumnHideToggleGrid />
      <EmptyDataAndSingleRowGrid />
      <SelectionDisabledGrid />
    </div>
  );
}
