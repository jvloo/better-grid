import { describe, expect, it } from 'vitest';
import { scrollCellIntoView } from '../src/ui/scroll-into-view';

function makeScrollbar(scrollTop: number, scrollLeft: number, clientHeight = 400): HTMLElement {
  const el = document.createElement('div');
  // happy-dom doesn't expose real layout; set the properties we need.
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  el.scrollTop = scrollTop;
  el.scrollLeft = scrollLeft;
  return el;
}

function makeViewport(clientWidth = 500): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  return el;
}

describe('scrollCellIntoView', () => {
  it('does nothing when fakeScrollbar is null', () => {
    // Simply not throwing is the contract.
    expect(() =>
      scrollCellIntoView({
        cell: { rowIndex: 0, colIndex: 0 },
        fakeScrollbar: null,
        viewport: null,
        colOffsets: [0],
        rowOffsets: [0],
        headerHeight: 32,
        frozenLeftColumns: 0,
      }),
    ).not.toThrow();
  });

  it('scrolls down when the row is below the viewport', () => {
    const fakeScrollbar = makeScrollbar(0, 0, 200);
    const viewport = makeViewport(500);
    scrollCellIntoView({
      cell: { rowIndex: 10, colIndex: 0 },
      fakeScrollbar,
      viewport,
      colOffsets: [0, 100],
      rowOffsets: Array.from({ length: 12 }, (_, i) => i * 40), // rows 40px each
      headerHeight: 32,
      frozenLeftColumns: 0,
    });
    // row 10 top=400, bottom=440; viewport top=0, bottom=168 → scroll down to 272
    expect(fakeScrollbar.scrollTop).toBeGreaterThan(0);
  });

  it('scrolls up when the row is above the viewport', () => {
    const fakeScrollbar = makeScrollbar(500, 0, 200);
    const viewport = makeViewport(500);
    scrollCellIntoView({
      cell: { rowIndex: 0, colIndex: 0 },
      fakeScrollbar,
      viewport,
      colOffsets: [0, 100],
      rowOffsets: [0, 40, 80, 120],
      headerHeight: 32,
      frozenLeftColumns: 0,
    });
    expect(fakeScrollbar.scrollTop).toBe(0);
  });

  it('does not change horizontal scroll for frozen columns', () => {
    const fakeScrollbar = makeScrollbar(0, 0);
    const viewport = makeViewport(300);
    fakeScrollbar.scrollLeft = 250;
    scrollCellIntoView({
      cell: { rowIndex: 0, colIndex: 0 },
      fakeScrollbar,
      viewport,
      colOffsets: [0, 100, 200, 300, 400],
      rowOffsets: [0, 40],
      headerHeight: 32,
      frozenLeftColumns: 2, // col 0 is frozen
    });
    expect(fakeScrollbar.scrollLeft).toBe(250); // unchanged
  });

  it('scrolls horizontally when a scrollable column is off-screen right', () => {
    const fakeScrollbar = makeScrollbar(0, 0);
    const viewport = makeViewport(300);
    scrollCellIntoView({
      cell: { rowIndex: 0, colIndex: 3 },
      fakeScrollbar,
      viewport,
      colOffsets: [0, 100, 200, 300, 400],
      rowOffsets: [0, 40],
      headerHeight: 32,
      frozenLeftColumns: 0,
    });
    // col 3 right edge = 400; viewport right = 300 → scroll right to 100
    expect(fakeScrollbar.scrollLeft).toBe(100);
  });

  it('scrolls horizontally left when the target column is before the viewport', () => {
    const fakeScrollbar = makeScrollbar(0, 250);
    const viewport = makeViewport(300);
    scrollCellIntoView({
      cell: { rowIndex: 0, colIndex: 0 },
      fakeScrollbar,
      viewport,
      colOffsets: [0, 100, 200, 300, 400],
      rowOffsets: [0, 40],
      headerHeight: 32,
      frozenLeftColumns: 0,
    });
    // col 0 left=0 < viewLeft=250 → scrollLeft = 0
    expect(fakeScrollbar.scrollLeft).toBe(0);
  });
});
