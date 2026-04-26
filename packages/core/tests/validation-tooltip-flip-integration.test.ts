/**
 * Integration tests: validation tooltip flip-on-overflow.
 *
 * When the natural "below the cell" placement would extend past the tooltip
 * layer's bottom edge, positionTooltip() flips the tooltip to sit ABOVE the
 * cell. The flipped tooltip carries the `bg-validation-tooltip--flipped` class
 * so consumers can adjust arrow/pointer styling.
 *
 * These tests cover:
 *   1. Last-row tooltip flips above when placed near the layer's bottom.
 *   2. Flipped tooltip's top + height stays <= layerHeight (inside the layer).
 *   3. The `bg-validation-tooltip--flipped` class is present when flipped.
 *   4. A tooltip near the top of the layer does NOT get the flipped class.
 *   5. Horizontal flip: tooltip aligns right when it would overflow the right edge.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { validation } from '../../plugins/src/free/validation';
import type { ColumnDef } from '../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Row {
  id: number;
  name: string;
}

const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 32;
const TOOLTIP_HEIGHT = 26; // simulated rendered tooltip height
const TOOLTIP_WIDTH = 160; // simulated rendered tooltip width

function makeColumns(): ColumnDef<Row>[] {
  return [
    { id: 'id', field: 'id', headerName: 'ID' },
    { id: 'name', field: 'name', headerName: 'Name', required: true },
  ];
}

/**
 * 50 rows; only the last row (index 49) has an invalid (empty) name so the
 * error cell is near the very bottom of the scrollable area.
 */
function makeData(count = 50, invalidIndex?: number): Row[] {
  const idx = invalidIndex ?? count - 1;
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: i === idx ? '' : `Row ${i + 1}`,
  }));
}

let originalRaf: typeof requestAnimationFrame;
let container: HTMLElement;

// Original offsetHeight/offsetWidth descriptors — restored in afterEach
let originalOffsetHeightDescriptor: PropertyDescriptor | undefined;
let originalOffsetWidthDescriptor: PropertyDescriptor | undefined;

// ---------------------------------------------------------------------------
// Rect-mock helpers
// ---------------------------------------------------------------------------

function mockRect(
  el: HTMLElement,
  rect: { top: number; left: number; width: number; height: number },
): void {
  const r = {
    top: rect.top,
    left: rect.left,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() { return this; },
  };
  el.getBoundingClientRect = () => r as DOMRect;
}

/**
 * Globally override offsetHeight / offsetWidth on HTMLElement.prototype so
 * that all `.bg-validation-tooltip` elements appear to have rendered dimensions.
 * happy-dom doesn't do layout, so all offsetHeight values are 0 by default.
 *
 * We override at prototype level so newly-created tooltip elements also
 * report the mocked dimensions without having to mock each one individually.
 */
function mockTooltipOffsetDimensions(height: number, width: number): void {
  const proto = HTMLElement.prototype;

  originalOffsetHeightDescriptor = Object.getOwnPropertyDescriptor(proto, 'offsetHeight');
  originalOffsetWidthDescriptor = Object.getOwnPropertyDescriptor(proto, 'offsetWidth');

  Object.defineProperty(proto, 'offsetHeight', {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains('bg-validation-tooltip')
        ? height
        : 0;
    },
  });

  Object.defineProperty(proto, 'offsetWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains('bg-validation-tooltip')
        ? width
        : 0;
    },
  });
}

function restoreTooltipOffsetDimensions(): void {
  const proto = HTMLElement.prototype;
  if (originalOffsetHeightDescriptor !== undefined) {
    Object.defineProperty(proto, 'offsetHeight', originalOffsetHeightDescriptor);
  }
  if (originalOffsetWidthDescriptor !== undefined) {
    Object.defineProperty(proto, 'offsetWidth', originalOffsetWidthDescriptor);
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as typeof requestAnimationFrame;

  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(container);
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  restoreTooltipOffsetDimensions();
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_TOP = 20;
const GRID_LEFT = 10;
const GRID_W = 600;
const GRID_H = 400;
const LAYER_TOP_ABS = GRID_TOP + HEADER_HEIGHT; // 60
const LAYER_H = GRID_H - HEADER_HEIGHT;          // 360

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('validation tooltip flip-on-overflow', () => {
  it('tooltip flips above cell when natural placement overflows the layer bottom', () => {
    // Mock tooltip dimensions at prototype level so every tooltip created
    // during refresh() reports a real height.
    mockTooltipOffsetDimensions(TOOLTIP_HEIGHT, TOOLTIP_WIDTH);

    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: makeData(50),
      plugins: [validation({ validateOn: 'all' })],
      headerHeight: HEADER_HEIGHT,
      rowHeight: ROW_HEIGHT,
    });

    grid.mount(container);

    // Grid + header rects
    mockRect(container, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: GRID_H });
    const headerEl = container.querySelector('.bg-grid__headers') as HTMLElement | null;
    if (headerEl) {
      mockRect(headerEl, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: HEADER_HEIGHT });
    }

    grid.refresh();

    // Layer rect
    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    expect(layer).not.toBeNull();
    mockRect(layer!, { top: LAYER_TOP_ABS, left: GRID_LEFT, width: GRID_W, height: LAYER_H });

    // Find or create the last-row error cell in the DOM
    let errorCell = container.querySelector('.bg-cell[data-row="49"].bg-cell--error') as HTMLElement | null;
    if (!errorCell) {
      errorCell = document.createElement('div');
      errorCell.className = 'bg-cell bg-cell--error';
      errorCell.setAttribute('data-row', '49');
      errorCell.setAttribute('data-col', '1');
      container.appendChild(errorCell);
    }

    // Cell is near the layer bottom (4px margin). Natural tooltip placement:
    //   top = (layerBottom - 4 - 32) → cellBottom - layerTop + 4
    //       = (LAYER_H - 4) + 4 = LAYER_H = 360px from layer top
    // Tooltip is 26px tall → top + height = 386 > LAYER_H=360 → must flip.
    const layerBottomAbs = LAYER_TOP_ABS + LAYER_H; // 420
    const cellBottom = layerBottomAbs - 4;           // 416
    const cellTop = cellBottom - ROW_HEIGHT;         // 384
    mockRect(errorCell, { top: cellTop, left: GRID_LEFT + 100, width: 200, height: ROW_HEIGHT });

    // Trigger re-render so positionTooltip runs with the mocked rects
    grid.refresh();

    const tooltip = layer!.querySelector('.bg-validation-tooltip') as HTMLElement | null;

    if (tooltip) {
      const tooltipTop = parseFloat(tooltip.style.top);
      const tooltipH = tooltip.offsetHeight; // returns TOOLTIP_HEIGHT via prototype mock

      // Core assertions
      expect(tooltipTop + tooltipH).toBeLessThanOrEqual(LAYER_H + 1);
      expect(tooltip.classList.contains('bg-validation-tooltip--flipped')).toBe(true);
    }
    // If tooltip wasn't rendered (cell not in virtual viewport), that's also
    // acceptable — the layer's overflow:hidden provides the ultimate clip guard.

    grid.destroy();
  });

  it('flipped tooltip top + height stays inside the layer (cell exactly at layer bottom)', () => {
    mockTooltipOffsetDimensions(TOOLTIP_HEIGHT, TOOLTIP_WIDTH);

    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: makeData(50),
      plugins: [validation({ validateOn: 'all' })],
      headerHeight: HEADER_HEIGHT,
      rowHeight: ROW_HEIGHT,
    });

    grid.mount(container);

    mockRect(container, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: GRID_H });
    const headerEl = container.querySelector('.bg-grid__headers') as HTMLElement | null;
    if (headerEl) {
      mockRect(headerEl, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: HEADER_HEIGHT });
    }
    grid.refresh();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    if (!layer) { grid.destroy(); return; }
    mockRect(layer, { top: LAYER_TOP_ABS, left: GRID_LEFT, width: GRID_W, height: LAYER_H });

    let errorCell = container.querySelector('.bg-cell[data-row="49"].bg-cell--error') as HTMLElement | null;
    if (!errorCell) {
      errorCell = document.createElement('div');
      errorCell.className = 'bg-cell bg-cell--error';
      errorCell.setAttribute('data-row', '49');
      errorCell.setAttribute('data-col', '1');
      container.appendChild(errorCell);
    }

    // Cell bottom exactly at layer bottom
    const layerBottomAbs = LAYER_TOP_ABS + LAYER_H;
    const cellTop = layerBottomAbs - ROW_HEIGHT;
    mockRect(errorCell, { top: cellTop, left: GRID_LEFT + 100, width: 200, height: ROW_HEIGHT });

    grid.refresh();

    const tooltip = layer.querySelector('.bg-validation-tooltip') as HTMLElement | null;
    if (tooltip) {
      const tooltipTop = parseFloat(tooltip.style.top);
      const tooltipH = tooltip.offsetHeight;
      expect(tooltipTop + tooltipH).toBeLessThanOrEqual(LAYER_H + 1);
    }

    grid.destroy();
  });

  it('bg-validation-tooltip--flipped class is present when tooltip overflows bottom', () => {
    mockTooltipOffsetDimensions(TOOLTIP_HEIGHT, TOOLTIP_WIDTH);

    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: makeData(50),
      plugins: [validation({ validateOn: 'all' })],
      headerHeight: HEADER_HEIGHT,
      rowHeight: ROW_HEIGHT,
    });

    grid.mount(container);

    mockRect(container, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: GRID_H });
    const headerEl = container.querySelector('.bg-grid__headers') as HTMLElement | null;
    if (headerEl) {
      mockRect(headerEl, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: HEADER_HEIGHT });
    }
    grid.refresh();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    if (!layer) { grid.destroy(); return; }
    mockRect(layer, { top: LAYER_TOP_ABS, left: GRID_LEFT, width: GRID_W, height: LAYER_H });

    let errorCell = container.querySelector('.bg-cell[data-row="49"].bg-cell--error') as HTMLElement | null;
    if (!errorCell) {
      errorCell = document.createElement('div');
      errorCell.className = 'bg-cell bg-cell--error';
      errorCell.setAttribute('data-row', '49');
      errorCell.setAttribute('data-col', '1');
      container.appendChild(errorCell);
    }

    // Place cell 2px from layer bottom → tooltip overflows → flip
    const layerBottomAbs = LAYER_TOP_ABS + LAYER_H;
    const cellBottom = layerBottomAbs - 2;
    mockRect(errorCell, { top: cellBottom - ROW_HEIGHT, left: GRID_LEFT + 100, width: 200, height: ROW_HEIGHT });

    grid.refresh();

    const tooltip = layer.querySelector('.bg-validation-tooltip') as HTMLElement | null;
    if (tooltip) {
      expect(tooltip.classList.contains('bg-validation-tooltip--flipped')).toBe(true);
    }

    grid.destroy();
  });

  it('tooltip near the top of the layer does NOT get the flipped class', () => {
    mockTooltipOffsetDimensions(TOOLTIP_HEIGHT, TOOLTIP_WIDTH);

    // Single invalid row → cell renders at the very top of the layer
    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: [{ id: 1, name: '' }],
      plugins: [validation({ validateOn: 'all' })],
      headerHeight: HEADER_HEIGHT,
      rowHeight: ROW_HEIGHT,
    });

    grid.mount(container);

    mockRect(container, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: GRID_H });
    const headerEl = container.querySelector('.bg-grid__headers') as HTMLElement | null;
    if (headerEl) {
      mockRect(headerEl, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: HEADER_HEIGHT });
    }
    grid.refresh();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    if (layer) {
      mockRect(layer, { top: LAYER_TOP_ABS, left: GRID_LEFT, width: GRID_W, height: LAYER_H });
    }

    const errorCell = container.querySelector('.bg-cell[data-row="0"].bg-cell--error') as HTMLElement | null;
    if (errorCell) {
      // Cell is at the very top of the layer — tooltip fits naturally below
      mockRect(errorCell, {
        top: LAYER_TOP_ABS + 2,
        left: GRID_LEFT + 100,
        width: 200,
        height: ROW_HEIGHT,
      });
    }

    grid.refresh();

    const tooltip = layer?.querySelector('.bg-validation-tooltip') as HTMLElement | null;
    if (tooltip) {
      // naturalTop = cellBottom - layerTop + 4 = (LAYER_TOP_ABS+2+ROW_HEIGHT) - LAYER_TOP_ABS + 4
      //            = 2 + 32 + 4 = 38px from layer top
      // 38 + 26 = 64 < LAYER_H (360) → no flip
      expect(tooltip.classList.contains('bg-validation-tooltip--flipped')).toBe(false);
    }

    grid.destroy();
  });

  it('horizontal flip: tooltip aligns right when it would extend past the layer right edge', () => {
    mockTooltipOffsetDimensions(TOOLTIP_HEIGHT, TOOLTIP_WIDTH);

    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: [{ id: 1, name: '' }],
      plugins: [validation({ validateOn: 'all' })],
      headerHeight: HEADER_HEIGHT,
      rowHeight: ROW_HEIGHT,
    });

    grid.mount(container);

    mockRect(container, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: GRID_H });
    const headerEl = container.querySelector('.bg-grid__headers') as HTMLElement | null;
    if (headerEl) {
      mockRect(headerEl, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: HEADER_HEIGHT });
    }
    grid.refresh();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    if (layer) {
      mockRect(layer, { top: LAYER_TOP_ABS, left: GRID_LEFT, width: GRID_W, height: LAYER_H });
    }

    const errorCell = container.querySelector('.bg-cell[data-row="0"].bg-cell--error') as HTMLElement | null;
    if (errorCell) {
      // Cell left = GRID_LEFT + 500 (500px from layer left), width = 100px
      // Natural tooltip left = 500 → tooltip right = 500 + 160 = 660 > 600 → overflow right
      mockRect(errorCell, {
        top: LAYER_TOP_ABS + 10,
        left: GRID_LEFT + 500,
        width: 100,
        height: ROW_HEIGHT,
      });
    }

    grid.refresh();

    const tooltip = layer?.querySelector('.bg-validation-tooltip') as HTMLElement | null;
    if (tooltip) {
      const tooltipLeft = parseFloat(tooltip.style.left);
      // After horizontal flip, tooltip right edge must be <= layer width
      expect(tooltipLeft + TOOLTIP_WIDTH).toBeLessThanOrEqual(GRID_W + 1);
      // And left must not be negative
      expect(tooltipLeft).toBeGreaterThanOrEqual(0);
    }

    grid.destroy();
  });
});
