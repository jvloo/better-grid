import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFilterPanel, type FilterApi } from '../src/ui/filter-panel';

type Col = { id: string; headerName?: string; cellType?: string };

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

function openAgainst(
  columns: readonly Col[],
  filterApi: FilterApi | undefined,
  columnId: string,
  currentFilter?: { columnId: string; value: unknown; operator: string },
) {
  const panel = createFilterPanel({
    getColumns: () => columns,
    getFilterApi: () => filterApi,
  });
  const anchor = document.createElement('div');
  anchor.className = 'bg-header-cell';
  document.body.appendChild(anchor);
  const event = new MouseEvent('contextmenu', { clientX: 50, clientY: 50, bubbles: true });
  Object.defineProperty(event, 'target', { value: anchor });
  panel.show(event, columnId, currentFilter);
  return panel;
}

describe('createFilterPanel', () => {
  it('is a no-op when no filter plugin is installed', () => {
    const panel = openAgainst([{ id: 'name' }], undefined, 'name');
    expect(document.querySelector('.bg-filter-panel')).toBeNull();
    expect(panel.isActive()).toBe(false);
  });

  it('renders title, operator select, input, and buttons', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    openAgainst([{ id: 'name', headerName: 'Full Name' }], api, 'name');

    const root = document.querySelector('.bg-filter-panel');
    expect(root).not.toBeNull();
    expect(root!.querySelector('.bg-filter-panel__title')!.textContent).toBe('Filter: Full Name');
    expect(root!.querySelector('.bg-filter-panel__operator')).not.toBeNull();
    expect(root!.querySelector('.bg-filter-panel__input')).not.toBeNull();
    expect(root!.querySelector('.bg-filter-panel__btn--apply')).not.toBeNull();
    expect(root!.querySelector('.bg-filter-panel__btn--clear')).not.toBeNull();
  });

  it('offers text operators by default and numeric operators for currency columns', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };

    openAgainst([{ id: 'name' }], api, 'name');
    const textOps = Array.from(document.querySelectorAll('.bg-filter-panel__operator option')).map((o) => o.getAttribute('value'));
    expect(textOps).toContain('contains');
    expect(textOps).not.toContain('gt');

    document.body.innerHTML = '';
    openAgainst([{ id: 'total', cellType: 'currency' }], api, 'total');
    const numOps = Array.from(document.querySelectorAll('.bg-filter-panel__operator option')).map((o) => o.getAttribute('value'));
    expect(numOps).toContain('gt');
    expect(numOps).not.toContain('contains');
  });

  it('preselects operator and pre-fills input from currentFilter', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    openAgainst([{ id: 'name' }], api, 'name', { columnId: 'name', value: 'alice', operator: 'eq' });

    const select = document.querySelector('.bg-filter-panel__operator') as HTMLSelectElement;
    const input = document.querySelector('.bg-filter-panel__input') as HTMLInputElement;
    expect(select.value).toBe('eq');
    expect(input.value).toBe('alice');
  });

  it('Apply with a value calls setFilter(columnId, value, operator) and dismisses', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    const panel = openAgainst([{ id: 'name' }], api, 'name');

    const input = document.querySelector('.bg-filter-panel__input') as HTMLInputElement;
    const select = document.querySelector('.bg-filter-panel__operator') as HTMLSelectElement;
    input.value = 'alice';
    select.value = 'eq';
    (document.querySelector('.bg-filter-panel__btn--apply') as HTMLButtonElement).click();

    expect(api.setFilter).toHaveBeenCalledWith('name', 'alice', 'eq');
    expect(panel.isActive()).toBe(false);
  });

  it('Apply with an empty value calls removeFilter', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    openAgainst([{ id: 'name' }], api, 'name');

    (document.querySelector('.bg-filter-panel__btn--apply') as HTMLButtonElement).click();
    expect(api.removeFilter).toHaveBeenCalledWith('name');
    expect(api.setFilter).not.toHaveBeenCalled();
  });

  it('Clear button calls removeFilter and dismisses', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    const panel = openAgainst([{ id: 'name' }], api, 'name', { columnId: 'name', value: 'old', operator: 'contains' });

    (document.querySelector('.bg-filter-panel__btn--clear') as HTMLButtonElement).click();
    expect(api.removeFilter).toHaveBeenCalledWith('name');
    expect(panel.isActive()).toBe(false);
  });

  it('Enter in the input triggers apply', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    openAgainst([{ id: 'name' }], api, 'name');

    const input = document.querySelector('.bg-filter-panel__input') as HTMLInputElement;
    input.value = 'bob';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(api.setFilter).toHaveBeenCalledWith('name', 'bob', 'contains');
  });

  it('Escape on the input dismisses without applying', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    const panel = openAgainst([{ id: 'name' }], api, 'name');

    const input = document.querySelector('.bg-filter-panel__input') as HTMLInputElement;
    input.value = 'dont apply';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(api.setFilter).not.toHaveBeenCalled();
    expect(api.removeFilter).not.toHaveBeenCalled();
    expect(panel.isActive()).toBe(false);
  });

  it('show() replaces an already-open panel from the same instance', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    const columns = [
      { id: 'a', headerName: 'First' },
      { id: 'b', headerName: 'Second' },
    ];
    const panel = createFilterPanel({
      getColumns: () => columns,
      getFilterApi: () => api,
    });
    const anchor = document.createElement('div');
    anchor.className = 'bg-header-cell';
    document.body.appendChild(anchor);
    const makeEvent = () => {
      const ev = new MouseEvent('contextmenu', { clientX: 10, clientY: 10, bubbles: true });
      Object.defineProperty(ev, 'target', { value: anchor });
      return ev;
    };

    panel.show(makeEvent(), 'a');
    panel.show(makeEvent(), 'b');

    const titles = Array.from(document.querySelectorAll('.bg-filter-panel__title'));
    expect(titles).toHaveLength(1);
    expect(titles[0]!.textContent).toBe('Filter: Second');
    expect(panel.isActive()).toBe(true);
  });

  it('falls back to columnId when header is not a string', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    openAgainst([{ id: 'priceCol' }], api, 'priceCol');
    expect(document.querySelector('.bg-filter-panel__title')!.textContent).toBe('Filter: priceCol');
  });

  it('dismiss() removes the panel and resets isActive', () => {
    const api: FilterApi = { setFilter: vi.fn(), removeFilter: vi.fn() };
    const panel = openAgainst([{ id: 'name' }], api, 'name');
    expect(panel.isActive()).toBe(true);

    panel.dismiss();
    expect(panel.isActive()).toBe(false);
    expect(document.querySelector('.bg-filter-panel')).toBeNull();
  });
});
