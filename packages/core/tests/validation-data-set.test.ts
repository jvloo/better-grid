import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef } from '../src/types';
import { validation } from '../../plugins/src/free/validation';

interface Row {
  id: number;
  name: string;
}

let originalRaf: typeof requestAnimationFrame;
let container: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;

  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 500 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 300 });
  document.body.appendChild(container);
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  document.body.innerHTML = '';
});

function columns(): ColumnDef<Row>[] {
  return [
    { id: 'id', field: 'id', headerName: 'ID', width: 80 },
    {
      id: 'name',
      field: 'name',
      headerName: 'Name',
      width: 200,
      rules: [
        {
          validate: (value) => String(value ?? '').trim().length >= 3 || 'Name is too short',
        },
      ],
    },
  ];
}

describe('validation data updates', () => {
  it('does not move a stale validation error to the row that shifts into a deleted position', () => {
    const grid = createGrid<Row>({
      columns: columns(),
      data: [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
        { id: 3, name: 'Gamma' },
      ],
      plugins: [validation()],
      rowHeight: 32,
    });

    grid.mount(container);
    grid.updateCell(1, 'name', 'Hi');

    const api = (grid.plugins as Record<string, { getErrors(): unknown[] }>).validation;
    expect(api.getErrors()).toHaveLength(1);
    expect(container.querySelectorAll('.bg-cell--error')).toHaveLength(1);

    grid.setData([
      { id: 1, name: 'Alpha' },
      { id: 3, name: 'Gamma' },
    ]);
    grid.refresh();

    expect(api.getErrors()).toHaveLength(0);
    expect(container.querySelectorAll('.bg-cell--error')).toHaveLength(0);
    expect(container.querySelectorAll('.bg-validation-tooltip')).toHaveLength(0);

    grid.destroy();
  });
});
