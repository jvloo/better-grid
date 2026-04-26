# Kitchen sink — every `<BetterGrid />` prop

A single annotated example exercising every public surface element on `<BetterGrid />` and `useGrid()` — column props, plugin-augmented column fields, grid options, events, RHF bridge, and the imperative API. Use as a copy-paste reference; scan the inline comments to see what each prop does.

```tsx
import {
  BetterGrid,
  useGrid,
  defineColumn as col,
  registerColumn,
  configure,
} from '@better-grid/react';
import { useGridForm } from '@better-grid/react/rhf';
import type { GridSlots, ColumnDef } from '@better-grid/react';
import { gantt, mergeCells, rowActions } from '@better-grid/pro';
import { useForm, FormProvider } from 'react-hook-form';
import '@better-grid/core/styles.css';

// ────────────────────────────────────────────────────────────────────────────
// Optional: app-wide feature defaults (call once at boot)
// ────────────────────────────────────────────────────────────────────────────
configure({
  features: {
    format: { locale: 'en-US', currencyCode: 'USD' },
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Optional: register a custom column type used app-wide
// ────────────────────────────────────────────────────────────────────────────
registerColumn('avatar', {
  defaults: { width: 56, align: 'center' },
  cellRenderer: (container, ctx) => {
    const img = document.createElement('img');
    img.src = String(ctx.value ?? '');
    img.style.cssText = 'width:32px;height:32px;border-radius:50%';
    container.replaceChildren(img);
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Row type
// ────────────────────────────────────────────────────────────────────────────
interface Row {
  id: number;
  parentId: number | null;
  avatarUrl: string;
  name: string;
  amount: number;
  rate: number;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed' | 'pending';
  active: boolean;
  notes: string;
  currency: 'USD' | 'EUR' | 'GBP';
}

// ────────────────────────────────────────────────────────────────────────────
// Columns — hoisted module-scope, no useMemo needed
// ────────────────────────────────────────────────────────────────────────────
const columns: ColumnDef<Row>[] = [
  // Pure-display column with the registered custom type
  col.custom('avatarUrl', {
    cellType: 'avatar',                                  // resolves to registerColumn('avatar')
    headerName: '',                                      // string-only after split
    width: 56,
    resizable: false,
  }),

  // Text column with most common knobs
  col.text('name', {
    // id defaults to 'name' (= field) — omit unless you need to override
    headerName: 'Name',
    headerAlign: 'left',                                 // independent of cell align
    width: 220,
    minWidth: 120,
    maxWidth: 400,
    flex: 2,                                             // gets 2× share of spare space
    resizable: true,
    sortable: true,
    editable: true,
    align: 'left',
    verticalAlign: 'middle',
    cellEditor: 'text',
    placeholder: 'Type a name…',                         // editing-plugin field
    rules: [
      {                                                  // validation-plugin field
        validate: (v) => (typeof v === 'string' && v.length > 0) || 'Required',
        messageRenderer: (issue) => {
          const el = document.createElement('div');
          el.textContent = `⚠ ${issue.message}`;
          return el;
        },
      },
    ],
    required: true,
  }),

  // Currency column with cross-field formatter (uses extended (value, row) signature)
  col.currency('amount', {
    headerName: 'Amount',
    headerAlign: 'right',
    align: 'right',
    width: 140,
    precision: 2,                                        // editing-plugin field
    min: 0,                                              // editing-plugin clamp
    max: 1_000_000,
    prefix: (row) => row.currency === 'USD' ? '$' : row.currency === 'EUR' ? '€' : '£',
    valueFormatter: (value, row) => {                    // §1.3 — receives row
      const n = Number(value);
      return n.toLocaleString('en-US', { style: 'currency', currency: row.currency });
    },
    valueParser: (value, _row) =>                        // §1.3 — receives row
      Number(value.replace(/[^\d.-]/g, '')),
    comparator: (a, b, _rowA, _rowB) =>                  // §1.3 — optional row args
      Number(a) - Number(b),
    cellStyle: (value, _row, rowIndex) => ({             // §1.3 — receives rowIndex
      fontWeight: rowIndex % 5 === 0 ? '600' : '400',
      color: Number(value) < 0 ? '#b42318' : 'inherit',
    }),
    cellClass: (value, _row, _rowIndex) =>
      Number(value) < 0 ? 'cell-negative' : undefined,
    hideZero: true,
    alwaysInput: true,                                   // editing-plugin: always-on <input>
  }),

  // Percent column
  col.percent('rate', {
    headerName: 'Rate',
    width: 100,
    align: 'right',
    precision: 2,
    suffix: '%',
  }),

  // Date column
  col.date('startDate', {
    headerName: 'Start',
    width: 120,
    cellEditor: 'date',
    dateFormat: 'yyyy-MM-dd',                            // formatting-plugin field
  }),

  // Computed (no field) — uses valueGetter
  col.text('duration', {
    headerName: 'Duration',
    valueGetter: (row, _rowIndex) =>                     // computed cell value
      row.endDate
        ? `${Math.round((+new Date(row.endDate) - +new Date(row.startDate)) / 86_400_000)}d`
        : '—',
    width: 90,
    editable: false,
  }),

  // Select editor with options
  col.badge('status', {
    headerName: 'Status',
    width: 110,
    cellEditor: 'select',                                // 'dropdown' was dropped
    options: [
      { value: 'open',    label: 'Open',    color: '#0a7d31', bg: '#dcfce7' },
      { value: 'closed',  label: 'Closed',  color: '#334155', bg: '#f1f5f9' },
      { value: 'pending', label: 'Pending', color: '#9a3412', bg: '#ffedd5' },
    ],
  }),

  // Boolean
  col.boolean('active', { headerName: 'Active', width: 80, align: 'center' }),

  // Text + custom cell renderer (DOM-first)
  col.text('notes', {
    headerName: 'Notes',
    width: 220,
    flex: 1,
    cellRenderer: (container, ctx) => {
      container.textContent = String(ctx.value ?? '');
      // Read latest closure-over-scope value from useGrid({ context })
      container.title = `Owned by ${ctx.context?.currentUser ?? 'unknown'}`;
    },
  }),

  // Hidden by default, toggleable at runtime via grid.api.setColumnHidden
  col.text('id', {
    headerName: 'ID',
    width: 60,
    hide: true,
    editable: false,
  }),

  // Custom header renderer (split from headerName)
  col.text('currency', {
    headerName: 'Currency',
    headerRenderer: (container, _ctx) => {               // §1.4a — DOM mutator
      const span = document.createElement('span');
      span.textContent = '💱 Currency';
      span.style.cssText = 'font-weight:600;color:#065986';
      container.replaceChildren(span);
    },
    width: 100,
    options: ['USD', 'EUR', 'GBP'],
    cellEditor: 'select',
  }),
];

// ────────────────────────────────────────────────────────────────────────────
// Multi-level headers (HeaderRow[] only — object form dropped)
// ────────────────────────────────────────────────────────────────────────────
const headers = [
  {
    id: 'group-row',
    cells: [
      { id: 'g-id',    columnId: 'avatarUrl', content: '',         colSpan: 2 },
      { id: 'g-name',  columnId: 'name',      content: 'Profile',  colSpan: 1 },
      { id: 'g-money', columnId: 'amount',    content: 'Money',    colSpan: 2 },
      { id: 'g-time',  columnId: 'startDate', content: 'Schedule', colSpan: 2 },
      { id: 'g-state', columnId: 'status',    content: 'State',    colSpan: 3 },
    ],
  },
  {
    id: 'detail-row',
    cells: columns.map((c) => ({
      id: `d-${c.id}`,
      columnId: c.id,
      content: c.headerName as string,
    })),
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Pinned bottom row (separate data, sits below the scrollable area)
// ────────────────────────────────────────────────────────────────────────────
const totalsRow: Row = {
  id: -1, parentId: null, avatarUrl: '', name: 'Total',
  amount: 0, rate: 0, startDate: '', endDate: '', status: 'open',
  active: true, notes: '', currency: 'USD',
};

// ────────────────────────────────────────────────────────────────────────────
// The component
// ────────────────────────────────────────────────────────────────────────────
interface FormShape { rows: Row[] }

export function MyGrid({ data, currentUser }: { data: Row[]; currentUser: string }) {
  const methods = useForm<FormShape>({ defaultValues: { rows: data } });

  // Handle path: full imperative API + ref-based context
  const grid = useGrid<Row, { currentUser: string }>({
    // Required
    columns,
    data,

    // Mode + feature opt-in (resolved by the react adapter)
    mode: 'spreadsheet',                                 // null | view | interactive | spreadsheet | dashboard
    features: {
      edit:       { editTrigger: 'dblclick', editorMode: 'float', alwaysInputThreshold: 1000 },
      sort:       true,
      filter:     true,
      clipboard:  { includeHeaders: false, separator: '\t' },
      undo:       true,
      format:     { locale: 'en-US', currencyCode: 'USD' },
      validation: { validateOn: 'commit' },
      hierarchy:  true,
      resize:     true,
      reorder:    true,
      search:     true,
      export:     true,
    },
    // Escape hatch for plugins not in the registry (additive on top of features)
    plugins: [
      gantt({ /* … */ }),
      mergeCells({ /* … */ }),
      rowActions({ /* … */ }),
    ],

    // Size + layout
    size: { width: '100%', height: 600 },                // sugar prop also accepted on <BetterGrid>
    frozen: { left: 2, top: 0, clip: { minVisible: 1 } },
    pinned: { top: [], bottom: [totalsRow] },
    headers,                                              // HeaderRow[] only
    footers: [],                                          // FooterRow[] only
    rowHeight: (rowIndex) => (rowIndex % 7 === 0 ? 40 : 32),
    headerHeight: 36,

    // Table-style flags (replaces single tableStyle enum)
    bordered: true,
    striped: true,

    // Behavior
    selection: { mode: 'range', multiRange: true, fillHandle: true },  // discriminated union
    // selection: false                                  // alternative: disable entirely
    // selection: { mode: 'cell' }                       // alternative: cells only
    hierarchy: {
      getParentId: (row) => row.parentId,
      defaultExpanded: true,
    },
    virtualization: { overscanRows: 5, overscanColumns: 3 },

    // Stability + closure
    getRowId: (row) => row.id,                            // top-level; mirrored at hierarchy.getRowId
    context: { currentUser },                             // read inside cellRenderer via ctx.context

    // Row-level styling
    rowStyle: (row, _rowIndex) => row.status === 'pending'
      ? { background: '#fff7ed' }
      : undefined,

    // Events
    onCellChange:     (changes) => methods.setValue('rows', methods.getValues('rows')),
    onSelectionChange: (sel)    => console.log('selected', sel.active),
    onColumnResize:   (id, w)   => console.log(`${id} -> ${w}px`),

    // v1.x reserved seam (empty interface today; populated incrementally)
    slots:     {} satisfies Partial<GridSlots>,
    slotProps: {},
  });

  // RHF bridge: cell commits flow into the surrounding <FormProvider>
  useGridForm<Row, FormShape>({
    grid,
    baseName: 'rows',                                    // rows.0.amount, rows.1.amount, …
    shouldDirty: true,
    shouldTouch: true,
    shouldValidate: true,
    transform: (change) => change.newValue,              // optional value override
  });

  return (
    <FormProvider {...methods}>
      <BetterGrid grid={grid} className="my-grid" style={{ marginBottom: 16 }} />

      {/* Imperative API */}
      <button onClick={() => grid.api.setColumnHidden('id', false)}>Show ID</button>
      <button onClick={() => grid.api.scrollToCell({ rowIndex: 0, colIndex: 0 })}>Top-left</button>
    </FormProvider>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sugar path — same surface, inline. No useGrid, no handle.
// ────────────────────────────────────────────────────────────────────────────
export function SimpleGrid({ data }: { data: Row[] }) {
  return (
    <BetterGrid<Row>
      columns={columns}
      data={data}
      mode="spreadsheet"
      features={['edit', 'sort', 'filter']}              // string-array form also accepted
      frozen={{ left: 1 }}
      pinned={{ bottom: [totalsRow] }}
      selection={{ mode: 'range' }}
      bordered
      striped
      height={400}                                        // top-level sugar (mirrors size.height)
      onCellChange={(changes) => console.log(changes)}
    />
  );
}
```

## What to notice

- **`id` is optional** — every column above either omits it (defaults to `field`) or sets it explicitly when needed.
- **`headerName` is always a string**; **`headerRenderer`** is the DOM-mutator hook (split from the old overloaded `header`).
- **`valueFormatter` / `valueParser` / `cellStyle` / `cellClass` / `comparator`** show their extended signatures in use.
- **`bordered` + `striped`** are independent top-level booleans; combine freely.
- **`selection`** is a discriminated union — `false` (off), `{ mode: 'cell' | 'row' }`, or `{ mode: 'range', multiRange?, fillHandle? }`.
- **`getRowId`** sits at top-level options; `hierarchy.getRowId` is mirrored only when hierarchy is configured.
- **Plugin-augmented column fields** (`precision`, `prefix`, `suffix`, `min`, `max`, `placeholder`, `dateFormat`, `rules`, `messageRenderer`, `required`, `alwaysInput`) flow into `ColumnDef` via TypeScript module augmentation — they only exist when the plugin is bundled.
- **`mode` + `features`** is the React adapter's preferred opt-in; `plugins` remains the escape hatch for off-registry plugins.
