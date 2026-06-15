import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid } from '../src/grid';
import { clipboard } from '../../plugins/src/free/clipboard';
import type { ColumnDef } from '../src/types';

interface Row {
  name: string;
}

let originalClipboard: Clipboard | undefined;
let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalClipboard = navigator.clipboard;
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  globalThis.requestAnimationFrame = originalRaf;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 300 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 160 });
  document.body.appendChild(host);
  return host;
}

function makeColumns(): ColumnDef<Row>[] {
  return [
    {
      id: 'name',
      field: 'name',
      headerName: 'Name',
      width: 120,
    },
  ];
}

function getMountedGridElement(host: HTMLElement): HTMLElement {
  return host.classList.contains('bg-grid') ? host : (host.querySelector('.bg-grid') as HTMLElement);
}

describe('clipboard native text selection', () => {
  it('does not intercept Ctrl+C when browser text is selected', () => {
    const host = makeHost();
    const onCopy = vi.fn();
    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: [{ name: 'Alpha' }],
      plugins: [clipboard({ onCopy })],
      selection: false,
    });

    grid.mount(host);
    grid.refresh();

    const gridEl = getMountedGridElement(host);
    const textEl = host.querySelector('.bg-cell__text') as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    gridEl.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(onCopy).not.toHaveBeenCalled();

    grid.unmount();
  });

  it('still handles Ctrl+C through the grid clipboard when no browser text is selected', () => {
    const host = makeHost();
    const onCopy = vi.fn();
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    });
    const grid = createGrid<Row>({
      columns: makeColumns(),
      data: [{ name: 'Alpha' }],
      plugins: [clipboard({ onCopy })],
      selection: { mode: 'range' },
    });

    grid.mount(host);
    grid.refresh();
    grid.setSelection({ active: { rowIndex: 0, colIndex: 0 }, ranges: [] });

    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    getMountedGridElement(host).dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onCopy).toHaveBeenCalledWith('Alpha');
    expect(write.mock.calls.length + writeText.mock.calls.length).toBeGreaterThan(0);

    grid.unmount();
  });
});
