import { useMemo, useState } from 'react';
import { useForm, FormProvider, useFormContext, useWatch } from 'react-hook-form';
import { BetterGrid, defineColumn as col, useGrid } from '@better-grid/react';
import { useGridForm } from '@better-grid/react/rhf';
import type { ColumnDef } from '@better-grid/core';
import '@better-grid/core/styles.css';

interface CostRow {
  id: number;
  item: string;
  qty: number;
  unitCost: number;
}

interface CostsForm {
  costs: CostRow[];
}

const seed: CostRow[] = [
  { id: 1, item: 'Steel beams', qty: 120, unitCost: 450 },
  { id: 2, item: 'Concrete (m³)', qty: 85, unitCost: 220 },
  { id: 3, item: 'Glass panels', qty: 240, unitCost: 95 },
  { id: 4, item: 'Insulation rolls', qty: 60, unitCost: 38 },
  { id: 5, item: 'Wiring (m)', qty: 1500, unitCost: 4.25 },
  { id: 6, item: 'Plumbing fittings', qty: 320, unitCost: 12.5 },
  { id: 7, item: 'Roofing tiles', qty: 800, unitCost: 7.8 },
  { id: 8, item: 'Door frames', qty: 24, unitCost: 165 },
];

const columns = [
  col.text('item', { header: 'Item', width: 220, editable: false }),
  col.number('qty', { header: 'Qty', width: 110, align: 'right', alwaysInput: true, precision: 0 }),
  col.currency('unitCost', { header: 'Unit Cost', width: 140, align: 'right', alwaysInput: true, precision: 2 }),
] as ColumnDef<CostRow>[];

function CostsTable({ data }: { data: CostRow[] }) {
  const grid = useGrid<CostRow>({
    columns,
    data,
    mode: 'view',
    features: { format: { locale: 'en-US', currencyCode: 'USD' }, edit: {} },
    selection: { mode: 'range', fillHandle: false },
  });

  // Bridge: every cell commit fires setValue('costs.<rowIndex>.<columnId>', ...)
  useGridForm<CostRow, CostsForm>({
    grid,
    baseName: 'costs',
    shouldValidate: true,
  });

  return <BetterGrid grid={grid} height={320} />;
}

function FormStateInspector() {
  const { control, formState } = useFormContext<CostsForm>();
  const costs = useWatch({ control, name: 'costs' });
  const total = (costs ?? []).reduce(
    (sum, r) => sum + (Number(r?.qty ?? 0) * Number(r?.unitCost ?? 0)),
    0,
  );
  const dirtyCount = Object.keys(formState.dirtyFields.costs ?? {}).length;
  return (
    <div style={{
      marginTop: 16, padding: 12, background: '#0f0f0f', color: '#eee',
      borderRadius: 8, fontFamily: 'ui-monospace, monospace', fontSize: 12,
    }}>
      <div style={{ marginBottom: 6, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
        Live RHF state
      </div>
      <div>Total = ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div>Dirty rows = {dirtyCount}</div>
      <div>Submit count = {formState.submitCount}</div>
    </div>
  );
}

export function RhfBridgeDemo() {
  const [submittedJson, setSubmittedJson] = useState<string | null>(null);
  const methods = useForm<CostsForm>({ defaultValues: { costs: seed } });
  const data = useMemo(() => methods.getValues('costs'), [methods]);

  const onSubmit = methods.handleSubmit((values) => {
    setSubmittedJson(JSON.stringify(values.costs, null, 2));
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>react-hook-form Bridge</h1>
        <p style={{ marginBottom: 12, color: '#666', lineHeight: 1.5 }}>
          <code>useGridForm()</code> forwards every cell commit into the surrounding{' '}
          <code>&lt;FormProvider&gt;</code>. Each <code>alwaysInput</code> cell becomes a tracked
          form field at <code>costs.&lt;rowIndex&gt;.&lt;columnId&gt;</code>.
        </p>

        <CostsTable data={data} />
        <FormStateInspector />

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button type="submit" style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #2563eb',
            background: '#2563eb', color: '#fff', cursor: 'pointer',
          }}>
            Submit form
          </button>
          <button type="button" onClick={() => methods.reset()} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc',
            background: '#fff', color: '#333', cursor: 'pointer',
          }}>
            Reset
          </button>
        </div>

        {submittedJson && (
          <pre style={{
            marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8,
            fontSize: 11, lineHeight: 1.5, maxHeight: 240, overflow: 'auto',
          }}>{submittedJson}</pre>
        )}
      </form>
    </FormProvider>
  );
}
