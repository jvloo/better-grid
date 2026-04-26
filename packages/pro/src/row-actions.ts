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
  /**
   * Returns the accessible label for the trigger button.
   * Default: `'Row actions'`.
   * Example: `(row) => \`Actions for ${row.name}\``
   */
  getTriggerLabel?: (row: unknown, rowIndex: number) => string;
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

export function rowActions(options: RowActionsOptions): GridPlugin<'rowActions', RowActionsApi> {
  return {
    id: 'rowActions',

    init(ctx: PluginContext) {
      const store = ctx.store;
      let openMenu: HTMLElement | null = null;
      let openMenuCleanup: (() => void) | null = null;
      let openTrigger: HTMLButtonElement | null = null;
      let menuIdCounter = 0;

      const menuIcon = options.menuIcon ?? DOT_VERTICAL_SVG;

      // Inject CSS to reset button defaults and suppress browser interaction states
      if (!document.getElementById('bg-row-actions-style')) {
        const style = document.createElement('style');
        style.id = 'bg-row-actions-style';
        style.textContent = `
          .bg-row-actions-trigger {
            appearance: none;
            -webkit-appearance: none;
            border: none;
            background: transparent;
            padding: 0;
            margin: 0;
            font: inherit;
          }
          .bg-row-actions-trigger:focus,
          .bg-row-actions-trigger:focus-visible,
          .bg-row-actions-trigger:active {
            outline: none !important;
            box-shadow: none !important;
            background-color: transparent !important;
            -webkit-tap-highlight-color: transparent;
          }
          .bg-row-actions-menu-item {
            appearance: none;
            -webkit-appearance: none;
            border: none;
            background: transparent;
            padding: 0;
            margin: 0;
            font: inherit;
            text-align: left;
            width: 100%;
          }
        `;
        document.head.appendChild(style);
      }

      function closeMenu(): void {
        if (openMenu) {
          openMenu.remove();
          openMenu = null;
        }
        if (openTrigger) {
          openTrigger.setAttribute('aria-expanded', 'false');
          openTrigger = null;
        }
        if (openMenuCleanup) {
          openMenuCleanup();
          openMenuCleanup = null;
        }
      }

      function showMenu(
        anchorEl: HTMLButtonElement,
        actions: RowAction[],
        row: unknown,
        rowIndex: number,
      ): void {
        closeMenu();

        const menuId = `bg-row-actions-menu-${++menuIdCounter}`;

        const menu = document.createElement('div');
        menu.className = 'bg-row-actions-menu';
        menu.setAttribute('role', 'menu');
        menu.id = menuId;
        menu.style.position = 'fixed';
        menu.style.zIndex = '10000';
        menu.style.background = '#fff';
        menu.style.border = '1px solid #EAECF0';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = '0 4px 12px rgba(16, 24, 40, 0.12)';
        menu.style.padding = '4px 0';
        menu.style.minWidth = '140px';
        menu.style.fontFamily = 'inherit';

        // Track the currently highlighted item index for keyboard navigation
        let focusedIndex = -1;

        const itemEls: HTMLButtonElement[] = [];

        function highlightItem(index: number): void {
          itemEls.forEach((el, i) => {
            el.style.backgroundColor = i === index ? '#F9FAFB' : '';
          });
          focusedIndex = index;
          const targetEl = itemEls[index];
          if (index >= 0 && index < itemEls.length && targetEl) {
            targetEl.focus();
          }
        }

        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];
          if (!action) continue;

          const item = document.createElement('button');
          item.className = 'bg-row-actions-menu-item';
          item.setAttribute('role', 'menuitem');
          item.disabled = !!action.disabled;
          item.style.padding = '8px 12px';
          item.style.cursor = action.disabled ? 'default' : 'pointer';
          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.gap = '8px';
          item.style.fontSize = '14px';
          item.style.color = action.disabled ? '#98A2B3' : '#344054';
          item.style.opacity = action.disabled ? '0.6' : '1';
          item.style.userSelect = 'none';
          item.style.outline = 'none';

          if (action.icon) {
            const iconEl = document.createElement('span');
            iconEl.setAttribute('aria-hidden', 'true');
            iconEl.style.display = 'inline-flex';
            iconEl.style.width = '16px';
            iconEl.style.height = '16px';
            iconEl.style.flexShrink = '0';
            iconEl.innerHTML = action.icon;
            item.appendChild(iconEl);
          }

          const labelEl = document.createElement('span');
          labelEl.textContent = action.label;
          item.appendChild(labelEl);

          if (action.disabled && action.disabledTooltip) {
            item.title = action.disabledTooltip;
          }

          if (!action.disabled) {
            item.addEventListener('mouseenter', () => {
              highlightItem(i);
            });
            item.addEventListener('mouseleave', () => {
              item.style.backgroundColor = '';
              focusedIndex = -1;
            });
            item.addEventListener('click', (e) => {
              e.stopPropagation();
              closeMenu();
              options.onAction(action.id, row, rowIndex);
            });
          }

          itemEls.push(item);
          menu.appendChild(item);
        }

        // Keyboard navigation within the menu
        const onMenuKeydown = (e: KeyboardEvent) => {
          const enabledIndices = itemEls
            .map((el, i) => ({ el, i }))
            .filter(({ el }) => !el.disabled)
            .map(({ i }) => i);

          if (enabledIndices.length === 0) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const currentPos = enabledIndices.indexOf(focusedIndex);
            const nextPos = currentPos < enabledIndices.length - 1 ? currentPos + 1 : 0;
            const nextIdx = enabledIndices[nextPos];
            if (nextIdx !== undefined) highlightItem(nextIdx);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentPos = enabledIndices.indexOf(focusedIndex);
            const prevPos = currentPos > 0 ? currentPos - 1 : enabledIndices.length - 1;
            const prevIdx = enabledIndices[prevPos];
            if (prevIdx !== undefined) highlightItem(prevIdx);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < itemEls.length) {
              const activeItem = itemEls[focusedIndex];
              const activeAction = actions[focusedIndex];
              if (activeItem && !activeItem.disabled && activeAction) {
                closeMenu();
                options.onAction(activeAction.id, row, rowIndex);
              }
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeMenu();
            anchorEl.focus();
          } else if (e.key === 'Tab') {
            closeMenu();
            // Allow Tab to advance focus naturally — do not prevent default
          }
        };

        menu.addEventListener('keydown', onMenuKeydown);

        // Position below anchor
        const rect = anchorEl.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 2}px`;

        document.body.appendChild(menu);
        openMenu = menu;
        openTrigger = anchorEl;
        anchorEl.setAttribute('aria-expanded', 'true');
        anchorEl.setAttribute('aria-controls', menuId);

        // Focus the first enabled item
        const firstEnabled = itemEls.findIndex(el => !el.disabled);
        if (firstEnabled >= 0) {
          highlightItem(firstEnabled);
        }

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
      // applyColumnWrap is extracted so it can be re-applied on every
      // setColumns() call (e.g. React's useEffect on first render).
      // normalizeColumn() inside setColumns() creates fresh ColumnDef
      // spread-copies, discarding any mutations applied during init.
      // A sentinel flag (__rowActionsWrapped) prevents double-wrap.
      const applyColumnWrap = (cols: (import('@better-grid/core').ColumnDef & { id: string })[]): void => {
        const col = cols.find(c => c.id === options.column);
        if (!col) return;
        if ((col as { __rowActionsWrapped?: boolean }).__rowActionsWrapped) return;
        (col as { __rowActionsWrapped?: boolean }).__rowActionsWrapped = true;

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

          // Create menu trigger as a real <button> for accessibility
          const btn = document.createElement('button');
          btn.className = 'bg-row-actions-trigger';
          btn.setAttribute('type', 'button');
          btn.setAttribute('aria-haspopup', 'menu');
          btn.setAttribute('aria-expanded', 'false');
          const triggerLabel = options.getTriggerLabel
            ? options.getTriggerLabel(row, context.rowIndex)
            : 'Row actions';
          btn.setAttribute('aria-label', triggerLabel);
          btn.style.cursor = 'pointer';
          btn.style.display = 'inline-flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          btn.style.color = '#667085';
          btn.style.width = '32px';
          btn.style.height = '32px';
          btn.style.borderRadius = '4px';
          btn.innerHTML = menuIcon;

          // Mark the SVG icon as decorative so screen readers skip it
          const svgEl = btn.querySelector('svg');
          if (svgEl) {
            svgEl.setAttribute('aria-hidden', 'true');
            svgEl.setAttribute('focusable', 'false');
          }

          btn.addEventListener('pointerdown', (e) => {
            e.stopPropagation(); // Prevent cell:click from firing
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

        store.update('columns', () => ({ columns: [...cols] }));
      };

      applyColumnWrap(store.getState().columns);

      // Re-apply wrapping whenever setColumns() is called so the action
      // trigger survives the fresh column copies React's useEffect emits.
      ctx.on('columns:set', applyColumnWrap);

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
