import { useState } from 'react';
import { BetterGrid, defineColumn as col } from '@better-grid/react';
import type { BadgeOption, ColumnDef } from '@better-grid/core';
import { CodeBlock } from '../components/CodeBlock';
import '@better-grid/core/styles.css';

interface DemoRow {
  id: number;
  name: string;
  category: string;
  amount: number;
  rate: number;
  date: string;
  active: boolean;
}

const data: DemoRow[] = [
  { id: 1, name: 'Alpha', category: 'Revenue', amount: 125000, rate: 0.05, date: '2026-01-15', active: true },
  { id: 2, name: 'Beta', category: 'Cost', amount: -45000, rate: 0.12, date: '2026-02-01', active: true },
  { id: 3, name: 'Gamma', category: 'Revenue', amount: 89000, rate: 0.03, date: '2026-03-10', active: false },
  { id: 4, name: 'Delta', category: 'Cost', amount: -23000, rate: 0.08, date: '2026-04-22', active: true },
  { id: 5, name: 'Epsilon', category: 'Revenue', amount: 210000, rate: 0.15, date: '2026-05-05', active: true },
  { id: 6, name: 'Zeta', category: 'Cost', amount: -67000, rate: 0.02, date: '2026-06-18', active: false },
  { id: 7, name: 'Eta', category: 'Expense', amount: -15200, rate: 0.04, date: '2026-01-28', active: true },
  { id: 8, name: 'Theta', category: 'Revenue', amount: 340000, rate: 0.11, date: '2026-02-14', active: true },
  { id: 9, name: 'Iota', category: 'Cost', amount: -89500, rate: 0.07, date: '2026-03-03', active: false },
  { id: 10, name: 'Kappa', category: 'Revenue', amount: 56000, rate: 0.09, date: '2026-04-11', active: true },
  { id: 11, name: 'Lambda', category: 'Expense', amount: -31400, rate: 0.06, date: '2026-05-19', active: true },
  { id: 12, name: 'Mu', category: 'Revenue', amount: 178000, rate: 0.14, date: '2026-06-02', active: false },
  { id: 13, name: 'Nu', category: 'Cost', amount: -52300, rate: 0.03, date: '2026-07-08', active: true },
  { id: 14, name: 'Xi', category: 'Expense', amount: -8700, rate: 0.01, date: '2026-07-25', active: true },
  { id: 15, name: 'Omicron', category: 'Revenue', amount: 415000, rate: 0.18, date: '2026-08-12', active: true },
  { id: 16, name: 'Pi', category: 'Cost', amount: -120000, rate: 0.10, date: '2026-08-30', active: false },
  { id: 17, name: 'Rho', category: 'Expense', amount: -19800, rate: 0.05, date: '2026-09-14', active: true },
  { id: 18, name: 'Sigma', category: 'Revenue', amount: 93000, rate: 0.08, date: '2026-10-01', active: true },
  { id: 19, name: 'Tau', category: 'Cost', amount: -41600, rate: 0.13, date: '2026-10-20', active: false },
  { id: 20, name: 'Upsilon', category: 'Expense', amount: -27500, rate: 0.02, date: '2026-11-05', active: true },
];

const categoryOptions = [
  { label: 'Revenue', value: 'Revenue', color: '#2e7d32', bg: '#e8f5e9' },
  { label: 'Cost', value: 'Cost', color: '#c62828', bg: '#ffebee' },
  { label: 'Expense', value: 'Expense', color: '#e65100', bg: '#fff3e0' },
] as BadgeOption[];

const baseColumns = [
  col.text('id', { headerName: '#', width: 40, editable: false, sortable: true }),
  col.text('name', { headerName: 'Name', width: 100, required: true, sortable: true }),
  col.badge('category', { headerName: 'Category', width: 100, options: categoryOptions, sortable: true }),
  col.currency('amount', {
    headerName: 'Amount',
    width: 120,
    sortable: true,
    rules: [{ validate: (v: unknown) => typeof v === 'number' || 'Must be number' }],
  }),
  col.percent('rate', { headerName: 'Rate', width: 75, sortable: true }),
  col.date('date', { headerName: 'Date', width: 120, sortable: true }),
  col.boolean('active', { headerName: 'Active', width: 80 }),
] as ColumnDef<DemoRow>[];

export function PluginToggle() {
  const [enableFormat, setEnableFormat] = useState(true);
  const [enableEdit, setEnableEdit] = useState(true);
  const [enableSort, setEnableSort] = useState(true);
  const [enableFilter, setEnableFilter] = useState(false);
  const [enableValidation, setEnableValidation] = useState(false);

  // Re-create the grid when features change.
  const featureKey = `${enableFormat}-${enableEdit}-${enableSort}-${enableFilter}-${enableValidation}`;

  // Build the features object dynamically. mode={null} drops mode defaults so
  // each toggle independently controls a feature.
  const features: Partial<Record<string, boolean | object>> = {};
  if (enableFormat) features.format = { locale: 'en-US', currencyCode: 'USD', accountingFormat: true };
  if (enableEdit) features.edit = { editTrigger: 'dblclick' };
  if (enableSort) features.sort = true;
  if (enableFilter) features.filter = true;
  if (enableValidation) features.validation = { validateOn: 'all' };

  const activeFeatures = [
    enableFormat && 'format',
    enableEdit && 'edit',
    enableSort && 'sort',
    enableFilter && 'filter',
    enableValidation && 'validation',
  ].filter(Boolean) as string[];

  const codeSnippet = `import { BetterGrid } from '@better-grid/react';

<BetterGrid
  columns={columns}
  data={data}
  mode={null}
  features={{${activeFeatures.length > 0 ? `
    ${activeFeatures.map((f) => `${f}: true`).join(',\n    ')},` : ''}
  }}
  frozen={{ left: 2 }}
  selection={{ mode: 'range' }}
/>`;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Feature Toggle — Live</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        Toggle features on/off via the new <code>features</code> prop.
        With <code>mode={'{null}'}</code>, no defaults apply — each checkbox flips one feature on or off.
      </p>

      {/* Toggle panel */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          padding: 12,
          background: '#f8f9fa',
          borderRadius: 8,
          flexWrap: 'wrap',
        }}
      >
        <FeatureCheckbox label="format" checked={enableFormat} onChange={setEnableFormat} color="#1a73e8" description="Currency, percent, dates" />
        <FeatureCheckbox label="edit" checked={enableEdit} onChange={setEnableEdit} color="#2e7d32" description="Double-click to edit" />
        <FeatureCheckbox label="sort" checked={enableSort} onChange={setEnableSort} color="#f57f17" description="Click header to sort" />
        <FeatureCheckbox label="filter" checked={enableFilter} onChange={setEnableFilter} color="#c62828" description="Right-click → Filter" />
        <FeatureCheckbox label="validation" checked={enableValidation} onChange={setEnableValidation} color="#7b1fa2" description="Red border on errors" />
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, color: '#888' }}>
        {activeFeatures.length === 0
          ? 'No features active — core only. Raw values, no interactivity.'
          : `Active: ${activeFeatures.join(' + ')}`}
      </div>

      <BetterGrid<DemoRow>
        key={featureKey}
        columns={baseColumns}
        data={data}
        mode={null}
        features={features}
        frozen={{ left: 2 }}
        selection={{ mode: 'range' }}
        height={320}
      />

      <CodeBlock code={codeSnippet} />
    </div>
  );
}

function FeatureCheckbox({
  label,
  checked,
  onChange,
  color,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
  description: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        padding: '4px 10px',
        borderRadius: 6,
        background: checked ? `${color}12` : 'transparent',
        border: `1px solid ${checked ? color : '#ddd'}`,
        transition: 'all 0.15s',
        fontSize: 13,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: color }}
      />
      <span>
        <code style={{ fontWeight: 500, color: checked ? color : '#999' }}>{label}</code>
        <span style={{ color: '#999', marginLeft: 4, fontSize: 11 }}>{description}</span>
      </span>
    </label>
  );
}

