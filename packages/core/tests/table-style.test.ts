import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';

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
