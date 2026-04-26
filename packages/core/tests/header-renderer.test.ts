import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createGrid } from '../src/grid';

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  // Make rAF fire synchronously so render() executes before assertions
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
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

describe('column.headerRenderer', () => {
  test('replaces default header content when set', () => {
    const host = makeHost();

    const grid = createGrid<{ id: number }>({
      columns: [
        {
          id: 'name',
          field: 'name' as never,
          headerName: 'Name',
          headerRenderer: (container) => {
            const el = document.createElement('strong');
            el.textContent = 'CUSTOM';
            container.replaceChildren(el);
          },
        },
      ],
      data: [],
    });
    grid.mount(host);
    grid.refresh();

    const headerCell = host.querySelector('.bg-header-cell strong');
    expect(headerCell?.textContent).toBe('CUSTOM');

    grid.unmount();
  });

  test('uses headerName as plain text when headerRenderer is absent', () => {
    const host = makeHost();

    const grid = createGrid<{ value: string }>({
      columns: [
        {
          id: 'value',
          field: 'value',
          headerName: 'My Column',
        },
      ],
      data: [],
    });
    grid.mount(host);
    grid.refresh();

    const textSpan = host.querySelector('.bg-header-cell .bg-header-cell__text');
    expect(textSpan?.textContent).toBe('My Column');

    grid.unmount();
  });

  test('headerRenderer receives the correct ctx (column + columnIndex)', () => {
    const host = makeHost();

    let capturedIndex: number | undefined;
    let capturedColId: string | undefined;

    const grid = createGrid<{ x: string }>({
      columns: [
        {
          id: 'x',
          field: 'x',
          headerName: 'X',
          headerRenderer: (_container, ctx) => {
            capturedIndex = ctx.columnIndex;
            capturedColId = ctx.column.id;
          },
        },
      ],
      data: [],
    });
    grid.mount(host);
    grid.refresh();

    expect(capturedIndex).toBe(0);
    expect(capturedColId).toBe('x');

    grid.unmount();
  });
});
