import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createGrid } from '../src/grid';

const cssSource = readFileSync(
  path.resolve(__dirname, '../src/styles/grid.css'),
  'utf8',
);
const gridSource = readFileSync(
  path.resolve(__dirname, '../src/grid.ts'),
  'utf8',
);
const layersSource = readFileSync(
  path.resolve(__dirname, '../src/rendering/layers.ts'),
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

function setClientSize(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
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

  test('floating scrollbars use custom fixed-style thumbs with no native arrow buttons', () => {
    expect(cssSource).not.toMatch(/\.bg-grid__float-h-track::-webkit-scrollbar-button/);
    expect(cssSource).not.toMatch(/\.bg-grid__float-v-track::-webkit-scrollbar-button/);

    const floatingThumbRule = cssSource.match(
      /\.bg-grid__float-h-thumb,\s*\.bg-grid__float-v-thumb\s*\{([^}]*)\}/,
    );
    expect(floatingThumbRule?.[1]).toMatch(/background:\s*var\(--bg-scrollbar-thumb,\s*#c1c1c1\)/);
    expect(floatingThumbRule?.[1]).toMatch(/border-radius:\s*4px/);

    expect(cssSource).toMatch(/\.bg-grid__float-h-thumb\s*\{\s*height:\s*8px/);
    expect(cssSource).toMatch(/\.bg-grid__float-v-thumb\s*\{\s*width:\s*8px/);

    const floatingTrackRule = cssSource.match(
      /\.bg-grid__float-h-track,\s*\.bg-grid__float-v-track\s*\{([^}]*)\}/,
    );
    expect(floatingTrackRule?.[1]).toMatch(/overflow:\s*hidden/);

    expect(gridSource).toContain("const trackSize = 'var(--bg-scrollbar-size, 8px)'");
    expect(gridSource).toContain("floatingHTrack.style.setProperty('right', `calc(${right}px + var(--bg-scrollbar-size, 8px))`)");
    expect(gridSource).toContain('getFloatingScrollbarBottomInset()');
    expect(gridSource).toContain('getFloatingScrollbarSize()');
    expect(gridSource).toContain("floatingHThumb.className = 'bg-grid__float-h-thumb'");
    expect(gridSource).toContain("floatingVThumb.className = 'bg-grid__float-v-thumb'");
  });
});

describe('floating scrollbar layout', () => {
  test('horizontal floating track starts after frozen-left columns', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, width: 40 },
        { id: 'b', field: 'b' as never, width: 60 },
        { id: 'm_0', field: 'm0' as never, width: 200 },
        { id: 'm_1', field: 'm1' as never, width: 200 },
      ],
      data: [{ a: 'A', b: 'B', m0: '0', m1: '1' }],
      frozen: { left: 2 },
      scrollbar: {
        mode: 'floating',
        horizontalOffsetLeft: 'after-frozen-left',
        verticalOffsetTop: 'header',
      },
      headerHeight: 32,
    });

    grid.mount(host);
    grid.refresh();

    const hTrack = host.querySelector<HTMLElement>('.bg-grid__float-h-track');
    const vTrack = host.querySelector<HTMLElement>('.bg-grid__float-v-track');
    expect(hTrack).not.toBeNull();
    expect(vTrack).not.toBeNull();
    expect(hTrack!.style.left).toBe('110px');
    expect(hTrack!.style.bottom).toBe('1px');
    expect(vTrack!.style.bottom).toBe('9px');

    grid.unmount();
  });

  test('borderless floating scrollbar keeps the configured bottom edge', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, width: 120 },
        { id: 'm_0', field: 'm0' as never, width: 300 },
        { id: 'm_1', field: 'm1' as never, width: 300 },
      ],
      data: [{ a: 'A', m0: '0', m1: '1' }],
      bordered: false,
      scrollbar: { mode: 'floating' },
    });

    grid.mount(host);
    grid.refresh();

    const hTrack = host.querySelector<HTMLElement>('.bg-grid__float-h-track');
    const vTrack = host.querySelector<HTMLElement>('.bg-grid__float-v-track');
    expect(hTrack).not.toBeNull();
    expect(vTrack).not.toBeNull();
    expect(hTrack!.style.bottom).toBe('0px');
    expect(vTrack!.style.bottom).toBe('8px');

    grid.unmount();
  });

  test('floating scrollbar does not reserve horizontal-scrollbar gutter in frozen overlay', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, width: 80 },
        { id: 'm_0', field: 'm0' as never, width: 300 },
        { id: 'm_1', field: 'm1' as never, width: 300 },
      ],
      data: Array.from({ length: 20 }, (_, i) => ({ a: `A${i}`, m0: '0', m1: '1' })),
      frozen: { left: 1 },
      scrollbar: {
        mode: 'floating',
        horizontalOffsetLeft: 'after-frozen-left',
      },
    });

    grid.mount(host);
    grid.refresh();

    const frozenOverlay = host.querySelector<HTMLElement>('.bg-grid__frozen-overlay');
    expect(frozenOverlay).not.toBeNull();
    expect(frozenOverlay!.style.bottom).toBe('0px');

    grid.unmount();
  });

  test('floating scrollbar adds inner end padding only on overflowing axes', () => {
    const host = makeHost();
    const grid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, width: 120 },
        { id: 'm_0', field: 'm0' as never, width: 300 },
        { id: 'm_1', field: 'm1' as never, width: 300 },
      ],
      data: Array.from({ length: 20 }, (_, i) => ({ a: `A${i}`, m0: '0', m1: '1' })),
      scrollbar: { mode: 'floating' },
      headerHeight: 40,
    });

    grid.mount(host);

    const viewport = host.querySelector<HTMLElement>('.bg-grid__viewport')!;
    const scrollbar = host.querySelector<HTMLElement>('.bg-grid__scroll')!;
    const sizer = host.querySelector<HTMLElement>('.bg-grid__sizer')!;
    setClientSize(viewport, 600, 400);
    setClientSize(scrollbar, 600, 400);
    grid.refresh();

    expect(sizer.style.width).toBe('728px');
    expect(sizer.style.height).toBe('848px');

    grid.unmount();

    const fittingHost = makeHost();
    const fittingGrid = createGrid({
      columns: [{ id: 'a', field: 'a' as never, width: 100 }],
      data: [{ a: 'A' }, { a: 'B' }],
      scrollbar: { mode: 'floating' },
      headerHeight: 40,
    });

    fittingGrid.mount(fittingHost);

    const fittingViewport = fittingHost.querySelector<HTMLElement>('.bg-grid__viewport')!;
    const fittingScrollbar = fittingHost.querySelector<HTMLElement>('.bg-grid__scroll')!;
    const fittingSizer = fittingHost.querySelector<HTMLElement>('.bg-grid__sizer')!;
    setClientSize(fittingViewport, 600, 400);
    setClientSize(fittingScrollbar, 600, 400);
    fittingGrid.refresh();

    expect(fittingSizer.style.width).toBe('100px');
    expect(fittingSizer.style.height).toBe('120px');

    fittingGrid.unmount();

    const pinnedHost = makeHost();
    const pinnedGrid = createGrid({
      columns: [
        { id: 'a', field: 'a' as never, width: 120 },
        { id: 'm_0', field: 'm0' as never, width: 300 },
        { id: 'm_1', field: 'm1' as never, width: 300 },
      ],
      data: Array.from({ length: 20 }, (_, i) => ({ a: `A${i}`, m0: '0', m1: '1' })),
      pinned: { bottom: [{ a: 'Total', m0: '0', m1: '1' }] },
      scrollbar: { mode: 'floating' },
      headerHeight: 40,
    });

    pinnedGrid.mount(pinnedHost);

    const pinnedViewport = pinnedHost.querySelector<HTMLElement>('.bg-grid__viewport')!;
    const pinnedScrollbar = pinnedHost.querySelector<HTMLElement>('.bg-grid__scroll')!;
    const pinnedSizer = pinnedHost.querySelector<HTMLElement>('.bg-grid__sizer')!;
    setClientSize(pinnedViewport, 600, 400);
    setClientSize(pinnedScrollbar, 600, 400);
    pinnedGrid.refresh();

    expect(pinnedSizer.style.width).toBe('720px');
    expect(pinnedSizer.style.height).toBe('880px');

    pinnedGrid.unmount();
  });

  test('fixed scrollbar keeps the frozen overlay gutter branch', () => {
    expect(gridSource).toContain("frozenColOverlay!.style.bottom = isFloatingScrollbar ? '0' : 'var(--bg-scrollbar-size, 10px)'");
    expect(gridSource).toContain("frozenColOverlay.style.bottom = isFloatingScrollbar ? '0' : 'var(--bg-scrollbar-size, 10px)'");
  });

  test('selection range sits behind pinned rows while fill handle remains unclipped', () => {
    expect(gridSource).toContain('selectionLayer = new SelectionLayer(cellContainer, viewport!, container!)');
    expect(gridSource).toContain("pinnedTopWrapper.style.zIndex = '6'");
    expect(gridSource).toContain("pinnedBottomWrapper.style.zIndex = '6'");
    expect(gridSource).toContain('Range border renders inside the clipped viewport, below pinned rows.');
    expect(gridSource).toContain('Fill handle renders at grid-root level so its protruding corner is not clipped.');
    expect(gridSource).toContain('bodyBottom: viewport.clientHeight - pinnedBottomH');
    expect(gridSource).toContain('bodyLeft: getVisibleFrozenLeftWidth(measurements, state)');
    expect(gridSource).toContain('pinnedBottomHeight: pinnedBottomH');
    expect(layersSource).toContain('viewState.pinnedBottomHeight > 0');
    expect(layersSource).toContain('y + 7 > viewState.bodyBottom');
    expect(layersSource).toContain('x < viewState.bodyLeft');
  });
});
