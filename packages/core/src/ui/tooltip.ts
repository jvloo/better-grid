// ============================================================================
// Tooltip — hover tooltip for clipped text, freeze-clip drag hints, etc.
//
// Extracted from grid.ts. Uses a 500ms delay before showing to avoid flashing
// on quick mouse-overs. Auto-dismisses on next show() call or explicit dismiss().
// ============================================================================

export interface TooltipOptions {
  /** Delay in ms before showing. Default: 500 */
  delay?: number;
}

export interface Tooltip {
  show(target: HTMLElement, text: string, cursorX?: number, cursorY?: number): void;
  dismiss(): void;
}

export function createTooltip(options?: TooltipOptions): Tooltip {
  const delay = options?.delay ?? 500;
  let el: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function dismiss(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (el) {
      el.remove();
      el = null;
    }
  }

  function show(target: HTMLElement, text: string, cursorX?: number, cursorY?: number): void {
    dismiss();
    timer = setTimeout(() => {
      const left = cursorX ?? target.getBoundingClientRect().left;
      const top = cursorY != null ? cursorY + 12 : target.getBoundingClientRect().bottom + 4;
      el = document.createElement('div');
      el.className = 'bg-tooltip';
      el.textContent = text;
      el.style.cssText = `
        position: fixed;
        left: ${left}px;
        top: ${top}px;
        z-index: 100;
        background: var(--bg-context-menu-bg, #fff);
        border: 1px solid var(--bg-context-menu-border, #d0d0d0);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 4px 10px;
        font-size: 13px;
        white-space: nowrap;
        pointer-events: none;
      `;
      document.body.appendChild(el);
    }, delay);
  }

  return { show, dismiss };
}
