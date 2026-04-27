# Better Grid QA Matrix Report

Date: 2026-04-26
Page: `/demo/qa-matrix`
Build: `node scripts/playground-build.js build` passed
Browser session: `better-grid-qa-matrix`
Latest update: validation tooltips are now rendered inside the owning grid container and repositioned on grid scroll.

## Test Page Added

Added a release QA page that groups broad Better Grid coverage into focused grids:

- Editing, validation, formatting, sorting, filtering, search, export, undo/redo, fill, prefix/suffix inputs, masked `MM/YY`, date dependency, dropdown, autocomplete, select-with-input, and always-input cells.
- Built-in and pro renderers: badge, progress, boolean, rating, change, changeIndicator, currency, percent, date, timeline, tooltip, link, loading, sparkline, heatmap, circular progress, avatar, mini chart, and slider.
- Structure features: hierarchy, grouping, frozen columns, pinned rows, multi-headers, variable row height, selection, and frozen clipping.
- Pagination and auto-detect.
- Pro plugins: row actions, merge cells, aggregation, Gantt, pinned totals, and variance indicators.

## Critical Findings

### Resolved: Validation tooltips duplicated and leaked across the page

Original finding: validation messages were appended to `document.body` as fixed overlays and were shown immediately for every invalid cell after validation. They persisted over unrelated grids and duplicated after repeated validation/render cycles.

Current behavior: validation tooltips are appended to a per-grid `.bg-validation-tooltip-layer`, clipped by the `.bg-grid` container, and repositioned after scroll so they stay attached to visible invalid cells.

Evidence:

- `dogfood-output/qa-matrix/screenshots/issue-validation-overlays.png`
- `dogfood-output/qa-matrix/screenshots/pagination-section.png`
- `dogfood-output/qa-matrix/screenshots/final-smoke.png`
- `dogfood-output/qa-matrix/screenshots/contained-validation-scroll.png`

Likely source:

- `packages/plugins/src/free/validation.ts`
- `applyErrorStyles()` calls `showValidationTooltip()` directly for each matching cell, and generates keys using `validationTooltipEls.size`, so repeated renders can create fresh body-level tooltip nodes instead of a stable per-cell tooltip.

Suggested fix:

- Keep error styling separate from tooltip display.
- Show tooltip only on hover/focus or active edit state.
- Use stable keys from `rowIndex:colIndex`.
- Scope cleanup strongly to the owning grid instance.
- Consider placing tooltip nodes under the grid container or a portal root owned by the grid.

### Medium: Auto-detect is not visually applying in React grids

The auto-detect table still renders raw values:

- numbers as `0.5`, `-7`, etc.
- dates as ISO strings like `2026-01-15`
- booleans as `true` / `false`

Pagination itself works, but inferred `cellType` and alignment are not surviving.

Evidence:

- `dogfood-output/qa-matrix/screenshots/pagination-after-next.png`
- `dogfood-output/qa-matrix/screenshots/final-smoke.png`

Likely source:

- `packages/plugins/src/free/auto-detect.ts`
- `packages/react/src/useGrid.ts`

The plugin mutates columns during plugin init, then React `useGrid` later calls `grid.setColumns(options.columns)`, which can replace those inferred column properties.

Suggested fix:

- Re-run auto-detect after `columns` or `data` changes, or expose auto-detected columns as a resolved column pipeline step.
- Avoid one-time init mutation for React-controlled columns.

### Medium: `col.link` is available but no `link` renderer is registered

The QA page emits:

```text
[better-grid] Column "link": cellType "link" is not built-in and no plugin has registered a renderer for it.
```

The link cells render as plain text URLs.

Likely source:

- `packages/react/src/defineColumn.ts` includes `link`.
- `packages/plugins/src/free/cell-renderers.ts` does not register `link`.

Suggested fix:

- Add a `link` renderer to the free cell renderers plugin, or remove `link` from the React built-in builders until it is supported.

### Medium: always-input percent suffix is not visible

Normal percent cells render with a visible `%` suffix, but `alwaysInput` percent fields render as plain textboxes with values such as `7.5`, `3.5`, `0`, and `11.5` without the suffix. This breaks the expected prefix/suffix attachment behavior.

Evidence:

- `dogfood-output/qa-matrix/screenshots/initial-full.png`
- `dogfood-output/qa-matrix/screenshots/after-page-corrections-full.png`
- `dogfood-output/qa-matrix/screenshots/final-smoke.png`

Suggested fix:

- Route `alwaysInput` through the same input adornment wrapper used by edit-mode percent/currency cells.
- Confirm prefix and suffix remain attached in display, edit, floating overflow edit, and always-input modes.

### Medium: Dropdown options are functional but not semantic

Category and escalation dropdowns open and select correctly. The mixed `Custom + input + %` escalation case also renders. However, the dropdown menu/options appear in the accessibility tree as generic clickable elements rather than listbox/menu options.

Suggested fix:

- Add proper roles and keyboard behavior: trigger `aria-haspopup`, `aria-expanded`, menu `role=listbox` or `menu`, and options as `role=option` or `menuitem`.
- Ensure escape, arrow keys, enter, and tab behavior match native expectations.

### Low: Row action trigger and menu items need accessible names/roles

The row actions menu opens and shows `Add under Planning` and `Delete row`, but the trigger appears as a generic clickable icon with no accessible name. Menu items also appear as generic clickables.

Evidence:

- `dogfood-output/qa-matrix/screenshots/row-actions-open.png`

Suggested fix:

- Render action triggers as buttons with labels such as `Actions for Concept design`.
- Render menu items as buttons or menuitems.

## Passed Smoke Checks

- Page loads at `/demo/qa-matrix`.
- Production playground build passes.
- No browser runtime errors were reported.
- Pagination next/export controls work.
- Hierarchy expand/collapse works and updates parent row state.
- Dropdown and select-with-input controls open.
- Pro row actions menu opens.
- Gantt bars render visually.
- Aggregation pinned totals render.
- Variance/change indicators render with arrows when the field is read-only.
- Currency, percent, date, badge, progress, rating, change, timeline, tooltip, sparkline, heatmap, circular progress, avatar, mini chart, slider, and boolean renderer smoke coverage is visible.

## Evidence Captured

Screenshots are in:

- `dogfood-output/qa-matrix/screenshots/initial-full.png`
- `dogfood-output/qa-matrix/screenshots/issue-validation-overlays.png`
- `dogfood-output/qa-matrix/screenshots/pagination-next.png`
- `dogfood-output/qa-matrix/screenshots/pagination-section.png`
- `dogfood-output/qa-matrix/screenshots/pagination-after-next.png`
- `dogfood-output/qa-matrix/screenshots/pro-section.png`
- `dogfood-output/qa-matrix/screenshots/after-page-corrections-full.png`
- `dogfood-output/qa-matrix/screenshots/row-actions-open.png`
- `dogfood-output/qa-matrix/screenshots/final-smoke.png`
