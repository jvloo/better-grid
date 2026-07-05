// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * Snap a CSS pixel value to the nearest device pixel boundary.
 *
 * Browsers render borders at device pixel boundaries (border snapping),
 * but translate3d positions are NOT snapped. This causes gaps when a cell's
 * edge lands between physical pixels at non-100% zoom levels.
 *
 * At 150% zoom (dpr=1.5): snapToDevicePixel(91) → 91*1.5=136.5 → 137/1.5=91.333
 * The cell edge now aligns with a physical pixel boundary.
 */
export function snapToDevicePixel(value: number): number {
  const dpr = window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

/**
 * Read a cell's value from a row using a column's `valueGetter` or `field`.
 *
 * Returns `undefined` if neither accessor is defined. Mirrors the inline
 * pattern used across the rendering pipeline, plugins, and exporters.
 */
export function getCellValue(
  row: unknown,
  column: { field?: string; valueGetter?: (row: any, index: number) => unknown },
  index = 0,
): unknown {
  if (column.valueGetter) return column.valueGetter(row, index);
  if (column.field && row && typeof row === 'object') {
    return (row as Record<string, unknown>)[column.field];
  }
  return undefined;
}

/**
 * Clamp a number to the inclusive `[lo, hi]` range.
 *
 * Equivalent to `Math.max(lo, Math.min(v, hi))` — accepts `lo > hi` only at
 * the caller's risk (result is `lo`).
 */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(v, hi));
}

/**
 * Convert browser client-space X deltas into the element's layout pixel space.
 *
 * This matters when the grid is inside a transformed parent, for example
 * `transform: scale(0.8)`: pointer events report scaled client pixels, while
 * column widths and frozen-column offsets remain unscaled layout pixels.
 */
export function getClientToLayoutScaleX(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 1;
  const layoutWidth = el.clientWidth || el.offsetWidth || rect.width;
  const scale = layoutWidth / rect.width;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * Parse a numeric string by stripping non-numeric characters (keeping digits,
 * `.` and `-`). Returns `undefined` for non-finite results (`NaN`, `±Infinity`).
 *
 * Used by `parseStringValue` hooks on cell-type renderers and clipboard paste.
 */
export function parseNumericString(s: string): number | undefined {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Escape a string for safe inclusion in XML/HTML markup.
 *
 * Escapes the four characters needed for XML attribute values
 * (`& < > "`). Safe to use for HTML body text as well — escaping `"` is a
 * harmless superset.
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
