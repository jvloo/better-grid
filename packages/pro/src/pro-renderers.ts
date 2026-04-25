// ============================================================================
// Pro Cell Renderers Plugin — Advanced cell type renderers (Pro tier)
// ============================================================================

import type { GridPlugin, PluginContext, CellTypeRenderer, CellRenderContext } from '@better-grid/core';
import { clamp, parseNumericString } from '@better-grid/core';

// ---------------------------------------------------------------------------
// Sparkline — Mini line/bar/area chart in cell
// ---------------------------------------------------------------------------

const sparklineRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.textContent = '';

    const data = Array.isArray(context.value)
      ? (context.value as number[])
      : [];

    if (data.length === 0) return;

    const meta = context.column.meta as Record<string, unknown> | undefined;
    const sparklineType = (meta?.sparklineType as 'line' | 'bar' | 'area') ?? 'line';
    const color = (meta?.sparklineColor as string) ?? '#3b82f6';

    const width = context.style.width - 12;
    const height = context.style.height - 8;
    const svgNs = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.display = 'block';
    svg.style.margin = '4px 6px';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const chartH = height - padding * 2;
    const chartW = width - padding * 2;

    if (sparklineType === 'bar') {
      const barWidth = chartW / data.length;
      const gap = Math.max(1, barWidth * 0.15);
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i]! - min) / range;
        const barH = Math.max(1, normalized * chartH);
        const rect = document.createElementNS(svgNs, 'rect');
        rect.setAttribute('x', String(padding + i * barWidth + gap / 2));
        rect.setAttribute('y', String(padding + chartH - barH));
        rect.setAttribute('width', String(Math.max(1, barWidth - gap)));
        rect.setAttribute('height', String(barH));
        rect.setAttribute('fill', color);
        rect.setAttribute('rx', '1');
        svg.appendChild(rect);
      }
    } else {
      // line or area
      const points: string[] = [];
      const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
      for (let i = 0; i < data.length; i++) {
        const x = padding + i * stepX;
        const y = padding + chartH - ((data[i]! - min) / range) * chartH;
        points.push(`${x},${y}`);
      }

      if (sparklineType === 'area') {
        const areaPath = document.createElementNS(svgNs, 'polygon');
        const firstX = padding;
        const lastX = padding + (data.length - 1) * stepX;
        const bottomY = padding + chartH;
        areaPath.setAttribute(
          'points',
          `${firstX},${bottomY} ${points.join(' ')} ${lastX},${bottomY}`,
        );
        areaPath.setAttribute('fill', color);
        areaPath.setAttribute('opacity', '0.2');
        svg.appendChild(areaPath);
      }

      const polyline = document.createElementNS(svgNs, 'polyline');
      polyline.setAttribute('points', points.join(' '));
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('stroke', color);
      polyline.setAttribute('stroke-width', '1.5');
      polyline.setAttribute('stroke-linejoin', 'round');
      polyline.setAttribute('stroke-linecap', 'round');
      svg.appendChild(polyline);
    }

    container.appendChild(svg);
  },
  getStringValue(context: CellRenderContext): string {
    const data = Array.isArray(context.value) ? (context.value as number[]) : [];
    if (data.length === 0) return '';
    return data.join(', ');
  },
  parseStringValue(value: string): unknown {
    return value
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
  },
};

// ---------------------------------------------------------------------------
// Heatmap — Background color intensity based on value
// ---------------------------------------------------------------------------

const heatmapRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    const val = typeof context.value === 'number' ? context.value : 0;
    const meta = context.column.meta as Record<string, unknown> | undefined;
    const min = (meta?.min as number) ?? 0;
    const max = (meta?.max as number) ?? 100;
    const colorScale = (meta?.colorScale as string[]) ?? ['#dbeafe', '#3b82f6', '#1e3a8a'];

    const range = max - min || 1;
    const t = clamp((val - min) / range, 0, 1);

    // Interpolate through color scale
    const segmentCount = colorScale.length - 1;
    const segIdx = Math.min(Math.floor(t * segmentCount), segmentCount - 1);
    const segT = t * segmentCount - segIdx;

    const c1 = parseHexColor(colorScale[segIdx]!);
    const c2 = parseHexColor(colorScale[segIdx + 1]!);

    const r = Math.round(c1.r + (c2.r - c1.r) * segT);
    const g = Math.round(c1.g + (c2.g - c1.g) * segT);
    const b = Math.round(c1.b + (c2.b - c1.b) * segT);

    container.style.backgroundColor = `rgb(${r},${g},${b})`;

    // Auto contrast text
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    container.style.color = luminance > 0.5 ? '#111827' : '#f9fafb';
    container.style.fontWeight = '500';

    const formatted = typeof context.value === 'number'
      ? context.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : String(context.value ?? '');
    container.textContent = formatted;
  },
  getStringValue(context: CellRenderContext): string {
    return context.value != null ? String(context.value) : '';
  },
  parseStringValue(value: string): unknown {
    return parseNumericString(value);
  },
};

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
    : h;
  return {
    r: parseInt(full.substring(0, 2), 16),
    g: parseInt(full.substring(2, 4), 16),
    b: parseInt(full.substring(4, 6), 16),
  };
}

// ---------------------------------------------------------------------------
// Circular Progress — Donut/ring SVG indicator
// ---------------------------------------------------------------------------

const circularProgressRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.textContent = '';

    const val = typeof context.value === 'number' ? context.value : 0;
    const meta = context.column.meta as Record<string, unknown> | undefined;
    const max = (meta?.max as number) ?? 100;
    const size = (meta?.size as number) ?? Math.min(context.style.height - 6, 32);
    const strokeWidth = (meta?.strokeWidth as number) ?? 3;
    const color = (meta?.color as string) ?? '#3b82f6';

    const pct = clamp(val / (max || 1), 0, 1);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - pct);

    const svgNs = 'http://www.w3.org/2000/svg';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '6px';
    wrapper.style.height = '100%';
    wrapper.style.pointerEvents = 'none';

    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.style.flexShrink = '0';

    const center = size / 2;

    // Background track
    const bgCircle = document.createElementNS(svgNs, 'circle');
    bgCircle.setAttribute('cx', String(center));
    bgCircle.setAttribute('cy', String(center));
    bgCircle.setAttribute('r', String(radius));
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', '#e5e7eb');
    bgCircle.setAttribute('stroke-width', String(strokeWidth));
    svg.appendChild(bgCircle);

    // Progress arc
    const arc = document.createElementNS(svgNs, 'circle');
    arc.setAttribute('cx', String(center));
    arc.setAttribute('cy', String(center));
    arc.setAttribute('r', String(radius));
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', color);
    arc.setAttribute('stroke-width', String(strokeWidth));
    arc.setAttribute('stroke-dasharray', String(circumference));
    arc.setAttribute('stroke-dashoffset', String(offset));
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('transform', `rotate(-90 ${center} ${center})`);
    svg.appendChild(arc);

    wrapper.appendChild(svg);

    const label = document.createElement('span');
    label.style.fontSize = '11px';
    label.style.fontWeight = '600';
    label.style.color = '#374151';
    label.style.lineHeight = 'normal';
    label.textContent = `${Math.round(pct * 100)}%`;
    wrapper.appendChild(label);

    container.appendChild(wrapper);
  },
  getStringValue(context: CellRenderContext): string {
    const val = typeof context.value === 'number' ? context.value : 0;
    const meta = context.column.meta as Record<string, unknown> | undefined;
    const max = (meta?.max as number) ?? 100;
    return `${Math.round((val / (max || 1)) * 100)}%`;
  },
  parseStringValue(value: string): unknown {
    return parseNumericString(value);
  },
};

// ---------------------------------------------------------------------------
// Avatar — Circular image with text fallback
// ---------------------------------------------------------------------------

const avatarRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.textContent = '';

    const meta = context.column.meta as Record<string, unknown> | undefined;
    const size = (meta?.avatarSize as number) ?? Math.min(context.style.height - 8, 28);
    const colors = [
      '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#f97316',
    ];

    const val = context.value as
      | { src?: string; name?: string }
      | string
      | null
      | undefined;

    let src: string | undefined;
    let name = '';

    if (typeof val === 'string') {
      name = val;
    } else if (val && typeof val === 'object') {
      src = val.src;
      name = val.name ?? '';
    }

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';
    wrapper.style.height = '100%';
    wrapper.style.pointerEvents = 'none';

    const circle = document.createElement('div');
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    circle.style.borderRadius = '50%';
    circle.style.flexShrink = '0';
    circle.style.overflow = 'hidden';
    circle.style.display = 'flex';
    circle.style.alignItems = 'center';
    circle.style.justifyContent = 'center';

    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = name;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      // Fallback to initials on error
      img.onerror = () => {
        img.remove();
        applyInitials(circle, name, size, colors);
      };
      circle.appendChild(img);
    } else {
      applyInitials(circle, name, size, colors);
    }

    wrapper.appendChild(circle);

    if (name) {
      const label = document.createElement('span');
      label.textContent = name;
      label.style.fontSize = '13px';
      label.style.color = '#374151';
      label.style.lineHeight = 'normal';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';
      wrapper.appendChild(label);
    }

    container.appendChild(wrapper);
  },
  getStringValue(context: CellRenderContext): string {
    const val = context.value as
      | { name?: string }
      | string
      | null
      | undefined;
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.name ?? '';
    return '';
  },
};

function applyInitials(
  el: HTMLElement,
  name: string,
  size: number,
  colors: string[],
): void {
  const initials = getInitials(name);
  // Deterministic color from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIdx = Math.abs(hash) % colors.length;

  el.style.backgroundColor = colors[colorIdx]!;
  el.style.color = '#fff';
  el.style.fontSize = `${Math.round(size * 0.4)}px`;
  el.style.fontWeight = '600';
  el.style.lineHeight = 'normal';
  el.textContent = initials;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  return (parts[0] ?? '').substring(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Mini Chart — Pie/donut SVG in cell
// ---------------------------------------------------------------------------

const miniChartRenderer: CellTypeRenderer = {
  render(container: HTMLElement, context: CellRenderContext): void {
    container.textContent = '';

    const meta = context.column.meta as Record<string, unknown> | undefined;
    const chartType = (meta?.chartType as 'pie' | 'donut') ?? 'pie';
    const size = Math.min(context.style.height - 6, 32);
    const defaultColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

    const data = Array.isArray(context.value)
      ? (context.value as Array<{ value: number; color?: string; label?: string }>)
      : [];

    if (data.length === 0) return;

    const total = data.reduce((sum, d) => sum + (d.value ?? 0), 0);
    if (total <= 0) return;

    const svgNs = 'http://www.w3.org/2000/svg';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.height = '100%';
    wrapper.style.pointerEvents = 'none';

    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    const center = size / 2;
    const outerRadius = (size - 2) / 2;
    const innerRadius = chartType === 'donut' ? outerRadius * 0.55 : 0;

    let startAngle = -Math.PI / 2;

    for (let i = 0; i < data.length; i++) {
      const sliceAngle = (data[i]!.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      const color = data[i]!.color ?? defaultColors[i % defaultColors.length];

      const path = document.createElementNS(svgNs, 'path');
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const x1 = center + outerRadius * Math.cos(startAngle);
      const y1 = center + outerRadius * Math.sin(startAngle);
      const x2 = center + outerRadius * Math.cos(endAngle);
      const y2 = center + outerRadius * Math.sin(endAngle);

      let d: string;
      if (innerRadius > 0) {
        const ix1 = center + innerRadius * Math.cos(startAngle);
        const iy1 = center + innerRadius * Math.sin(startAngle);
        const ix2 = center + innerRadius * Math.cos(endAngle);
        const iy2 = center + innerRadius * Math.sin(endAngle);

        d = [
          `M ${x1} ${y1}`,
          `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
          `L ${ix2} ${iy2}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
          'Z',
        ].join(' ');
      } else {
        d = [
          `M ${center} ${center}`,
          `L ${x1} ${y1}`,
          `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
          'Z',
        ].join(' ');
      }

      path.setAttribute('d', d);
      path.setAttribute('fill', color!);
      svg.appendChild(path);

      startAngle = endAngle;
    }

    wrapper.appendChild(svg);
    container.appendChild(wrapper);
  },
  getStringValue(context: CellRenderContext): string {
    const data = Array.isArray(context.value)
      ? (context.value as Array<{ value: number; label?: string }>)
      : [];
    return data
      .map((d) => (d.label ? `${d.label}: ${d.value}` : String(d.value)))
      .join(', ');
  },
};

// ---------------------------------------------------------------------------
// Slider — Inline range input
// ---------------------------------------------------------------------------

function createSliderRenderer(ctx: PluginContext): CellTypeRenderer {
  return {
    render(container: HTMLElement, context: CellRenderContext): void | (() => void) {
      container.textContent = '';

      const val = typeof context.value === 'number' ? context.value : 0;
      const meta = context.column.meta as Record<string, unknown> | undefined;
      const min = (meta?.min as number) ?? 0;
      const max = (meta?.max as number) ?? 100;
      const step = (meta?.step as number) ?? 1;
      const color = (meta?.sliderColor as string) ?? '#3b82f6';

      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '6px';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.padding = '0 4px';
      wrapper.style.boxSizing = 'border-box';

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(val);
      input.style.flex = '1';
      input.style.height = '4px';
      input.style.cursor = context.column.editable === false ? 'default' : 'pointer';
      input.style.accentColor = color;
      input.disabled = context.column.editable === false;

      const label = document.createElement('span');
      label.textContent = String(val);
      label.style.fontSize = '11px';
      label.style.fontWeight = '600';
      label.style.color = '#374151';
      label.style.minWidth = '24px';
      label.style.textAlign = 'right';
      label.style.lineHeight = 'normal';

      wrapper.appendChild(input);
      wrapper.appendChild(label);
      container.appendChild(wrapper);

      if (context.column.editable === false) return;

      const onInput = (e: Event) => {
        const newVal = parseFloat((e.target as HTMLInputElement).value);
        label.textContent = String(newVal);
      };

      const onChange = (e: Event) => {
        const newVal = parseFloat((e.target as HTMLInputElement).value);
        ctx.grid.updateCell(context.rowIndex, context.column.id, newVal);
      };

      // Prevent grid selection/keyboard from interfering
      const onMouseDown = (e: Event) => {
        e.stopPropagation();
      };

      input.addEventListener('input', onInput);
      input.addEventListener('change', onChange);
      input.addEventListener('mousedown', onMouseDown);

      return () => {
        input.removeEventListener('input', onInput);
        input.removeEventListener('change', onChange);
        input.removeEventListener('mousedown', onMouseDown);
      };
    },
    getStringValue(context: CellRenderContext): string {
      return context.value != null ? String(context.value) : '0';
    },
    parseStringValue(value: string): unknown {
      return parseNumericString(value);
    },
  };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export function proRenderers(): GridPlugin<'pro-renderers'> {
  return {
    id: 'pro-renderers',
    init(ctx: PluginContext) {
      const unregs: (() => void)[] = [];

      unregs.push(ctx.registerCellType('sparkline', sparklineRenderer));
      unregs.push(ctx.registerCellType('heatmap', heatmapRenderer));
      unregs.push(ctx.registerCellType('circularProgress', circularProgressRenderer));
      unregs.push(ctx.registerCellType('avatar', avatarRenderer));
      unregs.push(ctx.registerCellType('miniChart', miniChartRenderer));
      unregs.push(ctx.registerCellType('slider', createSliderRenderer(ctx)));

      return () => {
        for (const u of unregs) u();
      };
    },
  };
}
