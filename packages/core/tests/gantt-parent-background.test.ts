import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import { gantt } from '../../pro/src/gantt';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  parentId: number | null;
  startColumn: number;
  endColumn: number;
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
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 200 });
  document.body.appendChild(host);
  return host;
}

describe('gantt parent row background', () => {
  it('clears parent background when the same gantt cell re-renders as a child row', () => {
    const columns: ColumnDef<Row>[] = [
      { id: 'm_0', headerName: 'Jan', cellType: 'gantt', width: 80 },
    ];
    const parentData: Row[] = [
      { id: 1, parentId: null, startColumn: 0, endColumn: 0 },
      { id: 2, parentId: 1, startColumn: 0, endColumn: 0 },
    ];
    const childOnlyData: Row[] = [
      { id: 3, parentId: null, startColumn: 0, endColumn: 0 },
    ];

    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data: parentData,
      plugins: [gantt({ parentRowBackground: '#F8F8F8' })],
      hierarchy: {
        getRowId: (row) => row.id,
        getParentId: (row) => row.parentId,
        defaultExpanded: true,
      },
    });

    grid.mount(host);
    grid.refresh();

    const cell = host.querySelector<HTMLElement>('.bg-cell[data-row="0"][data-col="0"]');
    expect(cell?.style.backgroundColor).toBe('#F8F8F8');

    grid.setData(childOnlyData);

    const rerenderedCell = host.querySelector<HTMLElement>('.bg-cell[data-row="0"][data-col="0"]');
    expect(rerenderedCell?.style.backgroundColor).toBe('');

    grid.unmount();
  });
});
