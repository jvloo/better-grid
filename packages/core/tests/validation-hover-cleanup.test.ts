import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef } from '../src/types';
import { validation } from '../../plugins/src/free/validation';

interface Row {
  name: string;
}

let originalRaf: typeof requestAnimationFrame;
let originalAdd: typeof HTMLElement.prototype.addEventListener;
let originalRemove: typeof HTMLElement.prototype.removeEventListener;
let container: HTMLElement;
const activeMouseEnter = new Map<EventTarget, Set<EventListenerOrEventListenerObject>>();

function activeMouseEnterCount(): number {
  let count = 0;
  for (const listeners of activeMouseEnter.values()) count += listeners.size;
  return count;
}

function flushDeferredDestroy(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.body.innerHTML = '';
  activeMouseEnter.clear();

  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;

  originalAdd = HTMLElement.prototype.addEventListener;
  originalRemove = HTMLElement.prototype.removeEventListener;

  HTMLElement.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (type === 'mouseenter' && this.classList?.contains('bg-cell')) {
      let listeners = activeMouseEnter.get(this);
      if (!listeners) {
        listeners = new Set();
        activeMouseEnter.set(this, listeners);
      }
      listeners.add(listener);
    }
    return originalAdd.call(this, type, listener, options);
  };

  HTMLElement.prototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    if (type === 'mouseenter') {
      const listeners = activeMouseEnter.get(this);
      listeners?.delete(listener);
      if (listeners?.size === 0) activeMouseEnter.delete(this);
    }
    return originalRemove.call(this, type, listener, options);
  };

  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 500 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 300 });
  document.body.appendChild(container);
});

afterEach(() => {
  HTMLElement.prototype.addEventListener = originalAdd;
  HTMLElement.prototype.removeEventListener = originalRemove;
  globalThis.requestAnimationFrame = originalRaf;
  activeMouseEnter.clear();
  document.body.innerHTML = '';
});

function columns(): ColumnDef<Row>[] {
  return [
    {
      id: 'name',
      field: 'name',
      headerName: 'Name',
      rules: [{ validate: (value) => String(value ?? '').length >= 3 || 'Too short' }],
    },
  ];
}

describe('validation hover cleanup', () => {
  it('does not accumulate cell hover listeners across renders while an error is visible', async () => {
    const grid = createGrid<Row>({
      columns: columns(),
      data: [{ name: 'Hi' }],
      plugins: [validation({ validateOn: 'all' })],
      rowHeight: 32,
    });

    grid.mount(container);

    expect(activeMouseEnterCount()).toBe(1);

    for (let i = 0; i < 5; i++) {
      grid.refresh();
      expect(activeMouseEnterCount()).toBe(1);
    }

    grid.unmount();
    grid.destroy();
    await flushDeferredDestroy();

    expect(activeMouseEnterCount()).toBe(0);
  });
});

