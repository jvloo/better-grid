// ============================================================================
// Cell Renderers Plugin — Reusable cell type renderers
// ============================================================================

import type { GridPlugin, PluginContext, CellTypeRenderer, CellRenderContext } from '@better-grid/core';

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

const checkboxRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void | (() => void) {
    container.textContent = '';
    container.style.textAlign = 'center';
    container.style.cursor = 'pointer';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!context.value;
    input.style.cursor = 'pointer';
    input.style.pointerEvents = 'none'; // let the container handle clicks

    container.appendChild(input);

    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      const newValue = !context.value;
      context.column.meta?.__grid &&
        (context.column.meta.__grid as { updateCell: (r: number, c: string, v: unknown) => void })
          .updateCell(context.rowIndex, context.column.id, newValue);
    };
    container.addEventListener('click', onClick);

    return () => {
      container.removeEventListener('click', onClick);
    };
  },
  getStringValue(context: CellRenderContext): string {
    return context.value ? 'true' : 'false';
  },
};

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

const badgeRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.textContent = '';

    const span = document.createElement('span');
    span.style.display = 'inline-block';
    span.style.padding = '2px 10px';
    span.style.borderRadius = '12px';
    span.style.fontSize = '12px';
    span.style.fontWeight = '500';
    span.style.lineHeight = 'normal';

    const options = context.column.options as
      | Array<{ label: string; value: string | number | boolean; color?: string; bg?: string }>
      | undefined;
    const match = options?.find((opt) => opt.value === context.value);

    if (match) {
      span.textContent = match.label;
      span.style.color = match.color ?? '#fff';
      span.style.backgroundColor = match.bg ?? '#6b7280';
    } else {
      span.textContent = context.value != null ? String(context.value) : '';
      span.style.color = '#374151';
      span.style.backgroundColor = '#e5e7eb';
    }

    container.appendChild(span);
  },
  getStringValue(context: CellRenderContext): string {
    const options = context.column.options as
      | Array<{ label: string; value: string | number | boolean }>
      | undefined;
    const match = options?.find((opt) => opt.value === context.value);
    return match?.label ?? (context.value != null ? String(context.value) : '');
  },
};

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

const progressRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.textContent = '';

    let pct = typeof context.value === 'number' ? context.value : 0;
    // Normalize 0-1 range to 0-100
    if (pct > 0 && pct <= 1) pct = pct * 100;
    pct = Math.max(0, Math.min(100, pct));

    const thresholds = (context.column.meta?.thresholds as { high?: number; low?: number } | undefined);
    const highThreshold = thresholds?.high ?? 66;
    const lowThreshold = thresholds?.low ?? 33;

    let barColor: string;
    if (pct > highThreshold) barColor = '#22c55e';
    else if (pct > lowThreshold) barColor = '#eab308';
    else barColor = '#ef4444';

    const wrapper = document.createElement('div');
    wrapper.style.height = '20px';
    wrapper.style.borderRadius = '4px';
    wrapper.style.background = '#e5e7eb';
    wrapper.style.overflow = 'hidden';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';

    const bar = document.createElement('div');
    bar.style.height = '100%';
    bar.style.width = `${pct}%`;
    bar.style.backgroundColor = barColor;
    bar.style.borderRadius = '4px';
    bar.style.transition = 'width 0.2s ease';

    const text = document.createElement('span');
    text.textContent = `${Math.round(pct)}%`;
    text.style.position = 'absolute';
    text.style.inset = '0';
    text.style.display = 'flex';
    text.style.alignItems = 'center';
    text.style.justifyContent = 'center';
    text.style.fontSize = '11px';
    text.style.fontWeight = '600';
    text.style.color = '#1f2937';
    text.style.lineHeight = 'normal';

    wrapper.appendChild(bar);
    wrapper.appendChild(text);
    container.appendChild(wrapper);
  },
  getStringValue(context: CellRenderContext): string {
    let pct = typeof context.value === 'number' ? context.value : 0;
    if (pct > 0 && pct <= 1) pct = pct * 100;
    return `${Math.round(pct)}%`;
  },
};

// ---------------------------------------------------------------------------
// Boolean
// ---------------------------------------------------------------------------

const booleanRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.style.textAlign = 'center';
    const display = (context.column.meta?.booleanDisplay as string) ?? 'check';
    const truthy = !!context.value;

    if (display === 'yesno') {
      container.textContent = truthy ? 'Yes' : 'No';
      container.style.color = truthy ? '#16a34a' : '#9ca3af';
    } else {
      container.textContent = truthy ? '\u2713' : '\u2717';
      container.style.color = truthy ? '#16a34a' : '#9ca3af';
    }
  },
  getStringValue(context: CellRenderContext): string {
    return context.value ? 'Yes' : 'No';
  },
};

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

const ratingRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    const val = typeof context.value === 'number' ? context.value : 0;
    const max = (context.column.meta?.max as number) ?? 5;
    const filled = Math.min(Math.floor(val), max);
    const empty = max - filled;

    container.style.fontSize = '14px';
    container.style.letterSpacing = '1px';
    container.style.color = '#f59e0b';
    container.textContent = '\u2605'.repeat(filled) + '\u2606'.repeat(empty);
  },
  getStringValue(context: CellRenderContext): string {
    const val = typeof context.value === 'number' ? context.value : 0;
    const max = (context.column.meta?.max as number) ?? 5;
    return `${val}/${max}`;
  },
};

// ---------------------------------------------------------------------------
// Change
// ---------------------------------------------------------------------------

const changeRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    const val = typeof context.value === 'number' ? context.value : 0;

    let formatted: string;
    try {
      const abs = Math.abs(val);
      const str = abs.toLocaleString(undefined, { maximumFractionDigits: 2 });
      if (val > 0) {
        formatted = `\u25B2 +${str}`;
        container.style.color = '#16a34a';
      } else if (val < 0) {
        formatted = `\u25BC -${str}`;
        container.style.color = '#dc2626';
      } else {
        formatted = '0';
        container.style.color = '#9ca3af';
      }
    } catch {
      formatted = String(val);
      container.style.color = '#9ca3af';
    }

    container.textContent = formatted;
  },
  getStringValue(context: CellRenderContext): string {
    const val = typeof context.value === 'number' ? context.value : 0;
    if (val > 0) return `+${val}`;
    return String(val);
  },
  parseStringValue(value: string): unknown {
    const num = parseFloat(value.replace(/[^0-9.\-]/g, ''));
    return isNaN(num) ? undefined : num;
  },
};

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export function cellRenderers(): GridPlugin<'cell-renderers'> {
  return {
    id: 'cell-renderers',
    init(ctx: PluginContext) {
      const unregs: (() => void)[] = [];

      // Inject grid reference into checkbox renderer via a shared approach:
      // We wrap the checkbox renderer to capture the grid instance from ctx.
      const checkboxWithGrid: CellTypeRenderer = {
        ...checkboxRenderer,
        render(container: HTMLElement, context: CellRenderContext): void | (() => void) {
          container.textContent = '';
          container.style.textAlign = 'center';
          container.style.cursor = 'pointer';

          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = !!context.value;
          input.style.cursor = 'pointer';
          input.style.pointerEvents = 'none';

          container.appendChild(input);

          const onClick = (e: MouseEvent) => {
            e.stopPropagation();
            const newValue = !context.value;
            ctx.grid.updateCell(context.rowIndex, context.column.id, newValue);
          };
          container.addEventListener('click', onClick);

          return () => {
            container.removeEventListener('click', onClick);
          };
        },
      };

      unregs.push(ctx.registerCellType('checkbox', checkboxWithGrid));
      unregs.push(ctx.registerCellType('badge', badgeRenderer));
      unregs.push(ctx.registerCellType('progress', progressRenderer));
      unregs.push(ctx.registerCellType('boolean', booleanRenderer));
      unregs.push(ctx.registerCellType('rating', ratingRenderer));
      unregs.push(ctx.registerCellType('change', changeRenderer));

      return () => {
        for (const u of unregs) u();
      };
    },
  };
}
