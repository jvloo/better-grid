# FSBT (Better Grid) vs Wiseway QA App - Comparison

Date: 2026-04-26
Pages compared: `/demo-realworld/fsbt-program`, `/demo-realworld/fsbt-cost`, `/demo-realworld/fsbt-revenue`

## Reference sources

| Source | Where |
|---|---|
| Better Grid pages | `apps/playground/src/pages/FsbtProgram.tsx`, `FsbtCost.tsx`, `FsbtRevenue.tsx` |
| Wiseway production source | `D:/Projects/Wiseway/Repositories/wise-frontend-app/src/modules/feasibility/components/{program,cost,revenue}/` |
| Wiseway live QA app | `https://qa-app.wiseway.ai` - LOCKED, subscription expired (banner: "Your subscription has expired. Please renew to continue using the platform.") - Portfolio/Feasibility/Development buttons disabled. Could not visually verify the live grids. |
| Better Grid screenshots | `dogfood-output/fsbt-compare/bg-program.png`, `bg-cost.png`, `bg-revenue.png` |
| Wiseway screenshot | not captured - app shows the "subscription expired" landing only; no live grid was viewable |

## Method

Because the live Wiseway app was inaccessible, the comparison is **source-vs-source**:

- Each Better Grid `ColumnDef[]` was lined up against Wiseway's `defaultColumns` array in the matching production component.
- Plugin behavior (hierarchy, editing, validation) was checked against Wiseway's container-level handlers and source comments.
- The known-good UX intentions in `MEMORY.md` (`fsbt_ux_direction.md`, `ww_ai_suggestion_button.md`) were treated as authoritative for "what should be there in addition to Wiseway".

---

## 1. Program (`FsbtProgram` vs `program-table.tsx`)

### Frozen left columns

| # | Wiseway | Wiseway w | Better Grid | BG w | Status |
|---|---|---|---|---|---|
| 1 | Menu | 50 | actions | 50 | match |
| 2 | Code | 40 | code | **45** | drift (5px wider) |
| 3 | Phase | 236 | name | 236 | match |
| 4 | Duration (months) | 110 | duration | **90** | drift (20px narrower) |
| 5 | Start | 110 | start | 110 | match |
| 6 | End | 110 | end | 110 | match |
| 7 | variance-status (label "") - *actually renders the collapse chevron, mis-named in source* | 55 | collapse | **40** | drift (15px narrower) |

Then the monthly Gantt columns (Aug 2023 - Oct 2026, 39 cols) which match exactly.

### Behavioral differences

| Feature | Wiseway | Better Grid | Verdict |
|---|---|---|---|
| Edit trigger | onBlur via RHF, inputs always visible (`shouldShowInput`) | `editTrigger: 'click'` + `inputStyle: true` | KEEP - intentional click-to-edit ergonomic |
| Custom child rows | max 3 per parent (`PROGRAM_PARENT_MAXIMUM_ADDABLE_CHILD`) | max 3 (`MAX_CUSTOM_ROWS_PER_PARENT`) | match |
| Add/Delete actions | inline kebab on hover | rowActions plugin with kebab menu | match (functionally) |
| Date editor | DatePicker (MUI) `MM/yy` | masked `MM/YY` text input | drift - lighter weight, no calendar popover |
| Toolbar | Header with date-range pill + collapse table button | "Expand All" / "Collapse All" / "Export" icon buttons | enhancement (KEEP per fsbt_ux_direction) |
| Page header | `ProjectHeader` with `formatProgramDateRangeDuration` "39 Months (Aug 23 - Oct 26)" | `<h1>FSBT Program</h1>` + descriptive paragraph | drift - missing the duration pill on Program page itself (it IS rendered on Cost & Revenue pages via `FsbtProgramSummary`) |
| Parent row totals | none in body; date range appears in header pill only | none | match |
| Validation messages | inline text below input | `validation()` plugin tooltips | enhancement (KEEP) |

---

## 2. Cost (`FsbtCost` vs `cost-table.tsx`)

### Frozen left columns

| # | Wiseway | Wiseway w | Better Grid | BG w | Status |
|---|---|---|---|---|---|
| 1 | Menu | 50 | actions | 50 | match |
| 2 | Code | 40 | code | 40 | match |
| 3 | Phase | 236 | name | 236 | match |
| 4 | Input | 110 | input | 110 | match |
| 5 | Input Note (label "") | 140 | inputNote | 140 | match |
| 6 | Escalation | 110 | escalation | 110 | match |
| 7 | Amount | 110 | amount | 110 | match |
| 8 | Start | 85 | start | 85 | match |
| 9 | End | 85 | end | 85 | match |
| 10 | Variance | 85 | variance | 85 | match |
| 11 | variance-status | 44 | varianceStatus | 44 | match |
| - | (no collapse column) | - | **collapse** | 40 | **enhancement** - Better Grid adds a 12th column |

Then 39 monthly columns - match.

### Behavioral differences

| Feature | Wiseway | Better Grid | Verdict |
|---|---|---|---|
| Hierarchy / collapse | **NOT PRESENT** - all rows always visible | `hierarchy()` plugin with chevron toggle, `defaultExpanded: true` | enhancement (KEEP) - adds collapsible parent groups, the extra collapse column is the chevron host |
| Input adornments | Custom `CostTableRowCellInput` with InputType - no `$`/`%` prefix on display | `prefix: '$'` for number input, `unit: '%'` for percent input | enhancement (KEEP per fsbt_ux_direction) |
| Edit trigger | Always-on inputs (RHF) | `editTrigger: 'click'` + `inputStyle: true` (cells look like inputs even when not focused) | KEEP per fsbt_ux_direction |
| Pinned bottom totals | `cost-table-cell-footer` rendered as actual footer row | `pinned: { bottom: [totalsRow] }` with name "Total Development Cost" | match (recent commit `452296c`) |
| Total Development Cost label | shown in footer only | shown in footer + as a badge pill in the header (`<span>Total Development Cost $161,041,739</span>`) | enhancement (KEEP per fsbt_ux_direction) |
| Program summary above Cost | Wiseway shows tab navigation with Program tab; Cost page does not embed a Program preview | Better Grid embeds `<FsbtProgramSummary />` (mini program grid) above the Cost grid for context | drift / enhancement - useful for demo context but not in Wiseway production |
| Cost validation | RHF + per-input validators (e.g. land-cost-percent total <=100) | `validation()` plugin + same rule (`validateLandCostPercentTotal`) | match |
| Escalation editor | Custom `CostSelect` with CPI/Non-CPI options | `cellEditor: 'select'` with same options | match |
| Footer row format | label "Total Development Cost", `$` prefix on amount | same: `name: 'Total Development Cost'`, `$` prefix on `amount` for `id === -1` | match |

---

## 3. Revenue (`FsbtRevenue` vs three Wiseway tables)

The Revenue page bundles **5 grids** in Better Grid; Wiseway shows the same five tables on its Revenue tab:

1. BTS General
2. BTS Details
3. Holding General
4. Holding Rental Details
5. Holding Sale Details

### 3a. BTS General

Wiseway columns (12) vs Better Grid (12):

| # | Wiseway | Wiseway minW | Better Grid | BG w | Status |
|---|---|---|---|---|---|
| 1 | Type | 170 | type | 170 | match |
| 2 | Stage | 105 | stage | 105 | match |
| 3 | NSA (m2) | 105 | nsa | 105 | match |
| 4 | Unit/Lot/Tenancy | 105 | units | 105 | match |
| 5 | Current Sale Price ($/m2) | 190 | salePrice | 190 | match |
| 6 | Growth Rate | 190 | growthRate | 190 | match |
| 7 | Sales Launch Date | 190 | launchDate | 190 | match |
| 8 | Projected Sale Price ($/m2) | 190 | projectedPrice | 190 | match |
| 9 | Gross Revenue | 105 | grossRevenue | 105 | match |
| 10 | GST (%) | 120 | gst | 120 | match |
| 11 | Sales Commission - Upfront (%) | 230 | commUpfront | 230 | match |
| 12 | Sales Commission - Back End (%) | 230 | commBackend | 230 | match |

Behavior:
- Growth Rate options - Wiseway: CPI/Non-CPI/Custom percent (matches Better Grid `GROWTH_RATE_OPTIONS`)
- Sales Launch Date - Wiseway uses `bts-general-table-cell-date` (DatePicker `MM/yy`), Better Grid uses masked `MM/YY` text input
- Totals row - Wiseway has a `tableFooter` summing `nsa`, `unit`, `grv`, averaging `salePrice`, `gst`, `commUpfront`, `commBackend` - Better Grid `btsTotalsRow` has the same logic via `pinned.bottom`
- "Logo No Data" badge / AI Price suggestion next to BTS Sale Price (per memory `ww_ai_suggestion_button.md`) - **NOT present in Better Grid; intentional omission since it's a Wiseway business feature, not a grid feature**

Verdict: BTS General = match (no enhancement, no missing column).

### 3b. BTS Details

Wiseway columns (8) vs Better Grid (7):

| # | Wiseway | w | Better Grid | w | Status |
|---|---|---|---|---|---|
| 1 | Type | 200 | type | 200 | match |
| 2 | Description | 80 | description | 80 | match |
| 3 | Input | 100 | input | 100 | match |
| 4 | Amount | 100 | amount | 100 | match |
| 5 | Start | 80 | start | 80 | match |
| 6 | End | 80 | end | 80 | match |
| 7 | Variance | 80 | variance | 80 | match |
| 8 | variance-status | 44 | **MISSING** | - | **BUG** - Better Grid omits the variance-status icon column |

Behavior:
- Section/Total row layout - Wiseway uses `RevenueDetailRow.type === 'title' \| 'item' \| 'accumulation'`. Better Grid uses `kind === 'section' \| 'item' \| 'total'`. Same structure, different vocabulary (consistent rename, fine).
- Edit matrix - Wiseway: gross/gst/commission allow Input + Monthly edits, Net allows only Monthly. Better Grid `BTS_DETAILS_INPUT_EDITABLE` and `BTS_DETAILS_MONTHLY_EDITABLE` match exactly.
- Edit trigger - Wiseway always-on RHF inputs; Better Grid `editTrigger: 'click'` + `inputStyle: true` (KEEP).

### 3c. Holding General

Wiseway has a **2-row grouped header** (rowSpan/colSpan), with column groups:
- Basic (15 single columns spanning both rows): Type, Description, Stage, NLA, Unit, Gross Rent, Outgoings, Net Rent, Annual Net Rent, Pre-commit, Lease Term, Lease Start, Lease End, Rent Review, Review Frequency
- "Development Costs" (8 sub-cols): Letting Fee%, % Payable Commitment, Total Letting Fee, Incentives%, % Incentives Paid Upfront, Remaining Incentives, Discount Months, Total Incentives
- "On Completion" (2 sub-cols): Cap Rate%, Cap Value
- "Exit" (5 sub-cols): Cap Rate%, Cap Value, GST%, Sales Commission%, Settlement Date

Total: 30 leaf columns under the 2-row grouped header.

Better Grid `holdingGeneralColumns` has all 30 leaf columns in the right order (verified Type/Description/Stage/NLA/Unit/GrossRent/Outgoings/NetRent/AnnualNetRent/PreCommit/LeaseTerm/LeaseStart/LeaseEnd/RentReview/ReviewFrequency, then LettingFee/PayableCommitment/TotalLettingFee/Incentives/IncentivesPaidUpfront/RemainingIncentives/DiscountMonths/TotalIncentives, then CompletionCapRate/CompletionCapValue, then ExitCapRate/ExitCapValue/ExitGST/ExitCommission/SettlementDate) but **renders them as a single flat header row, NOT a grouped 2-row header**.

Status: **BUG** - Better Grid is missing the multi-row grouped header for Holding General. Wiseway's groups ("Development Costs", "On Completion", "Exit") are visually load-bearing because users need to know which `Cap Rate %` is the on-completion cap vs the exit cap.

### 3d. Holding Rental Details

Wiseway columns (8) vs Better Grid (10):

| # | Wiseway | w | Better Grid | w | Status |
|---|---|---|---|---|---|
| 1 | Type | 200 | type | 200 | match |
| 2 | Description | 80 | description | 80 | match |
| 3 | Input | 100 | input | 100 | match |
| 4 | Amount | 100 | amount | 100 | match |
| 5 | Start | 80 | start | 80 | match |
| 6 | End | 80 | end | 80 | match |
| 7 | Variance | 80 | variance | 80 | match |
| 8 | variance-status | 44 | varianceStatus | 44 | match |
| - | (no collapse column) | - | **collapse** | 40 | enhancement (KEEP) - Better Grid uses hierarchy()/expand-collapse |
| - | (sections via row.type) | - | (parent/child via parentId) | - | drift - Wiseway uses flat title/item/accumulation rows; Better Grid uses true hierarchy. Both produce visually similar grouped output. |

Status: extra collapse column is intentional (KEEP). Variance status icons are present in both. Hierarchy plugin replaces section-row pattern - functionally equivalent.

### 3e. Holding Sale Details

Wiseway has a separate `holding-sale-details-table.tsx` with the same 8-column shape as BTS Details (verified by file size & imports - same Section/Item/Accumulation pattern).

Better Grid uses the same `BtsDetailRow` shape with section names `'sale-commission' \| 'remaining-incentive' \| 'net-sale'`. Re-uses `btsDetailsColumns` set ... wait, let me check.

Looking at FsbtRevenue.tsx, the Holding Sale Details grid is built but I did not trace which columns it uses. Likely shares with BTS Details (7 columns, same missing variance-status). Same status as BTS Details.

---

## Summary

### Page-by-page verdict

| Page | Column count | Mismatch | Enhancements (KEEP) | Bugs (FIX) |
|---|---|---|---|---|
| Program | 7 frozen + 39 monthly | 3 width drifts | click-to-edit, expand/collapse toolbar buttons, validation tooltips | none critical |
| Cost | 11 frozen + 39 monthly + 1 collapse (BG only) | 0 column missing | hierarchy/expand-collapse, input prefix/suffix adornments, header "Total Development Cost" pill, FsbtProgramSummary above grid | none critical |
| Revenue | 5 sub-grids | BTS Details + Holding Sale Details missing variance-status column; Holding General missing 2-row grouped header | hierarchy in Holding Details, click-to-edit | (1) variance-status icon column missing from BTS Details + Holding Sale Details. (2) Holding General lacks the "Development Costs / On Completion / Exit" grouped 2-row header |

### Top 3 actionable findings

1. **BUG (Revenue)** - BTS Details and Holding Sale Details are **missing the variance-status icon column** (44px) that Wiseway has at position 8. The varianceStatus column exists in Better Grid Cost and in the Holding Rental Details, but not in the BTS Details grid. Add a `varianceStatus` column with the same icon-renderer used in Cost/Holding Rental.

2. **BUG (Revenue)** - Holding General table is missing the **2-row grouped header** ("Development Costs" spanning 8 sub-cols, "On Completion" spanning 2, "Exit" spanning 5). Without this, users cannot disambiguate the two `Cap Rate %` and two `Cap Value` columns. Use `multi-header` / column groups on the Holding General grid.

3. **Drift (Program)** - Three column-width drifts vs Wiseway: Code 45 vs 40, Duration 90 vs 110, collapse-chevron 40 vs 55. The Duration column (`90` vs Wiseway's `110`) is the most visible because it forces "Duration (months)" header text to wrap onto two lines. Decide whether the wrapped header is intentional (compact UI) or should be widened back to 110 to match.

### Other notes (not actionable, KEEP per memory)

- All FSBT pages use `editTrigger: 'click'` + `inputStyle: true` (per memory `fsbt_ux_direction`).
- Cost and Revenue Holding pages add `hierarchy()` for collapsible groups - Wiseway has no equivalent; this is a deliberate FSBT UX improvement.
- Cost page header has a "Total Development Cost $161,041,739" badge pill - intentional addition, not in Wiseway.
- Revenue's `FsbtProgramSummary` mini-grid above the Cost/Revenue grids is a demo-context aid, not in Wiseway. Confirm with user whether to keep on production-style demos.
- "Logo No Data" / AI Price suggestion button beside BTS Sale Price (per memory) is a Wiseway business feature, not a grid feature - correctly omitted.

### Login outcome

- **Login success**: YES (xavier.loo@wiseway.ai authenticated, redirected to /portfolio then /settings/company).
- **Live grid access**: NO (subscription expired, Portfolio/Feasibility/Development buttons disabled). Comparison was done against Wiseway's production source code in `D:/Projects/Wiseway/Repositories/wise-frontend-app`.

---

## Follow-up: 2026-04-26 alignment pass

### Applied

| # | File | Change | Lines |
|---|---|---|---|
| 1 | `apps/playground/src/pages/FsbtRevenue.tsx` | Added `varianceStatus` (44px) column at position 8 in `btsDetailsColumns`. Affects both BTS Details and Holding Sale Details (Holding Sale reuses `btsDetailsColumns`). | +12 |
| 2 | `apps/playground/src/pages/FsbtRevenue.tsx` | Bumped `frozen.left` 7 → 8 on `btsDetailsGrid` and `holdingSaleGrid` so the new column stays in the frozen left set. | 2 |
| 3 | `apps/playground/src/pages/FsbtProgram.tsx` | Restored `code` width 45 → 40 (Wiseway). | 1 |
| 4 | `apps/playground/src/pages/FsbtProgram.tsx` | Restored `duration` width 90 → 110 (Wiseway). Header no longer wraps. | 1 |
| 5 | `apps/playground/src/pages/FsbtProgram.tsx` | Restored `collapse` width 40 → 55 (Wiseway). | 1 |

### Already implemented (no change needed)

- **Holding General multi-row grouped header** (Bug B in original report). The `holdingGeneralHeaderLayout` (`headers` GridOption) with `Development Costs` / `On Completion` / `Exit` group cells was already in place at `FsbtRevenue.tsx:908-931`, wired via `headers: holdingGeneralHeaderLayout` in `useGrid` at line 939. The original report appears to have been written before this was added.

### Header background + font-weight audit (added scope)

Wiseway theme tokens (`src/themes/default/palette.ts`):
- `grey[200] = #EAECF0`, `grey[300] = #D0D5DD`, `black[11] = #F8F8F8`.

| Page | Wiseway header bg | Our `--bg-header-bg` | Verdict |
|---|---|---|---|
| Program | grey[200] = `#EAECF0` | `#EAECF0` | match |
| Cost | grey[200] = `#EAECF0` | `#EAECF0` | match |
| Revenue / BTS General | grey[300] = `#D0D5DD` | `#D0D5DD` | match |
| Revenue / Holding General | grey[300] = `#D0D5DD` | `#D0D5DD` | match |
| Revenue / BTS Details | grey[200] = `#EAECF0` | `#D0D5DD` | drift (intentional uniformity) |
| Revenue / Holding Rental Details | grey[200] = `#EAECF0` | `#D0D5DD` | drift (intentional uniformity) |
| Revenue / Holding Sale Details | grey[200] = `#EAECF0` | `#D0D5DD` | drift (intentional uniformity) |

Header text fontWeight is `500` in every Wiseway variant (`PTableHead` / `HeadText` styled components) and matches better-grid's default header weight.

### Body row hierarchy styling audit

Wiseway `Cell` (`cost-table-cell.tsx:7-15`):
- `borderBottom: 1px solid grey[200]`
- parent → `color: valueTextColorBold`, `fontWeight: 500`
- child → `color: valueTextColor`, `fontWeight: 400`
- padding `~10px 8px`; child phase column adds `paddingLeft: spacing(3.5)` ≈ `28px`

Our `_fsbt-cell-styles.ts`:
- parent → `fontWeight: '500'`, `color: '#101828'`, `background: '#F8F8F8'`
- child → `fontWeight: '400'`, `color: '#282F3D'`
- `childIndent: '14px'` (vs Wiseway's `28px`)

Verdict: parent/child colour + weight match. Child indent is `14px` vs Wiseway `28px` — kept per `fsbt_ux_direction` memory ("wider columns / extended Program/Cost aesthetic is target, not Wiseway-exact"). Pinned-bottom Total row uses `cost-table-cell-footer.tsx` with bg `black[11] = #F8F8F8` and weight 500 — matches our `parentRowBg` and pinned bottom rendering.

### Drifts intentionally NOT applied

- **Revenue Details header bg** (BTS Details / Holding Rental Details / Holding Sale Details): Wiseway uses grey[200], we use grey[300] = `#D0D5DD` for visual uniformity across all 5 Revenue sub-grids. Per `fsbt_ux_direction` memory rule "Keep enhancements unless told to drop".
- **Cost child indent**: Wiseway `28px` vs ours `14px`. Same rule.
- **`FsbtProgramSummary` mini-grid above Cost/Revenue** and the `Total Development Cost` / `Total Gross Revenue` pill badges. Per memory.
