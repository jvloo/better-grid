# MUI Theme Integration

How to drive Better Grid's appearance from a Material UI theme — palette, typography, density, dark mode — without forking any styles.

## TL;DR

Better Grid exposes ~50 CSS custom properties that override its defaults. Set them inside any selector (`:root`, a portal container, a wrapper around `<BetterGrid>`) and the grid picks them up immediately. The cleanest pattern is a `styled('div')` wrapper that reads MUI's `theme` and emits the variables.

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

  // Inputs (used by editing plugin's inputStyle / alwaysInput cells)
  '--bg-input-bg': theme.palette.background.default,
  '--bg-input-hover-bg': theme.palette.action.hover,
  '--bg-input-placeholder': theme.palette.text.disabled,
  '--bg-input-unit': theme.palette.text.secondary,

  // Validation
  '--bg-error-bg': theme.palette.error.light,
  '--bg-error-border': theme.palette.error.main,
}));

export function MyTable() {
  return (
    <ThemedGridShell>
      <BetterGrid columns={cols} data={rows} mode="view" />
    </ThemedGridShell>
  );
}
```

That's it. Toggle MUI's `ThemeProvider` to `mode: 'dark'` and the grid follows automatically — every variable re-resolves through the theme on the next render.

## Why CSS variables (not props)

- **Zero runtime cost.** Browsers apply CSS variables natively; no React tree updates, no style prop diffing.
- **Cascade aware.** A child `<ThemedGridShell mode="dense">` can override the parent's variables without any prop drilling.
- **Server-render safe.** Variables resolve in the browser; SSR HTML doesn't need to know the theme.

## Variable reference

### Surfaces and borders

| Variable | Default | Suggested MUI source |
|---|---|---|
| `--bg-grid-bg` | `#fff` | `palette.background.paper` |
| `--bg-cell-bg` | `#fff` | `palette.background.paper` |
| `--bg-header-bg` | `#f8f9fa` | `palette.background.default` |
| `--bg-grid-border` | `1px solid #e0e0e0` | `1px solid ${palette.divider}` |
| `--bg-cell-border-color` | `#e8e8e8` | `palette.divider` |
| `--bg-header-border-color` | `#e0e0e0` | `palette.divider` |
| `--bg-stripe-bg` | `#fafafa` | `palette.action.hover` |
| `--bg-pinned-bg` | `#f5f6f8` | `palette.background.default` |
| `--bg-pinned-border` | `#d0d0d0` | `palette.divider` |
| `--bg-frozen-col-border` | `#d0d0d0` | `palette.divider` |
| `--bg-frozen-col-shadow` | `2px 0 4px rgba(0,0,0,0.06)` | `theme.shadows[1]` |

### Typography

| Variable | Default | Suggested MUI source |
|---|---|---|
| `--bg-font-family` | system stack | `typography.fontFamily` |
| `--bg-font-size` | `14px` | `typography.body2.fontSize` |
| `--bg-text-color` | `#1a1a1a` | `palette.text.primary` |
| `--bg-header-font-weight` | `600` | `typography.subtitle2.fontWeight` |

### Cell padding (drives density)

| Variable | Default | For dense |
|---|---|---|
| `--bg-cell-padding` | `0 12px` | `0 8px` |

Switching to MUI's "compact" density:

```tsx
const compact = theme.palette.mode === 'dark' ? '0 6px' : '0 8px';
'--bg-cell-padding': compact,
```

### Selection and active cell

| Variable | Default | Suggested MUI source |
|---|---|---|
| `--bg-selection-bg` | `rgba(33, 133, 208, 0.15)` | `alpha(palette.primary.main, 0.12)` |
| `--bg-selection-range-bg` | `rgba(33, 133, 208, 0.10)` | `alpha(palette.primary.main, 0.08)` |
| `--bg-selection-range-border` | `#2185D0` | `palette.primary.main` |
| `--bg-active-bg` | `rgba(33, 133, 208, 0.20)` | `alpha(palette.primary.main, 0.16)` |
| `--bg-active-border` | `#1a73e8` | `palette.primary.main` |
| `--bg-frozen-selection-bg` | `rgba(33, 133, 208, 0.18)` | `alpha(palette.primary.main, 0.14)` |

Use `alpha` from `@mui/material/styles` for the rgba mixes.

### Editing inputs (`inputStyle`, `alwaysInput`)

| Variable | Default | Suggested MUI source |
|---|---|---|
| `--bg-input-bg` | `#F8F8F8` | `palette.background.default` |
| `--bg-input-hover-bg` | `#F0F0F0` | `palette.action.hover` |
| `--bg-input-placeholder` | `#98A2B3` | `palette.text.disabled` |
| `--bg-input-unit` | `#98A2B3` | `palette.text.secondary` |

### Validation

| Variable | Default | Suggested MUI source |
|---|---|---|
| `--bg-error-bg` | (rule-driven) | `palette.error.light` |
| `--bg-error-border` | `#FFAAAA` | `palette.error.main` |

For richer error UI (icons, text formatting), use the per-rule `messageRenderer` callback exposed by the validation plugin (`ColumnValidationRule.messageRenderer` / `ColumnDef.validationMessageRenderer`). The renderer can mount any MUI component into the tooltip body:

```tsx
import { Alert } from '@mui/material';
import { createRoot } from 'react-dom/client';

col.number('qty', {
  rules: [{
    validate: (v) => (v as number) > 0 || 'Required',
    messageRenderer: (issue) => {
      const host = document.createElement('div');
      createRoot(host).render(
        <Alert severity="error" variant="filled">
          {issue.message}
        </Alert>
      );
      return host;
    },
  }],
});
```

### Dropdowns, filter panels, scrollbars

| Variable | Default | Notes |
|---|---|---|
| `--bg-dropdown-bg` | `#fff` | Used by select editor menus |
| `--bg-dropdown-border` | `#e0e0e0` | `palette.divider` |
| `--bg-dropdown-hover-bg` | `#f5f5f5` | `palette.action.hover` |
| `--bg-dropdown-selected-bg` | `#e3f2fd` | `alpha(palette.primary.main, 0.12)` |
| `--bg-filter-panel-bg` | `#fff` | Filter dropdown background |
| `--bg-filter-panel-border` | `#e0e0e0` | `palette.divider` |
| `--bg-scrollbar-thumb` | `#c0c0c0` | `palette.divider` |
| `--bg-scrollbar-thumb-hover` | `#a0a0a0` | `palette.text.secondary` |

## Dark mode

MUI's dark mode flips `palette.background.*` and `palette.text.*`. Because every variable in the table above sources from those tokens, your grid follows automatically:

```tsx
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useState } from 'react';

const theme = (mode: 'light' | 'dark') => createTheme({ palette: { mode } });

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  return (
    <ThemeProvider theme={theme(mode)}>
      <CssBaseline />
      <button onClick={() => setMode(m => m === 'light' ? 'dark' : 'light')}>
        Toggle theme
      </button>
      <ThemedGridShell>
        <BetterGrid columns={cols} data={rows} mode="view" />
      </ThemedGridShell>
    </ThemeProvider>
  );
}
```

Caveat: a few defaults (e.g. `--bg-input-bg: #F8F8F8`) read fine in light mode but are too bright in dark. Always set `--bg-input-bg`, `--bg-input-hover-bg`, and `--bg-input-placeholder` explicitly when targeting dark mode.

## Density tiers

Wrap the grid with a density-aware shell to switch row height + padding together:

```tsx
const DenseShell = styled('div')<{ density?: 'standard' | 'comfortable' | 'compact' }>(
  ({ theme, density = 'standard' }) => ({
    '--bg-cell-padding': density === 'compact' ? '0 6px'
                       : density === 'comfortable' ? '0 16px'
                       : '0 12px',
    '--bg-font-size': density === 'compact' ? '12px' : '14px',
  }),
);
```

Then pass `rowHeight` to `<BetterGrid>` per density (Better Grid doesn't auto-derive row height from CSS — it needs the px value at layout time).

## When CSS variables aren't enough

Two cases call for direct CSS:

1. **Per-row striping with a custom palette** — set `--bg-stripe-bg` for the variable, then use `cellStyle` on a sentinel column for striped highlight beyond MUI's `action.hover`.
2. **Cell-level styles** (per-row background, conditional color) — use `column.cellStyle` or `column.cellClass`. CSS variables only control grid chrome; row-level appearance is per-cell.

For everything else: a single `styled` wrapper is enough.
