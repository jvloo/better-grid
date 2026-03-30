// ============================================================================
// Hierarchy Plugin — Row tree with expand/collapse
// ============================================================================

import type { GridPlugin, PluginContext, CellRenderContext } from '@better-grid/core';

export interface HierarchyOptions {
  /** Which column shows the expand/collapse toggle. Default: first column */
  expandColumn?: string;
  /** Pixels of indent per tree depth level. Default: 20 */
  indentSize?: number;
  /** Custom expand icon (collapsed state). Default: '\u25b8' */
  expandIcon?: string;
  /** Custom collapse icon (expanded state). Default: '\u25be' */
  collapseIcon?: string;
}

export interface HierarchyApi {
  toggleRow(rowId: string | number): void;
  expandAll(): void;
  collapseAll(): void;
  getDepth(rowId: string | number): number;
  isExpanded(rowId: string | number): boolean;
  hasChildren(rowId: string | number): boolean;
}

export function hierarchy(options?: HierarchyOptions): GridPlugin<'hierarchy'> {
  const indentSize = options?.indentSize ?? 20;
  const expandIcon = options?.expandIcon ?? '\u25b8';
  const collapseIcon = options?.collapseIcon ?? '\u25be';

  return {
    id: 'hierarchy',

    init(ctx: PluginContext) {
      const grid = ctx.grid;
      const store = ctx.store;

      // Determine the expand column (first column by default)
      const expandColId = options?.expandColumn ?? store.getState().columns[0]?.id;

      // Wrap the expand column's cellRenderer to prepend indent + toggle
      const columns = store.getState().columns;
      const col = columns.find(c => c.id === expandColId);
      if (col) {
        const originalRenderer = col.cellRenderer;

        col.cellRenderer = (container: HTMLElement, context: CellRenderContext) => {
          const state = store.getState();
          const hs = state.hierarchyState;

          if (!hs) {
            // No hierarchy configured — fallback to original or default
            if (originalRenderer) {
              return originalRenderer(container, context);
            }
            container.textContent = context.value != null ? String(context.value) : '';
            return;
          }

          // Get hierarchy info for this row via the dataIndexToRowId map
          const dataIndex = hs.visibleRows[context.rowIndex];
          if (dataIndex === undefined) {
            container.textContent = context.value != null ? String(context.value) : '';
            return;
          }

          const rowId = hs.dataIndexToRowId.get(dataIndex);
          if (rowId === undefined) {
            container.textContent = context.value != null ? String(context.value) : '';
            return;
          }

          const depth = hs.rowDepths.get(rowId) ?? 0;
          const isParent = hs.parentIds.has(rowId);
          const isExpanded = hs.expandedRows.has(rowId);

          // Clear container
          container.textContent = '';

          // Apply indent via padding
          const basePadding = 8;
          container.style.paddingLeft = `${basePadding + depth * indentSize}px`;

          // Add CSS classes for styling hooks
          container.classList.toggle('bg-cell--parent', isParent);
          container.classList.toggle('bg-cell--leaf', !isParent);
          container.classList.toggle('bg-cell--expanded', isParent && isExpanded);
          container.classList.toggle('bg-cell--collapsed', isParent && !isExpanded);
          // Add depth class (cap at 10 to avoid unbounded class names)
          for (let d = 0; d <= 10; d++) {
            container.classList.toggle(`bg-cell--depth-${d}`, d === depth);
          }

          // Add toggle icon if row has children
          if (isParent) {
            const toggle = document.createElement('span');
            toggle.className = 'bg-hierarchy-toggle';
            toggle.textContent = isExpanded ? collapseIcon : expandIcon;
            toggle.style.cursor = 'pointer';
            toggle.style.marginRight = '6px';
            toggle.style.userSelect = 'none';
            toggle.style.display = 'inline-block';
            toggle.style.width = '12px';
            toggle.style.textAlign = 'center';
            toggle.addEventListener('click', (e) => {
              e.stopPropagation();
              grid.toggleRow(rowId);
            });
            container.appendChild(toggle);
          } else {
            // Spacer for leaf alignment with parent toggle icons
            const spacer = document.createElement('span');
            spacer.style.display = 'inline-block';
            spacer.style.width = '18px'; // icon width + margin
            container.appendChild(spacer);
          }

          // Render value content
          if (originalRenderer) {
            // Create a wrapper for the original renderer's content
            const contentWrapper = document.createElement('span');
            contentWrapper.className = 'bg-hierarchy-content';
            container.appendChild(contentWrapper);
            return originalRenderer(contentWrapper, context);
          } else {
            const textNode = document.createTextNode(
              context.value != null ? String(context.value) : '',
            );
            container.appendChild(textNode);
          }
        };

        // Force column update in store so the renderer change takes effect
        store.update('columns', () => ({
          columns: [...columns],
        }));
      }

      // Register key bindings for expand/collapse
      const unregArrowRight = ctx.registerKeyBinding({
        key: 'ArrowRight',
        priority: 5,
        handler: (_event, activeCell) => {
          if (!activeCell) return false;
          const state = store.getState();
          const hs = state.hierarchyState;
          if (!hs) return false;

          const dataIndex = hs.visibleRows[activeCell.rowIndex];
          if (dataIndex === undefined) return false;
          const rowId = hs.dataIndexToRowId.get(dataIndex);
          if (rowId === undefined) return false;

          // Only handle if this is a collapsed parent
          if (hs.parentIds.has(rowId) && !hs.expandedRows.has(rowId)) {
            grid.toggleRow(rowId);
            return true;
          }
          return false;
        },
      });

      const unregArrowLeft = ctx.registerKeyBinding({
        key: 'ArrowLeft',
        priority: 5,
        handler: (_event, activeCell) => {
          if (!activeCell) return false;
          const state = store.getState();
          const hs = state.hierarchyState;
          if (!hs) return false;

          const dataIndex = hs.visibleRows[activeCell.rowIndex];
          if (dataIndex === undefined) return false;
          const rowId = hs.dataIndexToRowId.get(dataIndex);
          if (rowId === undefined) return false;

          // Only handle if this is an expanded parent
          if (hs.parentIds.has(rowId) && hs.expandedRows.has(rowId)) {
            grid.toggleRow(rowId);
            return true;
          }
          return false;
        },
      });

      // Expose API
      ctx.expose({
        toggleRow: (rowId: string | number) => grid.toggleRow(rowId),
        expandAll: () => grid.expandAll(),
        collapseAll: () => grid.collapseAll(),
        getDepth: (rowId: string | number): number => {
          return store.getState().hierarchyState?.rowDepths.get(rowId) ?? 0;
        },
        isExpanded: (rowId: string | number): boolean => {
          return store.getState().hierarchyState?.expandedRows.has(rowId) ?? false;
        },
        hasChildren: (rowId: string | number): boolean => {
          return store.getState().hierarchyState?.parentIds.has(rowId) ?? false;
        },
      } satisfies HierarchyApi);

      return () => {
        unregArrowRight();
        unregArrowLeft();
      };
    },
  };
}
