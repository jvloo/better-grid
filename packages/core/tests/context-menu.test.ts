import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContextMenu } from '../src/ui/context-menu';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

function mouseEventAt(type: string, clientX: number, clientY: number, target?: HTMLElement): MouseEvent {
  const ev = new MouseEvent(type, { clientX, clientY, bubbles: true });
  if (target) Object.defineProperty(ev, 'target', { value: target });
  return ev;
}

describe('createContextMenu', () => {
  it('renders a menu item per label', () => {
    const menu = createContextMenu();
    menu.show(mouseEventAt('contextmenu', 10, 10, document.body), [
      { label: 'Sort', action: () => {} },
      { label: 'Filter', action: () => {} },
    ]);

    const items = document.querySelectorAll('.bg-context-menu__item');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toBe('Sort');
    expect(items[1]!.textContent).toBe('Filter');
  });

  it('renders "─" as a separator, not as a clickable item', () => {
    const menu = createContextMenu();
    menu.show(mouseEventAt('contextmenu', 10, 10, document.body), [
      { label: 'A', action: () => {} },
      { label: '─', action: () => {} },
      { label: 'B', action: () => {} },
    ]);

    expect(document.querySelectorAll('.bg-context-menu__item')).toHaveLength(2);
  });

  it('marks active items with the active class', () => {
    const menu = createContextMenu();
    menu.show(mouseEventAt('contextmenu', 0, 0, document.body), [
      { label: 'Asc', action: () => {}, active: true },
      { label: 'Desc', action: () => {} },
    ]);

    const items = document.querySelectorAll('.bg-context-menu__item');
    expect(items[0]!.classList.contains('bg-context-menu__item--active')).toBe(true);
    expect(items[1]!.classList.contains('bg-context-menu__item--active')).toBe(false);
  });

  it('renders nothing when items is empty', () => {
    const menu = createContextMenu();
    menu.show(mouseEventAt('contextmenu', 0, 0, document.body), []);
    expect(document.querySelectorAll('.bg-context-menu').length).toBe(0);
    expect(menu.isActive()).toBe(false);
  });

  it('fires action and dismisses on click', () => {
    const menu = createContextMenu();
    const action = vi.fn();
    menu.show(mouseEventAt('contextmenu', 0, 0, document.body), [
      { label: 'Go', action },
    ]);

    const item = document.querySelector('.bg-context-menu__item') as HTMLElement;
    item.click();

    expect(action).toHaveBeenCalledTimes(1);
    expect(menu.isActive()).toBe(false);
  });

  it('dismiss() removes the DOM and resets active state', () => {
    const menu = createContextMenu();
    menu.show(mouseEventAt('contextmenu', 0, 0, document.body), [
      { label: 'X', action: () => {} },
    ]);
    expect(menu.isActive()).toBe(true);

    menu.dismiss();
    expect(menu.isActive()).toBe(false);
    expect(document.querySelector('.bg-context-menu')).toBeNull();
  });

  it('show() replaces an already-open menu', () => {
    const menu = createContextMenu();
    menu.show(mouseEventAt('contextmenu', 0, 0, document.body), [{ label: 'First', action: () => {} }]);
    menu.show(mouseEventAt('contextmenu', 0, 0, document.body), [{ label: 'Second', action: () => {} }]);

    const items = document.querySelectorAll('.bg-context-menu__item');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toBe('Second');
  });

  it('dismisses on outside mousedown', () => {
    const menu = createContextMenu();
    menu.show(mouseEventAt('contextmenu', 0, 0, document.body), [
      { label: 'X', action: () => {} },
    ]);
    // The outside-click listener is attached via setTimeout(0)
    vi.advanceTimersByTime(0);

    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(menu.isActive()).toBe(false);
  });
});
