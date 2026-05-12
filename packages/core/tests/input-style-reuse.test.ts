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

  it('keeps input-style floating editors left-aligned while growing to fit text', () => {
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
      expect(parseFloat(floatBox.style.left)).toBeCloseTo(100, 1);

      grid.unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetRect;
    }
  });

  it('opens adorned input-style number cells in the floating editor on first edit', () => {
    const host = makeHost();
    const columns: ColumnDef<Row>[] = [
      {
        id: 'amount',
        field: 'amount',
        headerName: 'Amount',
        width: 100,
        align: 'center',
        editable: true,
        cellType: 'number',
        unit: '%',
        valueFormatter: (value) => Number(value).toFixed(2),
      },
    ];
    const grid = createGrid<Row>({
      columns,
      data: [{ amount: 10 }],
      plugins: [editing({ inputStyle: true, editTrigger: 'click' })],
    });

    grid.mount(host);
    grid.refresh();

    const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
    const inputBox = cell.querySelector('.bg-input-box') as HTMLElement;
    const valueSpan = cell.querySelector('.bg-input-box__value') as HTMLElement;
    const sourceSuffix = cell.querySelector('.bg-input-box__suffix') as HTMLElement;
    inputBox.getBoundingClientRect = () => makeRect(100, 45, 80, 30);
    valueSpan.getBoundingClientRect = () =>
      valueSpan.textContent ? makeRect(110, 52, 60, 16) : makeRect(100, 45, 80, 30);
    sourceSuffix.getBoundingClientRect = () => makeRect(152, 45, 10, 30);

    grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 0 });

    const floatBox = document.body.querySelector('.bg-cell-editor-float') as HTMLElement | null;
    const inlineInput = host.querySelector('input.bg-cell-editor--inline');
    const editor = floatBox?.querySelector('.bg-cell-editor') as HTMLElement | null;
    const suffix = floatBox?.querySelector('.bg-cell-editor-float__suffix') as HTMLElement | null;
    expect(floatBox).not.toBeNull();
    expect(floatBox?.textContent).toContain('10.00');
    expect(floatBox?.textContent).toContain('%');
    expect(editor).not.toBeNull();
    expect(suffix).not.toBeNull();
    expect(getComputedStyle(editor!).paddingLeft).toBe('0px');
    expect(getComputedStyle(editor!).paddingRight).toBe('18px');
    expect(getComputedStyle(editor!).marginLeft).toBe('10px');
    expect(getComputedStyle(editor!).marginRight).toBe('10px');
    expect(getComputedStyle(editor!).marginTop).toBe('7px');
    expect(getComputedStyle(editor!).height).toBe('16px');
    expect(getComputedStyle(suffix!).right).toBe('18px');
    expect(getComputedStyle(suffix!).width).toBe('10px');
    expect(getComputedStyle(suffix!).lineHeight).toBe(getComputedStyle(sourceSuffix).lineHeight);
    expect(inlineInput).toBeNull();

    grid.unmount();
  });

  it('uses adornment-aware overflow when choosing inline vs floating editors', () => {
    const originalGetRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      if (this instanceof HTMLElement && this.style.visibility === 'hidden') {
        const textWidth = (this.textContent ?? '').length * 7.5;
        return makeRect(-9999, -9999, textWidth, 16);
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
          width: 50,
          align: 'center',
          editable: true,
          cellType: 'number',
          unit: '%',
          valueFormatter: (value) => Number(value).toFixed(2),
        },
      ];
      const grid = createGrid<Row>({
        columns,
        data: [{ amount: 10 }],
        plugins: [editing({ inputStyle: true, editTrigger: 'click', editorMode: 'inline' })],
      });

      grid.mount(host);
      grid.refresh();

      const gridEl = host.classList.contains('bg-grid')
        ? host
        : (host.querySelector('.bg-grid') as HTMLElement);
      const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
      const inputBox = cell.querySelector('.bg-input-box') as HTMLElement;
      const valueSpan = cell.querySelector('.bg-input-box__value') as HTMLElement;
      const sourceSuffix = cell.querySelector('.bg-input-box__suffix') as HTMLElement;
      gridEl.getBoundingClientRect = () => makeRect(0, 0, 400, 240);
      cell.getBoundingClientRect = () => makeRect(90, 40, 50, 40);
      inputBox.getBoundingClientRect = () => makeRect(100, 45, 50, 30);
      valueSpan.getBoundingClientRect = () =>
        valueSpan.textContent ? makeRect(110, 52, 30, 16) : makeRect(100, 45, 50, 30);
      sourceSuffix.getBoundingClientRect = () => makeRect(132, 45, 8, 30);

      grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 0 });

      const floatBox = document.body.querySelector('.bg-cell-editor-float') as HTMLElement | null;
      expect(floatBox).not.toBeNull();
      expect(parseFloat(floatBox!.style.width)).toBeGreaterThan(50);
      expect(host.querySelector('input.bg-cell-editor--inline')).toBeNull();

      grid.unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetRect;
    }
  });

  it('promotes and demotes inline adorned editors as edited text overflows or fits', () => {
    const originalGetRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      if (this instanceof HTMLElement && this.style.visibility === 'hidden') {
        const textWidth = (this.textContent ?? '').length * 7.5;
        return makeRect(-9999, -9999, textWidth, 16);
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
          cellType: 'number',
          unit: '%',
          valueFormatter: (value) => Number(value).toFixed(2),
        },
      ];
      const grid = createGrid<Row>({
        columns,
        data: [{ amount: 1 }],
        plugins: [editing({ inputStyle: true, editTrigger: 'click', editorMode: 'inline' })],
      });

      grid.mount(host);
      grid.refresh();

      const cell = host.querySelector('.bg-cell[data-row="0"][data-col="0"]') as HTMLElement;
      const inputBox = cell.querySelector('.bg-input-box') as HTMLElement;
      const valueSpan = cell.querySelector('.bg-input-box__value') as HTMLElement;
      const sourceSuffix = cell.querySelector('.bg-input-box__suffix') as HTMLElement;
      inputBox.getBoundingClientRect = () => makeRect(100, 45, 80, 30);
      valueSpan.getBoundingClientRect = () =>
        valueSpan.querySelector('input') || valueSpan.textContent
          ? makeRect(110, 52, 60, 16)
          : makeRect(100, 45, 80, 30);
      sourceSuffix.getBoundingClientRect = () => makeRect(152, 45, 10, 30);

      grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 0 });

      const inlineInput = host.querySelector('input.bg-cell-editor--inline') as HTMLInputElement | null;
      expect(inlineInput).not.toBeNull();
      expect(document.body.querySelector('.bg-cell-editor-float')).toBeNull();

      inlineInput!.value = '123456789';
      inlineInput!.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '9' }));

      const floatingEditor = document.body.querySelector('.bg-cell-editor') as HTMLElement | null;
      expect(floatingEditor).not.toBeNull();
      expect(host.querySelector('input.bg-cell-editor--inline')).toBeNull();

      floatingEditor!.textContent = '1';
      const range = document.createRange();
      range.selectNodeContents(floatingEditor!);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      floatingEditor!.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));

      const demotedInput = host.querySelector('input.bg-cell-editor--inline') as HTMLInputElement | null;
      expect(document.body.querySelector('.bg-cell-editor-float')).toBeNull();
      expect(demotedInput).not.toBeNull();
      expect(demotedInput!.value).toBe('1');

      grid.unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetRect;
    }
  });

  it('keeps thousand separators while typing in floating number editors', () => {
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
          cellType: 'number',
        },
      ];
      const grid = createGrid<Row>({
        columns,
        data: [{ amount: 2700000 }],
        plugins: [editing({ inputStyle: true, editTrigger: 'click' })],
      });

      grid.mount(host);
      grid.refresh();

      grid.plugins.editing.startEdit({ rowIndex: 0, colIndex: 0 });

      const editor = document.body.querySelector('.bg-cell-editor') as HTMLElement;
      expect(editor).not.toBeNull();
      expect(editor.textContent).toBe('2,700,000');

      editor.textContent = '27000000';
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '0' }));

      expect(editor.textContent).toBe('27,000,000');

      grid.unmount();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetRect;
    }
  });
});
