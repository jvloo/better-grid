# MUI Theme Integration

Drive Better Grid's appearance from a Material UI theme — palette, typography, density, dark mode — without forking any styles.

## TL;DR

Better Grid exposes ~50 CSS custom properties. A single `styled('div')` wrapper that reads MUI's `theme` and emits the variables is all you need:

```tsx
import { styled } from '@mui/material/styles';

const ThemedGridShell = styled('div')(({ theme }) => ({
  // Typography
  '--bg-font-family': theme.typography.fontFamily,
  '--bg-font-size': theme.typography.body2.fontSize as string,
  '--bg-text-color': theme.palette.text.primary,

  // Surfaces
  '--bg-grid-bg': theme.palette.background.paper,
  '--bg-cell-bg': theme.palette.background.paper,
  '--bg-header-bg': theme.palette.background.default,
  '--bg-grid-border': `1px solid ${theme.palette.divider}`,
  '--bg-cell-border-color': theme.palette.divider,
  '--bg-header-border-color': theme.palette.divider,

  // Interaction
  '--bg-header-hover-bg': theme.palette.action.hover,
  '--bg-active-bg': theme.palette.action.selected,
  '--bg-active-border': theme.palette.primary.main,
  '--bg-selection-bg': theme.palette.action.selected,
  '--bg-selection-range-bg': theme.palette.action.hover,
  '--bg-selection-range-border': theme.palette.primary.main,
  '--bg-stripe-bg': theme.palette.action.hover,

  // Inputs (editing plugin: inputStyle / alwaysInput)
  '--bg-input-bg': theme.palette.background.default,
  '--bg-input-hover-bg': theme.palette.action.hover,
  '--bg-input-placeholder': theme.palette.text.disabled,
  '--bg-input-unit': theme.palette.text.secondary,

  // Validation
  '--bg-error-bg': theme.palette.error.light,
  '--bg-error-border': theme.palette.error.main,
}));

export function CostsTable() {
  return (
    <ThemedGridShell>
      <BetterGrid columns={cols} data={rows} mode="view" />
    </ThemedGridShell>
  );
}
```

Toggle MUI's `ThemeProvider` to `mode: 'dark'` and the grid follows automatically.

## Why CSS variables (not props)

- Zero runtime cost — browsers apply variables natively.
- Cascade aware — a child shell can override the parent's variables.
- SSR-safe — variables resolve in the browser; SSR HTML doesn't need theme info.

## Variable reference

### Surfaces and borders

| Variable                  | Default                | MUI source                    |
| ------------------------- | ---------------------- | ----------------------------- |
| `--bg-grid-bg`            | `#fff`                 | `palette.background.paper`    |
| `--bg-cell-bg`            | `#fff`                 | `palette.background.paper`    |
| `--bg-header-bg`          | `#f8f9fa`              | `palette.background.default`  |
| `--bg-grid-border`        | `1px solid #e0e0e0`    | `1px solid ${palette.divider}` |
| `--bg-cell-border-color`  | `#e8e8e8`              | `palette.divider`             |
| `--bg-header-border-color`| `#e0e0e0`              | `palette.divider`             |
| `--bg-stripe-bg`          | `#fafafa`              | `palette.action.hover`        |
| `--bg-pinned-bg`          | `#f5f6f8`              | `palette.background.default`  |
| `--bg-pinned-border`      | `#d0d0d0`              | `palette.divider`             |
| `--bg-frozen-col-border`  | `#d0d0d0`              | `palette.divider`             |
| `--bg-frozen-col-shadow`  | `2px 0 4px rgba(0,0,0,0.06)` | `theme.shadows[1]`      |

### Typography

| Variable                  | Default                                | MUI source                   |
| ------------------------- | -------------------------------------- | ---------------------------- |
| `--bg-font-family`        | system stack                           | `typography.fontFamily`      |
| `--bg-font-size`          | `14px`                                 | `typography.body2.fontSize`  |
| `--bg-text-color`         | `#1a1a1a`                              | `palette.text.primary`       |
| `--bg-header-font-weight` | `600`                                  | `typography.subtitle2.fontWeight` |

### Cell padding (drives density)

| Variable             | Default   | Compact |
| -------------------- | --------- | ------- |
| `--bg-cell-padding`  | `0 12px`  | `0 8px` |

### Selection and active cell

| Variable                       | Default                       | MUI source                                   |
| ------------------------------ | ----------------------------- | -------------------------------------------- |
| `--bg-selection-bg`            | `rgba(33, 133, 208, 0.15)`    | `alpha(palette.primary.main, 0.12)`          |
| `--bg-selection-range-bg`      | `rgba(33, 133, 208, 0.10)`    | `alpha(palette.primary.main, 0.08)`          |
| `--bg-selection-range-border`  | `#2185D0`                     | `palette.primary.main`                       |
| `--bg-active-bg`               | `rgba(33, 133, 208, 0.20)`    | `alpha(palette.primary.main, 0.16)`          |
| `--bg-active-border`           | `#1a73e8`                     | `palette.primary.main`                       |
| `--bg-frozen-selection-bg`     | `rgba(33, 133, 208, 0.18)`    | `alpha(palette.primary.main, 0.14)`          |

Use `alpha` from `@mui/material/styles` for the rgba mixes.

### Editing inputs (`inputStyle`, `alwaysInput`)

| Variable                  | Default     | MUI source                   |
| ------------------------- | ----------- | ---------------------------- |
| `--bg-input-bg`           | `#F8F8F8`   | `palette.background.default` |
| `--bg-input-hover-bg`     | `#F0F0F0`   | `palette.action.hover`       |
| `--bg-input-placeholder`  | `#98A2B3`   | `palette.text.disabled`      |
| `--bg-input-unit`         | `#98A2B3`   | `palette.text.secondary`     |

### Validation

| Variable             | Default       | MUI source             |
| -------------------- | ------------- | ---------------------- |
| `--bg-error-bg`      | (rule-driven) | `palette.error.light`  |
| `--bg-error-border`  | `#FFAAAA`     | `palette.error.main`   |

For richer error UI (icons, formatting), use the validation plugin's per-rule `messageRenderer` (or per-column `validationMessageRenderer`). The renderer can mount any MUI component into the tooltip body:

```tsx
import { Alert } from '@mui/material';
import { createRoot } from 'react-dom/client';

col.number('qty', {
  rules: [{
    validate: (v) => (v as number) > 0 || 'Required',
    messageRenderer: (issue) => {
      const host = document.createElement('div');
      createRoot(host).render(<Alert severity="error" variant="filled">{issue.message}</Alert>);
      return host;
    },
  }],
});
```

### Dropdowns, filter panels, scrollbars

| Variable                       | Default     | Notes                                       |
| ------------------------------ | ----------- | ------------------------------------------- |
| `--bg-dropdown-bg`             | `#fff`      | select editor menus                         |
| `--bg-dropdown-border`         | `#e0e0e0`   | `palette.divider`                           |
| `--bg-dropdown-hover-bg`       | `#f5f5f5`   | `palette.action.hover`                      |
| `--bg-dropdown-selected-bg`    | `#e3f2fd`   | `alpha(palette.primary.main, 0.12)`         |
| `--bg-filter-panel-bg`         | `#fff`      | filter dropdown background                  |
| `--bg-filter-panel-border`     | `#e0e0e0`   | `palette.divider`                           |
| `--bg-scrollbar-thumb`         | `#c0c0c0`   | `palette.divider`                           |
| `--bg-scrollbar-thumb-hover`   | `#a0a0a0`   | `palette.text.secondary`                    |

## Dark mode

`palette.background.*` and `palette.text.*` flip automatically; the variables above follow. Caveat: a few defaults (e.g. `--bg-input-bg: #F8F8F8`) are too bright in dark mode — set `--bg-input-bg`, `--bg-input-hover-bg`, and `--bg-input-placeholder` explicitly when targeting dark.

## Density tiers

```tsx
const DenseShell = styled('div')<{ density?: 'standard' | 'comfortable' | 'compact' }>(
  ({ density = 'standard' }) => ({
    '--bg-cell-padding': density === 'compact' ? '0 6px'
                       : density === 'comfortable' ? '0 16px'
                       : '0 12px',
    '--bg-font-size': density === 'compact' ? '12px' : '14px',
  }),
);
```

`rowHeight` doesn't auto-derive from CSS — pass it to `<BetterGrid>` per density.

## When CSS variables aren't enough

- **Per-row striping with a custom palette** — set `--bg-stripe-bg` for the variable, plus `cellStyle` on a sentinel column for highlighted rows beyond MUI's `action.hover`.
- **Cell-level styles** — use `column.cellStyle` / `column.cellClass`. CSS variables only control grid chrome.
