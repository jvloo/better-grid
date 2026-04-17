import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid } from '../src/grid';
import type { ColumnDef, GridPlugin, PluginContext } from '../src/types';

interface Row {
  id: number;
  name: string;
  salary: number;
  priority: string;
}

const seedData = (): Row[] => [
  { id: 1, name: 'Alice', salary: 50000, priority: 'high' },
  { id: 2, name: 'Bob', salary: 60000, priority: 'low' },
];

let container: HTMLElement;
let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(container, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(container);
  // Make rAF fire synchronously so mount() runs its warn logic before assertions
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('dev-mode warnings', () => {
  describe('duplicate column id', () => {
    it('throws when two columns share the same id', () => {
      const columns: ColumnDef<Row>[] = [
        { id: 'name', accessorKey: 'name', header: 'Name' },
        { id: 'name', accessorKey: 'salary', header: 'Salary' },
      ];
      expect(() => createGrid<Row>({ columns, data: seedData() })).toThrow(
        /\[better-grid\] Duplicate column id: "name"/,
      );
    });

    it('does not throw when all column ids are unique', () => {
      const columns: ColumnDef<Row>[] = [
        { id: 'name', accessorKey: 'name', header: 'Name' },
        { id: 'salary', accessorKey: 'salary', header: 'Salary' },
      ];
      expect(() => createGrid<Row>({ columns, data: seedData() })).not.toThrow();
    });
  });

  describe('accessorKey not present on first data row', () => {
    it('warns when explicit accessorKey is missing from the sample row', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const columns: ColumnDef<Row>[] = [
        { id: 'salary', accessorKey: 'sallary' as keyof Row & string, header: 'Salary' },
      ];
      createGrid<Row>({ columns, data: seedData() });
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/Column "salary": accessorKey "sallary" not found/),
      );
    });

    it('is silent when column uses accessorFn instead of accessorKey', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const columns: ColumnDef<Row>[] = [
        {
          id: 'fullName',
          accessorFn: (row) => row.name,
          header: 'Full name',
        },
      ];
      createGrid<Row>({ columns, data: seedData() });
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/accessorKey .* not found/),
      );
    });

    it('is silent when accessorKey equals id (auto-fill fallthrough)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // User provides accessorKey === id explicitly; we still skip (can't tell apart
      // from auto-fill, and users rarely pick a typo that matches the id).
      const columns: ColumnDef<Row>[] = [
        { id: 'missing', accessorKey: 'missing' as keyof Row & string, header: 'Missing' },
      ];
      createGrid<Row>({ columns, data: seedData() });
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/accessorKey .* not found/),
      );
    });

    it('is silent when data is empty', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const columns: ColumnDef<Row>[] = [
        { id: 'salary', accessorKey: 'sallary' as keyof Row & string, header: 'Salary' },
      ];
      createGrid<Row>({ columns, data: [] });
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/accessorKey .* not found/),
      );
    });

    it('is silent when accessorKey exists on the sample row', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const columns: ColumnDef<Row>[] = [
        { id: 'displayName', accessorKey: 'name', header: 'Name' },
      ];
      createGrid<Row>({ columns, data: seedData() });
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/accessorKey .* not found/),
      );
    });
  });

  describe('unknown cellType', () => {
    it('warns on mount when cellType is not built-in and no plugin handles it', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const columns: ColumnDef<Row>[] = [
        { id: 'priority', accessorKey: 'priority', header: 'Priority', cellType: 'priotity' },
      ];
      const grid = createGrid<Row>({ columns, data: seedData() });
      // Should not have warned yet — mount hasn't happened
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/cellType "priotity"/),
      );
      grid.mount(container);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/Column "priority": cellType "priotity" is not built-in/),
      );
    });

    it('is silent for built-in cellTypes (currency)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const columns: ColumnDef<Row>[] = [
        { id: 'salary', accessorKey: 'salary', header: 'Salary', cellType: 'currency' },
      ];
      const grid = createGrid<Row>({ columns, data: seedData() });
      grid.mount(container);
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/cellType .* is not built-in/),
      );
    });

    it('is silent when a plugin registers the cellType before mount', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const starPlugin: GridPlugin<'star-renderer'> = {
        id: 'star-renderer',
        init(ctx: PluginContext) {
          return ctx.registerCellType('star', {
            render(cell) {
              cell.textContent = '*';
            },
          });
        },
      };
      const columns: ColumnDef<Row>[] = [
        { id: 'priority', accessorKey: 'priority', header: 'Priority', cellType: 'star' },
      ];
      const grid = createGrid<Row>({
        columns,
        data: seedData(),
        plugins: [starPlugin],
      });
      grid.mount(container);
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringMatching(/cellType "star" is not built-in/),
      );
    });
  });
});
