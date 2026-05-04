// ============================================================================
// Tooltip — hover tooltip for clipped text, freeze-clip drag hints, etc.
//
// Extracted from grid.ts. Uses a 500ms delay before showing to avoid flashing
// on quick mouse-overs. Auto-dismisses on next show() call or explicit dismiss().
// ============================================================================

export interface CreateTooltipOptions {
  /** Delay in ms before showing. Default: 500 */
  delay?: number;
  /** Master switch — when false, show() becomes a no-op. Default: true. */
  enabled?: boolean;
}

export interface ShowTooltipOptions {
  /**
   * Skip the delay and show synchronously. Use for "live" tooltips (column
   * resize px readout, gantt drag captions) where the user has already
   * committed to an interaction and a delayed appearance feels laggy.
   */
  immediate?: boolean;
}

export interface Tooltip {
  show(target: HTMLElement, text: string, cursorX?: number, cursorY?: number, opts?: ShowTooltipOptions): void;
  /**
   * Update the position/text of an already-visible tooltip without going
   * back through the show-delay. No-op when no tooltip is on screen — use
   * for cursor-following live tooltips during drag.
   */
  update(text: string, cursorX: number, cursorY: number): void;
  dismiss(): void;
  setEnabled(enabled: boolean): void;
}

export function createTooltip(options?: CreateTooltipOptions): Tooltip {
  const delay = options?.delay ?? 500;
  let enabled = options?.enabled ?? true;
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

  function paint(text: string, anchorLeft: number, anchorTop: number): void {
    if (!el) {
      el = document.createElement('div');
      el.className = 'bg-tooltip';
      el.style.cssText = `
        position: fixed;
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
    }
    el.textContent = text;
    el.style.left = `${anchorLeft}px`;
    el.style.top = `${anchorTop}px`;
  }

  function show(
    target: HTMLElement,
    text: string,
    cursorX?: number,
    cursorY?: number,
    opts?: ShowTooltipOptions,
  ): void {
    if (!enabled) return;
    // Treat empty / whitespace-only text as "no tooltip" so that callers can
    // delegate the empty-content check upward without writing it themselves.
    if (!text || !text.trim()) {
      dismiss();
      return;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const left = cursorX ?? target.getBoundingClientRect().left;
    const top = cursorY != null ? cursorY + 12 : target.getBoundingClientRect().bottom + 4;
    if (opts?.immediate) {
      // Reuse the existing element if one is on screen so a stream of
      // immediate show() calls (e.g. column resize, gantt drag) updates the
      // current tooltip in place instead of churning the DOM.
      paint(text, left, top);
    } else {
      // Delayed path — make sure no stale tooltip is showing while we wait.
      if (el) {
        el.remove();
        el = null;
      }
      timer = setTimeout(() => paint(text, left, top), delay);
    }
  }

  function update(text: string, cursorX: number, cursorY: number): void {
    if (!enabled || !el) return;
    if (!text || !text.trim()) {
      dismiss();
      return;
    }
    paint(text, cursorX, cursorY + 12);
  }

  function setEnabled(next: boolean): void {
    enabled = next;
    if (!enabled) dismiss();
  }

  return { show, update, dismiss, setEnabled };
}
