// ============================================================================
// Context Menu — generic floating menu with keyboard-free click handling
//
// Extracted from grid.ts. This module owns DOM construction, styling, and
// outside-click dismissal. It does NOT know about plugins — callers pass
// pre-built MenuItem[] arrays. The header context menu's plugin-item
// collection logic stays in grid.ts (where plugin access lives).
// ============================================================================

export interface MenuItem {
  /** Label text. Pass '─' to render a separator */
  label: string;
  /** Click handler; dismiss() is called automatically after */
  action: () => void;
  /** Show the item as "active" (highlighted) — use for current sort/filter state */
  active?: boolean;
}

export interface ContextMenu {
  show(event: MouseEvent, items: MenuItem[]): void;
  dismiss(): void;
  isActive(): boolean;
}

export function createContextMenu(): ContextMenu {
  let activeMenu: HTMLElement | null = null;

  function dismiss(): void {
    if (activeMenu) {
      activeMenu.remove();
      activeMenu = null;
    }
  }

  function show(event: MouseEvent, items: MenuItem[]): void {
    dismiss();
    if (items.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'bg-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${event.clientX}px;
      top: ${event.clientY}px;
      z-index: 100;
      background: var(--bg-context-menu-bg, #fff);
      border: 1px solid var(--bg-context-menu-border, #d0d0d0);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 4px 0;
      min-width: 160px;
      font: ${getComputedStyle(event.target as HTMLElement).font};
      font-weight: normal;
    `;

    for (const item of items) {
      if (item.label === '─') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: #e0e0e0; margin: 4px 0;';
        menu.appendChild(sep);
        continue;
      }

      const menuItem = document.createElement('div');
      menuItem.className = 'bg-context-menu__item' + (item.active ? ' bg-context-menu__item--active' : '');
      menuItem.textContent = item.label;
      const activeBg = 'var(--bg-dropdown-selected-bg, #e8f0fe)';
      menuItem.style.cssText = `
        padding: 6px 12px;
        cursor: pointer;
        user-select: none;
        ${item.active ? `background: ${activeBg}; font-weight: 500;` : ''}
      `;
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.background = 'var(--bg-context-menu-hover, #f0f0f0)';
      });
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.background = item.active ? activeBg : '';
      });
      menuItem.addEventListener('click', () => {
        item.action();
        dismiss();
      });
      menu.appendChild(menuItem);
    }

    document.body.appendChild(menu);
    activeMenu = menu;

    // Close on click outside (delayed to avoid the opening click dismissing us)
    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        dismiss();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
  }

  return {
    show,
    dismiss,
    isActive: () => activeMenu !== null,
  };
}
