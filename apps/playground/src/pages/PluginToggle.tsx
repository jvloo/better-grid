import { useMemo, useState, useCallback } from 'react';
import { BetterGrid } from '@better-grid/react';
import type { ColumnDef, GridPlugin } from '@better-grid/core';
import { formatting, editing, sorting, filtering, validation } from '@better-grid/plugins';
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
];

export function PluginToggle() {
  const [enableFormatting, setEnableFormatting] = useState(true);
  const [enableEditing, setEnableEditing] = useState(true);
  const [enableSorting, setEnableSorting] = useState(true);
  const [enableFiltering, setEnableFiltering] = useState(false);
  const [enableValidation, setEnableValidation] = useState(false);

  // Rebuild key when plugins change to force grid re-creation
  const pluginKey = `${enableFormatting}-${enableEditing}-${enableSorting}-${enableFiltering}-${enableValidation}`;

  const columns = useMemo<ColumnDef<DemoRow>[]>(
    () => [
      { id: 'id', header: 'ID', width: 50, editable: false, sortable: true },
      { id: 'name', header: 'Name', width: 120, required: true, sortable: true },
      {
        id: 'category',
        header: 'Category',
        width: 110,
        options: ['Revenue', 'Cost', 'Expense'],
        sortable: true,
      },
      {
        id: 'amount',
        header: 'Amount',
        width: 130,
        cellType: 'currency',
        sortable: true,
        rules: [{ validate: (v) => typeof v === 'number' || 'Must be number' }],
      },
      { id: 'rate', header: 'Rate', width: 80, cellType: 'percent', sortable: true },
      { id: 'date', header: 'Date', width: 130, cellType: 'date', sortable: true },
      {
        id: 'active',
        header: 'Active',
        width: 80,
        cellRenderer: enableFormatting
          ? (container, ctx) => {
              container.textContent = ctx.value ? 'Yes' : 'No';
              container.style.color = ctx.value ? '#2e7d32' : '#c62828';
            }
          : undefined,
      },
    ],
    [enableFormatting],
  );

  const plugins = useMemo(() => {
    const p: GridPlugin[] = [];
    if (enableFormatting) p.push(formatting({ locale: 'en-US', currencyCode: 'USD', accountingFormat: true }));
    if (enableEditing) p.push(editing({ editTrigger: 'dblclick' }));
    if (enableSorting) p.push(sorting());
    if (enableFiltering) p.push(filtering());
    if (enableValidation) p.push(validation({ validateOn: 'all' }));
    return p;
  }, [enableFormatting, enableEditing, enableSorting, enableFiltering, enableValidation]);

  const activePlugins = [
    enableFormatting && 'formatting()',
    enableEditing && 'editing()',
    enableSorting && 'sorting()',
    enableFiltering && 'filtering()',
    enableValidation && 'validation()',
  ].filter(Boolean);

  const codeSnippet = `import { BetterGrid } from '@better-grid/react';
${activePlugins.length > 0 ? `import { ${activePlugins.join(', ').replace(/\(\)/g, '')} } from '@better-grid/plugins';` : '// No plugins imported'}

<BetterGrid
  columns={columns}
  data={data}
  frozenLeftColumns={2}
  selection={{ mode: 'range' }}${activePlugins.length > 0 ? `
  plugins={[${activePlugins.join(', ')}]}` : ''}
/>`;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Plugin Toggle — Live</h1>
      <p style={{ marginBottom: 16, color: '#666', lineHeight: 1.5 }}>
        Toggle plugins on/off to see how each one changes the grid.
        The grid re-creates with only the selected plugins.
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
        <PluginCheckbox label="formatting()" checked={enableFormatting} onChange={setEnableFormatting} color="#1a73e8" description="Currency, percent, dates" />
        <PluginCheckbox label="editing()" checked={enableEditing} onChange={setEnableEditing} color="#2e7d32" description="Double-click to edit" />
        <PluginCheckbox label="sorting()" checked={enableSorting} onChange={setEnableSorting} color="#f57f17" description="Click header to sort" />
        <PluginCheckbox label="filtering()" checked={enableFiltering} onChange={setEnableFiltering} color="#c62828" description="Right-click → Filter" />
        <PluginCheckbox label="validation()" checked={enableValidation} onChange={setEnableValidation} color="#7b1fa2" description="Red border on errors" />
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, color: '#888' }}>
        {activePlugins.length === 0
          ? 'No plugins active — core only. Raw values, no interactivity.'
          : `Active: ${activePlugins.join(' + ')}`}
      </div>

      <BetterGrid<DemoRow>
        key={pluginKey}
        columns={columns}
        data={data}
        frozenLeftColumns={2}
        selection={{ mode: 'range' }}
        plugins={plugins}
        height={320}
      />

      <CodeBlock code={codeSnippet} />
    </div>
  );
}

function PluginCheckbox({
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
