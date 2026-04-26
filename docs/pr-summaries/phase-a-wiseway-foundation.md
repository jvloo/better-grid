# Phase A — Wiseway-shape foundation

Four additive features that close the remaining gaps Better Grid needs before the production Wiseway feasibility tables can migrate. Lands on top of v1 (commit `27feca6`).

## Summary

- **`column.alwaysInput`** — per-column flag that renders a real `<input>` permanently in every editable cell. No double-click required. Wiseway parity for finance-style sheets where every visible cell is already an editor.
- **`@better-grid/react/rhf`** — opt-in sub-export with `useGridForm({ grid, baseName })`. Listens to `data:change` from the grid and forwards each cell commit into a surrounding RHF `<FormProvider>`'s `setValue('${baseName}.${rowIndex}.${columnId}', newValue)`. `react-hook-form` is an optional peer dep.
- **Validation `messageRenderer`** — per-rule and per-column callback returning an `HTMLElement` or string. Lets the validation tooltip body be styled as an MUI Alert (or any other rich UI) while the wrapper still owns positioning.
- **MUI theme integration doc** — recipe wiring `theme.palette` / `theme.typography` / `theme.spacing` / dark mode through Better Grid's existing CSS custom properties via a single `styled()` wrapper.

## Commits (4)

```
f1d94fe docs: MUI theme integration guide
a35398e validation: per-rule and per-column messageRenderer callback
6d32335 react/rhf: useGridForm bridge from cell commits to FormProvider
1c16485 editing: per-column alwaysInput flag with perf gate
```

## Verification

- `npm --prefix packages/plugins run build` — green (DTS + ESM + CJS).
- `npm --prefix packages/react run build` — green; new entries `dist/rhf.js`, `dist/rhf.cjs`, `dist/rhf.d.ts`.
- `npm --prefix packages/react test` — 32 passing (`tests/rhf.test.ts` adds 6 cases for `forwardCellChangeToRhf`).
- Browser verification on the playground (vite dev `:5183`):
  - `/demo/always-input` — 25 rows × 3 columns of live `<input>`. Per-row predicate (`(row) => row.qty > 50`) correctly hides/shows the Notes input. Custom-rendered validation tooltip (red border + ⚠ icon + bold message + "Got: 0" subtitle) fires when qty is set to 0.
  - `/demo/rhf-bridge` — editing Steel beams Qty `120 → 200120` makes the form-state inspector report `Total = $90,118,355.00` and `Dirty rows = 1` via `useWatch`.
  - `/demo-wiseway/fsbt-cost` — existing FSBT Cost demo still renders; no console errors, no visual regression. Confirms `inputStyle`/`alwaysInput` decoupling preserved the pre-existing `inputStyle` path.

## Surface added

### `EditingOptions`

```ts
editing({
  alwaysInputThreshold?: number;  // default 1000; 0 disables the warn
});
```

### `ColumnDef` (via module augmentation in editing plugin)

```ts
type InputCellBoolean<TData> = boolean | ((row: TData, column: ColumnDef<TData>) => boolean | undefined);

declare module '@better-grid/core' {
  interface ColumnDef<TData = unknown> {
    alwaysInput?: InputCellBoolean<TData>;
  }
}
```

### `ColumnDef` (via module augmentation in validation plugin)

```ts
declare module '@better-grid/core' {
  interface ColumnDef<TData = unknown> {
    validationMessageRenderer?: ValidationMessageRenderer<TData>;
  }
}

interface ColumnValidationRule<TData = unknown> {
  validate: (value: unknown, row: TData) => boolean | string;
  message?: string;
  messageRenderer?: ValidationMessageRenderer<TData>;
}

type ValidationMessageRenderer<TData> = (issue: ValidationIssue<TData>) => HTMLElement | string;

interface ValidationIssue<TData> {
  message: string;
  code: ValidationErrorCode;
  position: CellPosition;
  row: TData;
  value: unknown;
  column: ColumnDef<TData>;
}
```

### `@better-grid/react/rhf`

```ts
import { useGridForm, forwardCellChangeToRhf } from '@better-grid/react/rhf';

useGridForm<TData, TFormValues>({
  grid: GridHandle<TData>;
  baseName?: string;                                             // 'costs' → 'costs.0.qty'
  getFieldPath?: (rowIndex, columnId, row) => string;            // wins over baseName
  shouldDirty?: boolean;                                         // default true
  shouldTouch?: boolean;                                         // default true
  shouldValidate?: boolean;                                      // default false
  transform?: (change: CellChange<TData>) => unknown;            // return undefined to skip
});
```

## What's next (Phase B)

- B.1 — Render Wiseway's `cost-table.tsx` behind a `?better-grid=true` URL flag with parity to the production react-virtualized + RHF + MUI implementation.
- B.2 — Enable the 9 enhancements (collapsible hierarchy, Excel clipboard, Excel export, freeze-clip drag, sortable columns, striped rows, accounting-format currency, rowActions menu, formal validation framework). `undoRedo` dropped per user.

Phase B requires architecture decisions about how `wise-frontend-app` consumes the unpublished Better Grid packages (workspace link vs file: dep vs publish). Tracked separately from this summary.
