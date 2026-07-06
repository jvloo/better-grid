import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef } from '../src/types';
import { RenderingPipeline } from '../src/rendering/pipeline';

interface Row {
  label?: string;
  enabled: boolean;
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

describe('render cleanup pruning', () => {
  it('removes stale cleanup callbacks when the next render has none', () => {
    const host = makeHost();
    let cleanupCalls = 0;

    const columns: ColumnDef<Row>[] = [
      {
        id: 'enabled',
        field: 'enabled',
        headerName: 'Enabled',
        width: 120,
        cellRenderer: (container, ctx) => {
          container.textContent = ctx.value ? 'on' : 'off';
          if (!ctx.value) return undefined;
          return () => {
            cleanupCalls++;
          };
        },
      },
    ];
    const grid = createGrid<Row>({
      columns,
      data: [{ enabled: true }],
      rowHeight: 40,
      headerHeight: 40,
    });

    grid.mount(host);
    grid.updateCell(0, 'enabled', false);

    expect(cleanupCalls).toBe(1);

    grid.refresh();

    expect(cleanupCalls).toBe(1);

    grid.unmount();
  });

  it('hides recycled cells after data shrinks', () => {
    const host = makeHost();

    const columns: ColumnDef<Row>[] = [
      {
        id: 'label',
        field: 'label',
        headerName: 'Label',
        width: 120,
      },
    ];
    const grid = createGrid<Row>({
      columns,
      data: [
        { enabled: true, label: 'first' },
        { enabled: true, label: 'second' },
      ],
      rowHeight: 40,
      headerHeight: 40,
    });

    grid.mount(host);
    expect(
      Array.from(host.querySelectorAll<HTMLElement>('.bg-cell')).filter((cell) => cell.style.display !== 'none'),
    ).toHaveLength(2);

    grid.setData([{ enabled: true, label: 'first' }]);

    const visibleCells = Array.from(host.querySelectorAll<HTMLElement>('.bg-cell')).filter(
      (cell) => cell.style.display !== 'none',
    );
    expect(visibleCells).toHaveLength(1);
    expect(visibleCells[0]?.textContent).toBe('first');
    expect(
      Array.from(host.querySelectorAll<HTMLElement>('.bg-cell')).some(
        (cell) => cell.textContent === 'second' && cell.style.display !== 'none',
      ),
    ).toBe(false);
    const recycledSecondCell = Array.from(host.querySelectorAll<HTMLElement>('.bg-cell')).find(
      (cell) => cell.textContent === 'second',
    );
    expect(recycledSecondCell?.style.getPropertyPriority('display')).toBe('important');

    grid.unmount();
  });

  it('does not render virtual range rows beyond the data length', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const pipeline = new RenderingPipeline<Row>();
    const columns = [
      {
        id: 'label',
        field: 'label',
        headerName: 'Label',
        width: 120,
      },
    ] as never;

    const measurements = {
      rowOffsets: new Float32Array([0, 40, 80]),
      colOffsets: new Float32Array([0, 120]),
      totalHeight: 80,
      totalWidth: 120,
    };

    pipeline.renderCells(
      container,
      0,
      2,
      0,
      1,
      [{ enabled: true, label: 'first' }],
      columns,
      measurements,
      { active: null, ranges: [] },
    );

    const visibleCells = Array.from(container.querySelectorAll<HTMLElement>('.bg-cell')).filter(
      (cell) => cell.style.display !== 'none',
    );
    expect(visibleCells).toHaveLength(1);
    expect(visibleCells[0]?.getAttribute('aria-rowindex')).toBe('1');
    expect(visibleCells[0]?.textContent).toBe('first');
  });
});
