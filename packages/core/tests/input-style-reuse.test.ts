import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
  amount: number;
}

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 240 });
  document.body.appendChild(host);
  return host;
}

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('editing inputStyle reuse', () => {
  it('reuses formatter-only input boxes across refreshes', () => {
    const host = makeHost();
    const columns: ColumnDef<Row>[] = [
      {
        id: 'amount',
        field: 'amount',
        headerName: 'Amount',
        editable: true,
        valueFormatter: (value) => `$${Number(value).toLocaleString('en-AU')}`,
      },
    ];
    const grid = createGrid<Row>({
      columns,
      data: [{ amount: 1200 }],
      plugins: [editing({ inputStyle: true })],
    });

    grid.mount(host);
    grid.refresh();

    const first = host.querySelector('.bg-input-box');
    expect(first).not.toBeNull();

    grid.refresh();

    expect(host.querySelector('.bg-input-box')).toBe(first);

    grid.unmount();
  });

  it('keeps centered input-style floating editors aligned while growing to fit text', () => {
    const originalGetRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      if (this instanceof HTMLElement && this.style.visibility === 'hidden') {
        const styles = getComputedStyle(this);
        const padLeft = parseFloat(styles.paddingLeft) || 0;
        const padRight = parseFloat(styles.paddingRight) || 0;
        const textWidth = (this.textContent ?? '').length * 7.5;
        return makeRect(-9999, -9999, textWidth + padLeft + padRight, 16);
      }
      return originalGetRect.call(this);
    };

    try {
      const host = makeHost();
      const columns: ColumnDef<Row>[] = [
        {
          id: 'amount',
          field: 'amount',
          headerName: 'Amount',
          width: 100,
          align: 'center',
          editable: true,
          valueFormatter: (value) => Number(value).toLocaleString('en-US'),
        },
      ];
      const grid = createGrid<Row>({
        columns,
        data: [{ amount: 22_000_000 }],
        plugins: [editing({ inputStyle: true, editTrigger: 'click' })],
      });

      grid.mount(host);
      grid.refresh();

      const gridEl = host.classList.contains('bg-grid')
        ? host
        : (host.querySelector('.bg-grid') as HTMLElement);
      const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
      const inputBox = cell.querySelector('.bg-input-box') as HTMLElement;
      expect(gridEl).not.toBeNull();
      expect(inputBox).not.toBeNull();

      gridEl.getBoundingClientRect = () => makeRect(0, 0, 400, 240);
      cell.getBoundingClientRect = () => makeRect(90, 40, 100, 40);
      inputBox.style.paddingLeft = '10px';
      inputBox.style.paddingRight = '10px';
      inputBox.style.textAlign = 'center';
      inputBox.getBoundingClientRect = () => makeRect(100, 45, 80, 30);

      grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 0 });

      const floatBox = document.body.querySelector('.bg-cell-editor-float') as HTMLElement;
      expect(floatBox).not.toBeNull();
      expect(parseFloat(floatBox.style.width)).toBeCloseTo(95, 0);
      expect(parseFloat(floatBox.style.left)).toBeCloseTo(92.5, 1);

      grid.unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetRect;
    }
  });
});
