# @better-grid/plugins

Free plugins + built-in cell renderers for [`@better-grid/core`](https://www.npmjs.com/package/@better-grid/core). MIT-licensed.

| Plugin            | Adds                                                      |
| ----------------- | --------------------------------------------------------- |
| `editing`         | Click / dblclick / type-to-edit, masked inputs, alwaysInput |
| `sorting`         | Header click, multi-column, custom comparator              |
| `filtering`       | Floating filter panel per column                           |
| `formatting`      | Locale-aware currency / percent / date / number            |
| `validation`      | Required, rules, custom messageRenderer                    |
| `hierarchy`       | Tree rows, indent, expand/collapse                         |
| `clipboard`       | Excel-style copy / paste                                   |
| `grouping`        | Group rows by column                                       |
| `pagination`      | Bottom bar, configurable page size                         |
| `search`          | Global filter input                                        |
| `export`          | CSV / TSV / JSON                                           |
| `undoRedo`        | History stack                                              |
| `cellRenderers`   | `badge`, `progress`, `boolean`, `rating`, `change`, `link`, `timeline`, etc. |
| `autoDetect`      | Infer `cellType` + alignment from data                     |

Most React users let [`@better-grid/react`](https://www.npmjs.com/package/@better-grid/react) wire these via mode presets and the `features` registry — you rarely import plugins directly.

```ts
// Vanilla plugin import (escape hatch)
import { sorting, filtering, editing } from '@better-grid/plugins';
import { createGrid } from '@better-grid/core';

const grid = createGrid({
  columns, data,
  plugins: [sorting(), filtering(), editing({ editTrigger: 'click' })],
});
```

License: MIT — see [LICENSE](./LICENSE). Repo & docs: https://github.com/jvloo/better-grid.
