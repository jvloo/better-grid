import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createGrid } from '../src/grid';

const cssSource = readFileSync(
  path.resolve(__dirname, '../src/styles/grid.css'),
  'utf8',
);

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
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('table-style flags', () => {
  test('default adds bg-grid--bordered class (bordered=true is the default)', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
    });
    grid.mount(host);
    grid.refresh();
    // host IS the .bg-grid container — class is set on it directly
    expect(host.classList.contains('bg-grid--bordered')).toBe(true);
    expect(host.classList.contains('bg-grid--striped')).toBe(false);
    grid.unmount();
  });

  test('bordered=false drops the bordered class', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      bordered: false,
    });
    grid.mount(host);
    grid.refresh();
    expect(host.classList.contains('bg-grid--bordered')).toBe(false);
    grid.unmount();
  });

  test('striped=true adds the striped class; combinable with bordered', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [{ field: 'x' as never, headerName: 'X' }],
      data: [],
      bordered: true,
      striped: true,
    });
    grid.mount(host);
    grid.refresh();
    expect(host.classList.contains('bg-grid--bordered')).toBe(true);
    expect(host.classList.contains('bg-grid--striped')).toBe(true);
    grid.unmount();
  });
});

describe('table-style CSS rules', () => {
  // happy-dom doesn't apply rules from grid.css, so assert the rules exist in
  // the source instead. Guards against accidental deletion of the selectors
  // the table-style flags (or merge plugin) depend on.

  test('.bg-grid--bordered defines cell border-right + border-bottom', () => {
    expect(cssSource).toMatch(/\.bg-grid--bordered \.bg-cell\s*\{[^}]*border-right:[^}]*1px solid/);
    expect(cssSource).toMatch(/\.bg-grid--bordered \.bg-cell\s*\{[^}]*border-bottom:[^}]*1px solid/);
  });

  test('.bg-grid--striped defines alternate row background', () => {
    expect(cssSource).toMatch(/\.bg-grid--striped \.bg-cell\[data-row-even="1"\]\s*\{[^}]*background:/);
    // Stripe color must be themable via --bg-stripe-bg
    expect(cssSource).toMatch(/--bg-stripe-bg/);
  });

  test('.bg-cell--merge-hidden zeroes border-width so internal grid lines do not bleed through', () => {
    // Match the rule and verify border-width:0 appears inside its block
    const ruleMatch = cssSource.match(/\.bg-cell--merge-hidden\s*\{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    expect(ruleMatch![1]).toMatch(/border-width:\s*0\s*(!important)?\s*;/);
  });
});
