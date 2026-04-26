/**
 * Accessibility integration test for the rowActions plugin.
 *
 * Verifies that the trigger is a real <button> with aria-haspopup/aria-expanded/aria-label,
 * the menu container has role="menu", each item is a <button role="menuitem"> with the
 * correct text label, and keyboard navigation (ArrowDown + Enter) fires the right action.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid } from '../src/grid';
import { rowActions } from '../../pro/src/row-actions';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  name: string;
}

const data: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { cb(0); return 0; }) as typeof requestAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
  return host;
}

const columns: ColumnDef<Row>[] = [
  { id: 'name', field: 'name', headerName: 'Name', width: 200 },
  { id: 'actions', field: 'id', headerName: 'Actions', width: 80 },
];

describe('rowActions — accessibility', () => {
  it('trigger is a <button> with aria-haspopup="menu" and aria-label', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [
        rowActions({
          column: 'actions',
          getActions: () => [
            { id: 'edit', label: 'Edit' },
            { id: 'delete', label: 'Delete' },
          ],
          onAction: () => { /* noop */ },
        }),
      ],
    });

    grid.mount(host);
    grid.refresh();

    const trigger = host.querySelector('.bg-row-actions-trigger') as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger!.tagName.toLowerCase()).toBe('button');
    expect(trigger!.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger!.getAttribute('aria-label')).toBeTruthy();

    grid.unmount();
  });

  it('trigger aria-label uses getTriggerLabel when provided', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [
        rowActions({
          column: 'actions',
          getActions: () => [{ id: 'edit', label: 'Edit' }],
          onAction: () => { /* noop */ },
          getTriggerLabel: (row) => `Actions for ${(row as Row).name}`,
        }),
      ],
    });

    grid.mount(host);
    grid.refresh();

    const trigger = host.querySelector('.bg-row-actions-trigger') as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute('aria-label')).toBe('Actions for Alice');

    grid.unmount();
  });

  it('trigger aria-expanded is "false" before menu opens and "true" after', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [
        rowActions({
          column: 'actions',
          getActions: () => [
            { id: 'edit', label: 'Edit' },
            { id: 'delete', label: 'Delete' },
          ],
          onAction: () => { /* noop */ },
        }),
      ],
    });

    grid.mount(host);
    grid.refresh();

    const trigger = host.querySelector('.bg-row-actions-trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    // Menu should now exist in the document with role="menu"
    const menu = document.body.querySelector('.bg-row-actions-menu') as HTMLElement | null;
    expect(menu).not.toBeNull();
    expect(menu!.getAttribute('role')).toBe('menu');

    grid.unmount();
  });

  it('menu items are <button role="menuitem"> with the correct label text', () => {
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [
        rowActions({
          column: 'actions',
          getActions: () => [
            { id: 'edit', label: 'Edit' },
            { id: 'delete', label: 'Delete' },
          ],
          onAction: () => { /* noop */ },
        }),
      ],
    });

    grid.mount(host);
    grid.refresh();

    const trigger = host.querySelector('.bg-row-actions-trigger') as HTMLButtonElement;
    trigger.click();

    const items = document.body.querySelectorAll('.bg-row-actions-menu-item');
    expect(items.length).toBe(2);

    const first = items[0] as HTMLButtonElement;
    const second = items[1] as HTMLButtonElement;

    expect(first.tagName.toLowerCase()).toBe('button');
    expect(first.getAttribute('role')).toBe('menuitem');
    expect(first.textContent).toContain('Edit');

    expect(second.tagName.toLowerCase()).toBe('button');
    expect(second.getAttribute('role')).toBe('menuitem');
    expect(second.textContent).toContain('Delete');

    grid.unmount();
  });

  it('ArrowDown then Enter fires the second action onClick', () => {
    const onAction = vi.fn();
    const host = makeHost();
    const grid = createGrid<Row>({
      columns,
      data,
      plugins: [
        rowActions({
          column: 'actions',
          getActions: () => [
            { id: 'edit', label: 'Edit' },
            { id: 'delete', label: 'Delete' },
          ],
          onAction,
        }),
      ],
    });

    grid.mount(host);
    grid.refresh();

    const trigger = host.querySelector('.bg-row-actions-trigger') as HTMLButtonElement;
    trigger.click();

    const menu = document.body.querySelector('.bg-row-actions-menu') as HTMLElement;
    expect(menu).not.toBeNull();

    // Dispatch ArrowDown to move from first item to second
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // Dispatch Enter to confirm
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onAction).toHaveBeenCalledTimes(1);
    // The second action (delete) should have been invoked
    expect(onAction).toHaveBeenCalledWith('delete', expect.anything(), expect.any(Number));

    grid.unmount();
  });
});
