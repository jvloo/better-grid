// ============================================================================
// Row Actions Plugin — Dropdown menu per row with configurable actions
// ============================================================================

import type { GridPlugin, PluginContext, CellRenderContext } from '@better-grid/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RowAction {
  /** Unique action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon HTML (optional, prepended to label) */
  icon?: string;
  /** Whether this action is disabled */
  disabled?: boolean;
  /** Tooltip shown when disabled */
  disabledTooltip?: string;
}

export interface RowActionsOptions {
  /** Column id that hosts the action menu. The plugin wraps this column's renderer. */
  column: string;
  /**
   * Return the list of actions for a given row.
   * Return empty array or undefined to hide the menu for that row.
   */
  getActions: (row: unknown, rowIndex: number) => RowAction[] | undefined;
  /**
   * Called when an action is selected.
   */
  onAction: (actionId: string, row: unknown, rowIndex: number) => void;
  /** Icon for the menu trigger button. Default: vertical 3-dot (⋮) */
  menuIcon?: string;
}

export interface RowActionsApi {
  /** Programmatically close the open menu */
  closeMenu(): void;
}

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

const DOT_VERTICAL_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="4" r="2" fill="currentColor"/><circle cx="10" cy="10" r="2" fill="currentColor"/><circle cx="10" cy="16" r="2" fill="currentColor"/></svg>';

const PLUS_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

const TRASH_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export function rowActions(options: RowActionsOptions): GridPlugin<'rowActions'> {
  return {
    id: 'rowActions',

    init(ctx: PluginContext) {
      const store = ctx.store;
      let openMenu: HTMLElement | null = null;
      let openMenuCleanup: (() => void) | null = null;

      const menuIcon = options.menuIcon ?? DOT_VERTICAL_SVG;

      function closeMenu(): void {
        if (openMenu) {
          openMenu.remove();
          openMenu = null;
        }
        if (openMenuCleanup) {
          openMenuCleanup();
          openMenuCleanup = null;
        }
      }

      function showMenu(
        anchorEl: HTMLElement,
        actions: RowAction[],
        row: unknown,
        rowIndex: number,
      ): void {
        closeMenu();

        const menu = document.createElement('div');
        menu.className = 'bg-row-actions-menu';
        menu.style.position = 'fixed';
        menu.style.zIndex = '10000';
        menu.style.background = '#fff';
        menu.style.border = '1px solid #EAECF0';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = '0 4px 12px rgba(16, 24, 40, 0.12)';
        menu.style.padding = '4px 0';
        menu.style.minWidth = '140px';
        menu.style.fontFamily = 'inherit';

        for (const action of actions) {
          const item = document.createElement('div');
          item.className = 'bg-row-actions-menu-item';
          item.style.padding = '8px 12px';
          item.style.cursor = action.disabled ? 'default' : 'pointer';
          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.gap = '8px';
          item.style.fontSize = '14px';
          item.style.color = action.disabled ? '#98A2B3' : '#344054';
          item.style.opacity = action.disabled ? '0.6' : '1';
          item.style.userSelect = 'none';

          if (action.icon) {
            const iconEl = document.createElement('span');
            iconEl.style.display = 'inline-flex';
            iconEl.style.width = '16px';
            iconEl.style.height = '16px';
            iconEl.style.flexShrink = '0';
            iconEl.innerHTML = action.icon;
            item.appendChild(iconEl);
          }

          const label = document.createElement('span');
          label.textContent = action.label;
          item.appendChild(label);

          if (!action.disabled) {
            item.addEventListener('mouseenter', () => {
              item.style.backgroundColor = '#F9FAFB';
            });
            item.addEventListener('mouseleave', () => {
              item.style.backgroundColor = '';
            });
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              closeMenu();
              options.onAction(action.id, row, rowIndex);
            });
          } else if (action.disabledTooltip) {
            item.title = action.disabledTooltip;
          }

          menu.appendChild(item);
        }

        // Position below anchor
        const rect = anchorEl.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 2}px`;

        document.body.appendChild(menu);
        openMenu = menu;

        // Close on outside click (delayed to avoid catching the trigger click)
        const onDocClick = (e: MouseEvent) => {
          if (!menu.contains(e.target as Node)) {
            closeMenu();
          }
        };
        requestAnimationFrame(() => {
          document.addEventListener('click', onDocClick, { capture: true });
        });

        // Close on scroll
        const gridContainer = ctx.grid.getContainer();
        const scrollEl = gridContainer?.querySelector('.bg-grid__scroll');
        const onScroll = () => closeMenu();
        scrollEl?.addEventListener('scroll', onScroll);

        openMenuCleanup = () => {
          document.removeEventListener('click', onDocClick, { capture: true });
          scrollEl?.removeEventListener('scroll', onScroll);
        };
      }

      // ─── Wrap column renderer ─────────────────────────────────────
      const columns = store.getState().columns;
      const col = columns.find(c => c.id === options.column);

      if (col) {
        const originalRenderer = col.cellRenderer;

        col.cellRenderer = (container: HTMLElement, context: CellRenderContext) => {
          // Always clear — cells are recycled
          container.textContent = '';
          container.style.display = '';
          container.style.cursor = '';

          const row = context.row;
          const actions = options.getActions(row, context.rowIndex);

          // Run original renderer first (for background etc.)
          if (originalRenderer) {
            originalRenderer(container, context);
          }

          if (!actions || actions.length === 0) return;

          // Clear any content from original renderer, keep styles
          container.textContent = '';
          container.style.display = 'flex';
          container.style.alignItems = 'center';
          container.style.justifyContent = 'center';

          // Create menu trigger button
          const btn = document.createElement('button');
          btn.className = 'bg-row-actions-trigger';
          btn.style.border = 'none';
          btn.style.background = 'none';
          btn.style.cursor = 'pointer';
          btn.style.padding = '4px';
          btn.style.borderRadius = '4px';
          btn.style.display = 'inline-flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          btn.style.color = '#667085';
          btn.style.width = '32px';
          btn.style.height = '32px';
          btn.innerHTML = menuIcon;

          btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = '#F2F4F7';
          });
          btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = '';
          });

          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Toggle: if menu already open for this button, close it
            if (openMenu) {
              closeMenu();
              return;
            }
            showMenu(btn, actions, row, context.rowIndex);
          });

          container.appendChild(btn);
        };

        store.update('columns', () => ({ columns: [...columns] }));
      }

      // Expose API
      ctx.expose({ closeMenu } satisfies RowActionsApi);

      return () => {
        closeMenu();
      };
    },
  };
}

// Re-export built-in icons for convenience
export const RowActionIcons = {
  plus: PLUS_ICON,
  trash: TRASH_ICON,
  dotVertical: DOT_VERTICAL_SVG,
};
