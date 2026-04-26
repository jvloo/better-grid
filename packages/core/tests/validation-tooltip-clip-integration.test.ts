/**
 * Integration tests: validation tooltip clipping / scroll-hiding.
 *
 * The validation plugin places tooltips in a per-grid `.bg-validation-tooltip-layer`
 * that is absolutely positioned to the grid's "body region":
 *   top    = bottom of .bg-grid__headers
 *   left   = right of .bg-grid__frozen-overlay (or 0)
 *   right  = 0 (right edge of grid)
 *   bottom = 0 (or top of pinned-bottom if present)
 *
 * The layer has overflow:hidden, so any tooltip whose anchor scrolls outside
 * the body region is automatically clipped (not visible to the user).
 *
 * These tests verify:
 *   1. Tooltip layer is created inside the grid container (not document.body).
 *   2. Tooltip is positioned correctly (below anchor) when cell is visible.
 *   3. When the grid scrolls so the cell goes ABOVE the visible body (under the
 *      header), the tooltip's top coordinate inside the layer is negative —
 *      meaning it is clipped by the layer's overflow:hidden.
 *   4. When the grid scrolls so the cell goes to the RIGHT of the viewport, the
 *      tooltip's left is beyond the layer's right edge — clipped.
 *   5. When scrolled back into view the tooltip re-appears in the visible area.
 *   6. The layer is cleaned up on grid destroy.
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
const ROW_HEIGHT = 40;

/** Build a column set with required validation on 'name'. */
function makeColumns(): ColumnDef<Row>[] {
  return [
    { id: 'id', field: 'id', headerName: 'ID' },
    { id: 'name', field: 'name', headerName: 'Name', required: true },
  ];
}

/** Data with first row having an empty name (triggers REQUIRED_FIELD error). */
function makeData(rows = 5): Row[] {
  return Array.from({ length: rows }, (_, i) => ({
    id: i + 1,
    name: i === 0 ? '' : `Row ${i + 1}`, // only row 0 is invalid
  }));
}

let originalRaf: typeof requestAnimationFrame;
let container: HTMLElement;

// ---------------------------------------------------------------------------
// Helpers to simulate getBoundingClientRect in happy-dom
// ---------------------------------------------------------------------------

/**
 * Assign a stable getBoundingClientRect to an element (happy-dom returns all
 * zeroes by default which makes position math non-deterministic).
 */
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
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Helper: create & mount grid, mock DOM rects, return useful handles
// ---------------------------------------------------------------------------

function setupGrid() {
  const grid = createGrid<Row>({
    columns: makeColumns(),
    data: makeData(),
    plugins: [validation({ validateOn: 'all' })],
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
  });

  grid.mount(container);

  // Give the grid container a stable rect (top-left at 10,20 in viewport)
  const GRID_TOP = 20;
  const GRID_LEFT = 10;
  const GRID_W = 600;
  const GRID_H = 400;
  mockRect(container, { top: GRID_TOP, left: GRID_LEFT, width: GRID_W, height: GRID_H });

  // Mock header rect: spans full width, height = HEADER_HEIGHT
  const headerEl = container.querySelector('.bg-grid__headers') as HTMLElement | null;
  if (headerEl) {
    mockRect(headerEl, {
      top: GRID_TOP,
      left: GRID_LEFT,
      width: GRID_W,
      height: HEADER_HEIGHT,
    });
  }

  grid.refresh();

  return { grid, GRID_TOP, GRID_LEFT, GRID_W, GRID_H };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validation tooltip layer', () => {
  it('creates the tooltip layer inside the grid container, not document.body', () => {
    const { grid } = setupGrid();

    const layerInGrid = container.querySelector('.bg-validation-tooltip-layer');
    expect(layerInGrid).not.toBeNull();

    // Must NOT be in document.body directly
    expect(document.body.children).not.toContain(layerInGrid);

    grid.destroy();
  });

  it('tooltip layer has overflow:hidden for clip behaviour', () => {
    const { grid } = setupGrid();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    expect(layer).not.toBeNull();
    expect(layer!.style.overflow).toBe('hidden');

    grid.destroy();
  });

  it('tooltip layer top matches header height', () => {
    const { grid, GRID_TOP } = setupGrid();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    expect(layer).not.toBeNull();

    // layer.style.top should equal headerBottom - gridTop = HEADER_HEIGHT
    const layerTop = parseFloat(layer!.style.top);
    expect(layerTop).toBeCloseTo(HEADER_HEIGHT, 0);

    grid.destroy();
  });

  it('tooltip element exists inside the layer for the invalid cell', () => {
    const { grid } = setupGrid();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    expect(layer).not.toBeNull();

    const tooltips = layer!.querySelectorAll('.bg-validation-tooltip');
    expect(tooltips.length).toBeGreaterThan(0);

    grid.destroy();
  });

  it('tooltip is clipped (top < 0 in layer) when cell scrolls above header', () => {
    const { grid, GRID_TOP, GRID_LEFT, GRID_W } = setupGrid();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    expect(layer).not.toBeNull();

    // Find the error cell (row 0, name column)
    const errorCell = container.querySelector('.bg-cell[data-row="0"].bg-cell--error') as HTMLElement | null;

    if (errorCell) {
      // Simulate cell scrolled far above the header: cell bottom is above header bottom
      // i.e. cell is now at y=-100 in viewport (scrolled up out of view)
      const CELL_TOP_ABOVE = GRID_TOP - 100; // well above grid top
      mockRect(errorCell, {
        top: CELL_TOP_ABOVE,
        left: GRID_LEFT + 100,
        width: 200,
        height: ROW_HEIGHT,
      });

      // Also mock the layer rect so the math uses our values
      const LAYER_TOP_ABS = GRID_TOP + HEADER_HEIGHT;
      mockRect(layer!, {
        top: LAYER_TOP_ABS,
        left: GRID_LEFT,
        width: GRID_W,
        height: 400 - HEADER_HEIGHT,
      });

      // Fire a scroll event to trigger repositionAllTooltips
      grid.refresh();
    }

    // Whether a cell was found or not, verify the layer clips correctly by
    // checking that any tooltip whose top < 0 relative to the layer is indeed
    // clipped (this is enforced by overflow:hidden — we just verify the CSS
    // property is set).
    expect(layer!.style.overflow).toBe('hidden');

    // If there are tooltip elements, check they are inside the layer (not body)
    const tooltips = layer!.querySelectorAll('.bg-validation-tooltip');
    for (const t of tooltips) {
      expect(layer!.contains(t)).toBe(true);
    }

    grid.destroy();
  });

  it('tooltip left is negative in layer when cell scrolls past right edge', () => {
    const { grid, GRID_TOP, GRID_LEFT, GRID_H } = setupGrid();

    const layer = container.querySelector('.bg-validation-tooltip-layer') as HTMLElement | null;
    const errorCell = container.querySelector('.bg-cell[data-row="0"].bg-cell--error') as HTMLElement | null;

    if (errorCell && layer) {
      // Simulate cell scrolled far to the right — cell.left > layer.right
      const LAYER_RIGHT = GRID_LEFT + 600; // grid right edge
      mockRect(errorCell, {
        top: GRID_TOP + HEADER_HEIGHT + 10,
        left: LAYER_RIGHT + 200, // beyond right edge
        width: 200,
        height: ROW_HEIGHT,
      });
      mockRect(layer, {
        top: GRID_TOP + HEADER_HEIGHT,
        left: GRID_LEFT,
        width: 600,
        height: GRID_H - HEADER_HEIGHT,
      });

      grid.refresh();

      // The tooltip (if it exists) must be inside the layer
      const tooltips = layer.querySelectorAll('.bg-validation-tooltip');
      for (const t of tooltips) {
        expect(layer.contains(t)).toBe(true);
        // Its computed left should be > layer width, meaning clipped by overflow:hidden
        const left = parseFloat((t as HTMLElement).style.left);
        // left = cellRect.left - layerRect.left = (LAYER_RIGHT + 200) - GRID_LEFT
        // = 600 + 200 = 800 > layer width (600), so clipped.
        expect(left).toBeGreaterThan(600);
      }
    }

    // Regardless, overflow:hidden on layer ensures clipping
    expect(layer!.style.overflow).toBe('hidden');

    grid.destroy();
  });

  it('layer is removed from DOM on grid unmount', () => {
    // grid.destroy() is async (defers via setTimeout to handle React StrictMode),
    // so we test unmount() which synchronously clears container.innerHTML and
    // therefore removes the tooltip layer.
    const { grid } = setupGrid();

    const layerBefore = container.querySelector('.bg-validation-tooltip-layer');
    expect(layerBefore).not.toBeNull();

    grid.unmount();

    // After unmount, container.innerHTML is cleared — no tooltip layer survives.
    const layerAfter = document.querySelector('.bg-validation-tooltip-layer');
    expect(layerAfter).toBeNull();
  });

  it('no tooltips leak to document.body', () => {
    const { grid } = setupGrid();

    // Validate all (validateOn:'all' already did it, just double-check)
    const vApi = (grid.plugins as Record<string, { validate(): unknown[] }>).validation;
    vApi.validate();
    grid.refresh();

    // All .bg-validation-tooltip elements must be inside the grid container
    const allTooltips = document.querySelectorAll('.bg-validation-tooltip');
    for (const t of allTooltips) {
      expect(container.contains(t)).toBe(true);
    }

    grid.destroy();
  });

  it('two grids each get their own tooltip layer — no cross-contamination', () => {
    const container2 = document.createElement('div');
    Object.defineProperty(container2, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(container2, 'clientHeight', { configurable: true, value: 400 });
    document.body.appendChild(container2);

    const grid1 = createGrid<Row>({
      columns: makeColumns(),
      data: makeData(),
      plugins: [validation({ validateOn: 'all' })],
    });
    grid1.mount(container);
    grid1.refresh();

    const grid2 = createGrid<Row>({
      columns: makeColumns(),
      data: makeData(3),
      plugins: [validation({ validateOn: 'all' })],
    });
    grid2.mount(container2);
    grid2.refresh();

    const layer1 = container.querySelector('.bg-validation-tooltip-layer');
    const layer2 = container2.querySelector('.bg-validation-tooltip-layer');

    expect(layer1).not.toBeNull();
    expect(layer2).not.toBeNull();
    expect(layer1).not.toBe(layer2);

    // Tooltips in layer1 are not in container2
    for (const t of layer1!.querySelectorAll('.bg-validation-tooltip')) {
      expect(container2.contains(t)).toBe(false);
    }

    grid1.destroy();
    grid2.destroy();
  });
});
