/**
 * Integration test: tooltip cellType renderer.
 *
 * Verifies that:
 * - A `{ text, tooltip }` value renders the text inside a `.bg-cell-tooltip-trigger`
 *   span with a dotted underline + help cursor (so users have a discoverable
 *   affordance instead of plain text identical to a normal cell).
 * - mouseenter on the cell creates a fixed-position tooltip element appended to
 *   document.body containing the tooltip text; mouseleave removes it.
 * - A plain string value (no tooltip text) renders just text — no trigger
 *   span, no listeners (tooltip-less values stay visually identical to a
 *   text cell so the affordance is reserved for actually-actionable cells).
 * - Type colour ('warning' / 'error') flows through to tooltip background.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { cellRenderers } from '../../plugins/src/free/cell-renderers';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  info: { text: string; tooltip: string; type?: 'info' | 'warning' | 'error' } | string | null;
}

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 300 });
  document.body.appendChild(host);
  return host;
}

const columns: ColumnDef<Row>[] = [
  { id: 'info', field: 'info', headerName: 'Info', cellType: 'tooltip', width: 200 },
];

describe('tooltip cellType renderer', () => {
  it('wraps a value with tooltip text in an affordance trigger span', () => {
    const data: Row[] = [{ id: 1, info: { text: 'In stock', tooltip: 'Ships in 24h', type: 'info' } }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const trigger = host.querySelector('.bg-cell-tooltip-trigger') as HTMLElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger!.textContent).toBe('In stock');
    expect(trigger!.style.borderBottom).toContain('dotted');
    expect(trigger!.style.cursor).toBe('help');

    grid.unmount();
  });

  it('renders no trigger span (plain text) when value has no tooltip text', () => {
    // Plain string, or object missing tooltip — both should render plain text
    const data: Row[] = [{ id: 1, info: 'Just text' }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const trigger = host.querySelector('.bg-cell-tooltip-trigger');
    expect(trigger).toBeNull();
    const cell = host.querySelector('[role="gridcell"][data-col="0"]') as HTMLElement;
    expect(cell.textContent).toBe('Just text');

    grid.unmount();
  });

  it('mouseenter creates a tooltip element on document.body, mouseleave removes it', () => {
    const data: Row[] = [{ id: 1, info: { text: 'Low stock', tooltip: 'Only 3 left', type: 'warning' } }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const cell = host.querySelector('[role="gridcell"][data-col="0"]') as HTMLElement;
    expect(cell).not.toBeNull();

    // Pre-hover: no tooltip in body
    expect(document.body.querySelector('div[style*="position: fixed"][style*="z-index: 200"]')).toBeNull();

    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    const tooltipEl = document.body.querySelector('div[style*="position: fixed"][style*="z-index: 200"]') as HTMLElement | null;
    expect(tooltipEl).not.toBeNull();
    expect(tooltipEl!.textContent).toBe('Only 3 left');
    // Warning type → amber background (jsdom preserves the hex string we set)
    expect(tooltipEl!.style.backgroundColor).toBe('#fef3c7');

    cell.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(document.body.querySelector('div[style*="position: fixed"][style*="z-index: 200"]')).toBeNull();

    grid.unmount();
  });

  it('error type uses red background colour', () => {
    const data: Row[] = [{ id: 1, info: { text: 'Discontinued', tooltip: 'No longer made', type: 'error' } }];
    const host = makeHost();
    const grid = createGrid<Row>({ columns, data, plugins: [cellRenderers()] });
    grid.mount(host);
    grid.refresh();

    const cell = host.querySelector('[role="gridcell"][data-col="0"]') as HTMLElement;
    cell.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const tooltipEl = document.body.querySelector('div[style*="position: fixed"][style*="z-index: 200"]') as HTMLElement | null;
    expect(tooltipEl).not.toBeNull();
    expect(tooltipEl!.style.backgroundColor).toBe('#fee2e2');

    cell.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    grid.unmount();
  });
});
