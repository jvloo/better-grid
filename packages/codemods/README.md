# @better-grid/codemods

One-shot codemods that migrate to Better Grid from AG Grid, MUI X Data Grid, TanStack Table, Handsontable, RevoGrid, and react-data-grid.

## Install / use

```bash
npx @better-grid/codemods from-ag-grid src/
npx @better-grid/codemods from-mui-x-data-grid src/
npx @better-grid/codemods from-tanstack-table src/
npx @better-grid/codemods from-handsontable src/
npx @better-grid/codemods from-revogrid src/
npx @better-grid/codemods from-react-data-grid src/
```

Flags:
- `--dry-run` print the would-be diff, don't write
- `--report=<path>` write a JSON summary
- `--ext=ts,tsx,js,jsx` file extensions to process

## What's auto-converted vs flagged

See each transform's README under `src/transforms/from-<lib>/`.
