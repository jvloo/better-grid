# @better-grid/pro

Commercial pro plugins for [`@better-grid/core`](https://www.npmjs.com/package/@better-grid/core). Source-available — see [LICENSE](./LICENSE) for terms.

| Plugin           | Adds                                                  |
| ---------------- | ----------------------------------------------------- |
| `gantt`          | Gantt-chart timeline view                              |
| `aggregation`    | Group / hierarchy aggregations (sum, avg, count, etc.) |
| `mergeCells`     | Spanning cells across rows / columns                   |
| `rowActions`     | Per-row action menu                                    |
| `proRenderers`   | `sparkline`, `heatmap`, `circularProgress`, `avatar`, `miniChart`, `slider`, premium `timeline` / `changeIndicator` / `tooltip` / `loading` |

```ts
import { gantt, aggregation, mergeCells } from '@better-grid/pro';
import { createGrid } from '@better-grid/core';

const grid = createGrid({
  columns, data,
  plugins: [aggregation(), mergeCells(), gantt({ /* ... */ })],
});
```

## License

`@better-grid/pro` is **source-available** — see [LICENSE](./LICENSE). Production use (anything serving end-users outside your org, processing customer data, etc.) requires a commercial license. Internal evaluation, prototyping, and development use are free.

Repo & docs: https://github.com/jvloo/better-grid.
