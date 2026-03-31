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
    span.style.padding = '2px 8px';
    span.style.borderRadius = '12px';
    span.style.fontSize = '12px';
    span.style.lineHeight = 'normal';
    span.style.pointerEvents = 'none';

    const options = context.column.options as
      | Array<{ label: string; value: string | number | boolean; color?: string; bg?: string }>
      | undefined;
    const match = options?.find((opt) => opt.value === context.value);

    if (match) {
      span.textContent = match.label;
      span.style.color = match.color ?? '#666';
      span.style.backgroundColor = match.bg ?? '#f5f5f5';
    } else {
      span.textContent = context.value != null ? String(context.value) : '';
      span.style.color = '#666';
      span.style.backgroundColor = '#f5f5f5';
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

    // Thin bar + side text (matching TaskTracker pattern)
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '6px';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.pointerEvents = 'none';

    const track = document.createElement('div');
    track.style.flex = '1';
    track.style.height = '6px';
    track.style.background = '#eee';
    track.style.borderRadius = '3px';
    track.style.overflow = 'hidden';

    const bar = document.createElement('div');
    bar.style.width = `${pct}%`;
    bar.style.height = '100%';
    bar.style.backgroundColor = barColor;
    bar.style.borderRadius = '3px';

    track.appendChild(bar);

    const text = document.createElement('span');
    text.textContent = `${Math.round(pct)}%`;
    text.style.fontSize = '11px';
    text.style.fontWeight = '600';
    text.style.color = '#1f2937';
    text.style.lineHeight = 'normal';

    text.style.color = '#888';
    text.style.minWidth = '28px';

    wrapper.appendChild(track);
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
    container.textContent = '';
    container.style.textAlign = 'center';
    const display = (context.column.meta?.booleanDisplay as string) ?? 'checkbox';
    const truthy = !!context.value;

    if (display === 'yesno') {
      const wrapper = document.createElement('span');
      wrapper.style.cssText = 'display:inline-flex;align-items:center;gap:5px;height:100%;line-height:normal;';
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${truthy ? '#22c55e' : '#d1d5db'};`;
      const label = document.createElement('span');
      label.textContent = truthy ? 'Yes' : 'No';
      label.style.color = truthy ? '#2e7d32' : '#9e9e9e';
      label.style.fontSize = '12px';
      wrapper.appendChild(dot);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    } else if (display === 'check') {
      container.textContent = truthy ? '\u2713' : '\u2717';
      container.style.color = truthy ? '#2e7d32' : '#c62828';
      container.style.fontWeight = '600';
    } else {
      // 'checkbox' (default) — styled checkbox, industry standard
      const wrapper = document.createElement('span');
      wrapper.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;height:100%;line-height:normal;';
      const box = document.createElement('span');
      if (truthy) {
        box.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:3px;background:#1a73e8;color:#fff;font-size:11px;line-height:1;';
        box.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.5L4 7.5L8 3"/></svg>';
      } else {
        box.style.cssText = 'display:inline-block;width:16px;height:16px;border-radius:3px;border:1.5px solid #d0d0d0;box-sizing:border-box;';
      }
      wrapper.appendChild(box);
      container.appendChild(wrapper);
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
// Timeline — Date range bar
// ---------------------------------------------------------------------------

const timelineRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.textContent = '';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';

    let start: Date | null = null;
    let end: Date | null = null;

    const val = context.value as
      | { start: string | Date; end: string | Date }
      | [string | Date, string | Date]
      | null
      | undefined;

    if (Array.isArray(val) && val.length >= 2) {
      start = new Date(val[0]);
      end = new Date(val[1]);
    } else if (val && typeof val === 'object' && 'start' in val) {
      start = new Date(val.start);
      end = new Date(val.end);
    }

    const bar = document.createElement('div');
    const color = 'var(--bg-timeline-color, #3b82f6)';
    bar.style.height = '8px';
    bar.style.borderRadius = '4px';
    bar.style.background = color;
    bar.style.position = 'absolute';
    bar.style.top = '50%';
    bar.style.transform = 'translateY(-50%)';

    const meta = context.column.meta as Record<string, unknown> | undefined;
    const rangeStart = meta?.timelineStart ? new Date(meta.timelineStart as string | number) : null;
    const rangeEnd = meta?.timelineEnd ? new Date(meta.timelineEnd as string | number) : null;

    if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()) && rangeStart && rangeEnd && !isNaN(rangeStart.getTime()) && !isNaN(rangeEnd.getTime())) {
      const totalRange = rangeEnd.getTime() - rangeStart.getTime();
      if (totalRange > 0) {
        const leftPct = ((start.getTime() - rangeStart.getTime()) / totalRange) * 100;
        const rightPct = ((end.getTime() - rangeStart.getTime()) / totalRange) * 100;
        bar.style.left = `${Math.max(0, leftPct)}%`;
        bar.style.width = `${Math.min(100, rightPct) - Math.max(0, leftPct)}%`;
      } else {
        bar.style.left = '25%';
        bar.style.width = '50%';
      }
    } else {
      bar.style.left = '25%';
      bar.style.width = '50%';
    }

    container.appendChild(bar);
  },
  getStringValue(context: CellRenderContext): string {
    const val = context.value as
      | { start: string | Date; end: string | Date }
      | [string | Date, string | Date]
      | null
      | undefined;

    let start: string | null = null;
    let end: string | null = null;

    if (Array.isArray(val) && val.length >= 2) {
      start = String(val[0]);
      end = String(val[1]);
    } else if (val && typeof val === 'object' && 'start' in val) {
      start = String(val.start);
      end = String(val.end);
    }

    return start && end ? `${start} – ${end}` : '';
  },
};

// ---------------------------------------------------------------------------
// Change Indicator — Arrow icon with +/-
// ---------------------------------------------------------------------------

const changeIndicatorRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.textContent = '';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '4px';

    const val = typeof context.value === 'number' ? context.value : 0;
    const formatter = new Intl.NumberFormat(undefined, { useGrouping: true, maximumFractionDigits: 2 });

    const arrow = document.createElement('span');
    const text = document.createElement('span');

    if (val > 0) {
      arrow.textContent = '\u2191';
      arrow.style.color = '#16a34a';
      text.textContent = `+${formatter.format(val)}`;
      text.style.color = '#16a34a';
    } else if (val < 0) {
      arrow.textContent = '\u2193';
      arrow.style.color = '#dc2626';
      text.textContent = `${formatter.format(val)}`;
      text.style.color = '#dc2626';
    } else {
      arrow.textContent = '\u2014';
      arrow.style.color = '#9ca3af';
      text.textContent = '0';
      text.style.color = '#9ca3af';
    }

    container.appendChild(arrow);
    container.appendChild(text);
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
// Tooltip — Rich hover content
// ---------------------------------------------------------------------------

const tooltipRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void | (() => void) {
    container.textContent = '';

    const val = context.value as
      | { text: string; tooltip: string; type?: 'info' | 'warning' | 'error' }
      | string
      | null
      | undefined;

    let displayText = '';
    let tooltipText = '';
    let tooltipType: 'info' | 'warning' | 'error' = 'info';

    if (typeof val === 'string') {
      displayText = val;
    } else if (val && typeof val === 'object') {
      displayText = val.text ?? '';
      tooltipText = val.tooltip ?? '';
      tooltipType = val.type ?? 'info';
    }

    container.textContent = displayText;

    if (!tooltipText) return;

    let tooltipEl: HTMLDivElement | null = null;

    const typeColors: Record<string, { bg: string; color: string }> = {
      info: { bg: '#dbeafe', color: '#1e40af' },
      warning: { bg: '#fef3c7', color: '#92400e' },
      error: { bg: '#fee2e2', color: '#991b1b' },
    };

    const onMouseEnter = () => {
      tooltipEl = document.createElement('div');
      tooltipEl.textContent = tooltipText;
      tooltipEl.style.position = 'fixed';
      tooltipEl.style.zIndex = '200';
      tooltipEl.style.padding = '6px 10px';
      tooltipEl.style.borderRadius = '6px';
      tooltipEl.style.fontSize = '12px';
      tooltipEl.style.maxWidth = '250px';
      tooltipEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.whiteSpace = 'normal';

      const colors = typeColors[tooltipType] ?? typeColors.info;
      tooltipEl.style.backgroundColor = colors.bg;
      tooltipEl.style.color = colors.color;

      document.body.appendChild(tooltipEl);

      const rect = container.getBoundingClientRect();
      const ttRect = tooltipEl.getBoundingClientRect();
      tooltipEl.style.left = `${rect.left + rect.width / 2 - ttRect.width / 2}px`;
      tooltipEl.style.top = `${rect.top - ttRect.height - 4}px`;
    };

    const onMouseLeave = () => {
      if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
      }
    };

    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);

    return () => {
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
      }
    };
  },
  getStringValue(context: CellRenderContext): string {
    const val = context.value as
      | { text: string; tooltip: string }
      | string
      | null
      | undefined;

    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.text ?? '';
    return '';
  },
};

// ---------------------------------------------------------------------------
// Loading — Shimmer skeleton state
// ---------------------------------------------------------------------------

const loadingRenderer: CellTypeRenderer = {
  render(container: HTMLElement): void {
    container.textContent = '';

    // Inject shimmer keyframes once
    if (!document.getElementById('bg-shimmer-style')) {
      const style = document.createElement('style');
      style.id = 'bg-shimmer-style';
      style.textContent = '@keyframes bg-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }';
      document.head.appendChild(style);
    }

    const shimmer = document.createElement('div');
    shimmer.style.height = '14px';
    shimmer.style.borderRadius = '4px';
    shimmer.style.background = 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)';
    shimmer.style.backgroundSize = '200% 100%';
    shimmer.style.animation = 'bg-shimmer 1.5s infinite';
    shimmer.style.width = '80%';

    container.appendChild(shimmer);
  },
  getStringValue(): string {
    return 'Loading...';
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
      unregs.push(ctx.registerCellType('timeline', timelineRenderer));
      unregs.push(ctx.registerCellType('changeIndicator', changeIndicatorRenderer));
      unregs.push(ctx.registerCellType('tooltip', tooltipRenderer));
      unregs.push(ctx.registerCellType('loading', loadingRenderer));

      return () => {
        for (const u of unregs) u();
      };
    },
  };
}
