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
