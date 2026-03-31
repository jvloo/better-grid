// ============================================================================
// Merge Cells Plugin — Cell spanning across rows and columns (Pro)
// ============================================================================

import type { GridPlugin, PluginContext } from '@better-grid/core';

export interface MergeCellDef {
  /** Starting row index */
  row: number;
  /** Starting column index */
  col: number;
  /** Number of rows to span. Default: 1 */
  rowSpan?: number;
  /** Number of columns to span. Default: 1 */
  colSpan?: number;
}

export interface MergeCellsOptions {
  /** Static list of merged cell ranges */
  cells?: MergeCellDef[];
}

export interface MergeCellsApi {
  addMerge(merge: MergeCellDef): void;
  removeMerge(row: number, col: number): void;
  clearMerges(): void;
  getMerges(): MergeCellDef[];
  getMergeAt(row: number, col: number): MergeCellDef | null;
}

export function mergeCells(options?: MergeCellsOptions): GridPlugin<'mergeCells'> {
  return {
    id: 'mergeCells',

    init(ctx: PluginContext) {
      const merges = new Map<string, MergeCellDef>();
      const coveredBy = new Map<string, string>();

      function k(row: number, col: number): string { return `${row}:${col}`; }

      function rebuildCoveredMap(): void {
        coveredBy.clear();
        for (const [originKey, merge] of merges) {
          const rs = merge.rowSpan ?? 1;
          const cs = merge.colSpan ?? 1;
          for (let r = 0; r < rs; r++) {
            for (let c = 0; c < cs; c++) {
              if (r === 0 && c === 0) continue;
              coveredBy.set(k(merge.row + r, merge.col + c), originKey);
            }
          }
        }
      }

      // Initialize from options
      if (options?.cells) {
        for (const m of options.cells) {
          merges.set(k(m.row, m.col), { ...m, rowSpan: m.rowSpan ?? 1, colSpan: m.colSpan ?? 1 });
        }
        rebuildCoveredMap();
      }

      // After each render, post-process DOM to apply merges
      const unsubRender = ctx.on('render', () => {
        const container = ctx.grid.getContainer();
        if (!container || merges.size === 0) return;

        // Build a quick lookup of rendered cells by row:col
        const cellMap = new Map<string, HTMLElement>();
        const allCells = container.querySelectorAll<HTMLElement>('.bg-cell[data-row][data-col]');
        for (const el of allCells) {
          const key = `${el.dataset.row}:${el.dataset.col}`;
          cellMap.set(key, el);
        }

        // Process merges
        for (const [originKey, merge] of merges) {
          const rs = merge.rowSpan ?? 1;
          const cs = merge.colSpan ?? 1;
          if (rs <= 1 && cs <= 1) continue;

          const originEl = cellMap.get(originKey);
          if (!originEl) continue; // Origin not in viewport

          // Parse origin position
          const originWidth = parseFloat(originEl.style.width) || 0;
          const originHeight = parseFloat(originEl.style.height) || 0;

          // Calculate expanded width by summing widths of spanned columns
          let expandedWidth = originWidth;
          if (cs > 1) {
            for (let c = 1; c < cs; c++) {
              const coveredEl = cellMap.get(k(merge.row, merge.col + c));
              if (coveredEl) {
                expandedWidth += parseFloat(coveredEl.style.width) || 0;
                // Account for border (1px right border per cell)
                expandedWidth += 1;
              }
            }
          }

          // Calculate expanded height by summing heights of spanned rows
          let expandedHeight = originHeight;
          if (rs > 1) {
            for (let r = 1; r < rs; r++) {
              const coveredEl = cellMap.get(k(merge.row + r, merge.col));
              if (coveredEl) {
                expandedHeight += parseFloat(coveredEl.style.height) || 0;
                expandedHeight += 1; // border
              }
            }
          }

          // Apply expanded size to origin
          originEl.style.width = `${expandedWidth}px`;
          originEl.style.height = `${expandedHeight}px`;
          originEl.style.lineHeight = `${expandedHeight}px`;
          originEl.style.zIndex = '3';
          originEl.classList.add('bg-cell--merged');

          // Hide covered cells
          for (let r = 0; r < rs; r++) {
            for (let c = 0; c < cs; c++) {
              if (r === 0 && c === 0) continue;
              const coveredEl = cellMap.get(k(merge.row + r, merge.col + c));
              if (coveredEl) {
                coveredEl.style.display = 'none';
                coveredEl.classList.add('bg-cell--merge-hidden');
              }
            }
          }
        }
      });

      // API
      function addMerge(merge: MergeCellDef): void {
        merges.set(k(merge.row, merge.col), { ...merge, rowSpan: merge.rowSpan ?? 1, colSpan: merge.colSpan ?? 1 });
        rebuildCoveredMap();
        ctx.grid.refresh();
      }

      function removeMerge(row: number, col: number): void {
        merges.delete(k(row, col));
        rebuildCoveredMap();
        ctx.grid.refresh();
      }

      function clearMerges(): void {
        merges.clear();
        coveredBy.clear();
        ctx.grid.refresh();
      }

      function getMergeAt(row: number, col: number): MergeCellDef | null {
        const origin = merges.get(k(row, col));
        if (origin) return origin;
        const originKey = coveredBy.get(k(row, col));
        return originKey ? merges.get(originKey) ?? null : null;
      }

      ctx.expose({
        addMerge,
        removeMerge,
        clearMerges,
        getMerges: () => Array.from(merges.values()),
        getMergeAt,
      } satisfies MergeCellsApi);

      return () => { unsubRender(); };
    },
  };
}
