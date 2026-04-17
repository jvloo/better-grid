// ============================================================================
// Hierarchy Plugin — Row tree with expand/collapse
// ============================================================================

import type { GridPlugin, PluginContext, CellRenderContext } from '@better-grid/core';

export interface HierarchyOptions {
  /** Which column gets depth-based indentation (padding-left per depth level). */
  indentColumn?: string;

  /** Pixels of indent per tree depth level. Default: 20 */
  indentSize?: number;

  /**
   * Which column shows the expand/collapse toggle icon.
   * Can be the same as indentColumn (classic tree-view) or a different column
   * (e.g. the last frozen column for a Wiseway-style layout).
   */
  toggleColumn?: string;

  /**
   * Toggle icon style. Default: 'triangle'
   * - 'triangle': text characters ▸/▾ (classic tree view)
   * - 'chevron': SVG chevron arrow with 180° rotation animation
   */
  toggleStyle?: 'triangle' | 'chevron';

  /** Custom expand icon for 'triangle' style (collapsed state). Default: '▸' */
  expandIcon?: string;
  /** Custom collapse icon for 'triangle' style (expanded state). Default: '▾' */
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

const CHEVRON_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function hierarchy(options?: HierarchyOptions): GridPlugin<'hierarchy'> {
  const indentSize = options?.indentSize ?? 20;
  const expandIcon = options?.expandIcon ?? '\u25b8';
  const collapseIcon = options?.collapseIcon ?? '\u25be';
  const toggleStyle = options?.toggleStyle ?? 'triangle';

  return {
    id: 'hierarchy',

    init(ctx: PluginContext) {
      const grid = ctx.grid;
      const store = ctx.store;

      const columns = store.getState().columns;

      // Resolve column IDs
      const indentColId = options?.indentColumn;
      const toggleColId = options?.toggleColumn;
      const hasSeparateToggle = toggleColId != null && toggleColId !== indentColId;

      // ─── Helper: get hierarchy info for a row ───────────────────────
      function getHierarchyInfo(context: CellRenderContext) {
        const state = store.getState();
        const hs = state.hierarchyState;
        if (!hs) return null;

        const dataIndex = hs.visibleRows[context.rowIndex];
        if (dataIndex === undefined) return null;

        const rowId = hs.dataIndexToRowId.get(dataIndex);
        if (rowId === undefined) return null;

        return {
          depth: hs.rowDepths.get(rowId) ?? 0,
          isParent: hs.parentIds.has(rowId),
          isExpanded: hs.expandedRows.has(rowId),
          rowId,
        };
      }

      // ─── Helper: render toggle icon ─────────────────────────────────
      function renderToggle(container: HTMLElement, isExpanded: boolean, rowId: string | number) {
        if (toggleStyle === 'chevron') {
          const arrow = document.createElement('span');
          arrow.className = 'bg-hierarchy-toggle';
          arrow.setAttribute('role', 'button');
          arrow.setAttribute('aria-label', isExpanded ? 'Collapse row' : 'Expand row');
          arrow.style.display = 'inline-flex';
          arrow.style.transition = 'transform 0.3s ease-out';
          arrow.style.cursor = 'pointer';
          arrow.style.userSelect = 'none';
          arrow.style.color = '#667085';
          arrow.innerHTML = CHEVRON_SVG;
          arrow.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

          let currentExpanded = isExpanded;
          arrow.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            grid.toggleRow(rowId);
            currentExpanded = !currentExpanded;
            arrow.style.transform = currentExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
          });
          container.appendChild(arrow);
        } else {
          const toggle = document.createElement('span');
          toggle.className = 'bg-hierarchy-toggle';
          toggle.setAttribute('role', 'button');
          toggle.setAttribute('aria-label', isExpanded ? 'Collapse row' : 'Expand row');
          toggle.textContent = isExpanded ? collapseIcon : expandIcon;
          toggle.style.cursor = 'pointer';
          toggle.style.marginRight = '6px';
          toggle.style.userSelect = 'none';
          toggle.style.display = 'inline-block';
          toggle.style.width = '12px';
          toggle.style.textAlign = 'center';
          toggle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            grid.toggleRow(rowId);
          });
          container.appendChild(toggle);
        }
      }

      // ─── Wrap indent column (indent + optionally toggle) ────────────
      const indentCol = indentColId ? columns.find(c => c.id === indentColId) : undefined;
      if (indentCol) {
        const alreadyWrapped = indentCol.cellRenderer && '__hierarchyOriginal' in (indentCol.cellRenderer as object);
        const originalRenderer = alreadyWrapped
          ? (indentCol.cellRenderer as unknown as { __hierarchyOriginal: typeof indentCol.cellRenderer }).__hierarchyOriginal
          : indentCol.cellRenderer;

        indentCol.cellRenderer = (container: HTMLElement, context: CellRenderContext) => {
          const info = getHierarchyInfo(context);

          if (!info || container.classList.contains('bg-cell--pinned')) {
            if (originalRenderer) return originalRenderer(container, context);
            container.textContent = context.value != null ? String(context.value) : '';
            return;
          }

          const { depth, isParent, isExpanded, rowId } = info;

          container.textContent = '';

          // ARIA: expose depth + expand/collapse state on the cell
          container.setAttribute('aria-level', String(depth + 1));
          if (isParent) {
            container.setAttribute('aria-expanded', String(isExpanded));
          } else {
            container.removeAttribute('aria-expanded');
          }

          // Apply indent
          const basePadding = 8;
          container.style.paddingLeft = `${basePadding + depth * indentSize}px`;

          // CSS classes for styling hooks
          container.classList.toggle('bg-cell--parent', isParent);
          container.classList.toggle('bg-cell--leaf', !isParent);
          container.classList.toggle('bg-cell--expanded', isParent && isExpanded);
          container.classList.toggle('bg-cell--collapsed', isParent && !isExpanded);
          for (let d = 0; d <= 10; d++) {
            container.classList.toggle(`bg-cell--depth-${d}`, d === depth);
          }

          // Embed toggle if no separate toggle column
          if (!hasSeparateToggle) {
            if (isParent) {
              renderToggle(container, isExpanded, rowId);
            } else {
              const spacer = document.createElement('span');
              spacer.style.display = 'inline-block';
              spacer.style.width = '18px';
              container.appendChild(spacer);
            }
          }

          // Render value content
          if (originalRenderer) {
            const contentWrapper = document.createElement('span');
            contentWrapper.className = 'bg-hierarchy-content';
            container.appendChild(contentWrapper);
            return originalRenderer(contentWrapper, context);
          } else {
            container.appendChild(
              document.createTextNode(context.value != null ? String(context.value) : ''),
            );
          }
        };

        (indentCol.cellRenderer as unknown as { __hierarchyOriginal?: typeof originalRenderer }).__hierarchyOriginal = originalRenderer;
      }

      // ─── Wrap toggle column (toggle icon only, no indent) ───────────
      if (hasSeparateToggle) {
        const toggleCol = columns.find(c => c.id === toggleColId);
        if (toggleCol) {
          const alreadyWrapped = toggleCol.cellRenderer && '__hierarchyToggleOriginal' in (toggleCol.cellRenderer as object);
          const originalToggleRenderer = alreadyWrapped
            ? (toggleCol.cellRenderer as unknown as { __hierarchyToggleOriginal: typeof toggleCol.cellRenderer }).__hierarchyToggleOriginal
            : toggleCol.cellRenderer;

          toggleCol.cellRenderer = (container: HTMLElement, context: CellRenderContext) => {
            const info = getHierarchyInfo(context);

            // Always clear container first — cells are recycled and may have stale content
            container.textContent = '';
            container.style.display = '';
            container.style.cursor = '';

            if (!info || container.classList.contains('bg-cell--pinned')) {
              if (originalToggleRenderer) return originalToggleRenderer(container, context);
              container.textContent = context.value != null ? String(context.value) : '';
              return;
            }

            const { isParent, isExpanded, rowId } = info;

            // Run original renderer (for background color, etc.)
            if (originalToggleRenderer) {
              originalToggleRenderer(container, context);
            }

            if (isParent) {
              // Clear any text/children from original renderer, keep styles (e.g. backgroundColor)
              container.textContent = '';
              container.style.display = 'flex';
              container.style.alignItems = 'center';
              container.style.justifyContent = 'center';
              container.style.cursor = 'pointer';
              renderToggle(container, isExpanded, rowId);
            }
          };

          (toggleCol.cellRenderer as unknown as { __hierarchyToggleOriginal?: typeof originalToggleRenderer }).__hierarchyToggleOriginal = originalToggleRenderer;
        }
      }

      // Force column update so renderer changes take effect
      const needsUpdate = indentCol || (hasSeparateToggle && columns.find(c => c.id === toggleColId));
      if (needsUpdate) {
        store.update('columns', () => ({ columns: [...columns] }));
      }

      // Key bindings for expand/collapse
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
