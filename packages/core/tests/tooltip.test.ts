import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTooltip } from '../src/ui/tooltip';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createTooltip', () => {
  it('does not create DOM before the delay elapses', () => {
    const tooltip = createTooltip({ delay: 500 });
    const target = document.createElement('div');
    document.body.appendChild(target);

    tooltip.show(target, 'hello');
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.bg-tooltip')).toBeNull();
  });

  it('creates DOM with the given text after the delay', () => {
    const tooltip = createTooltip({ delay: 500 });
    const target = document.createElement('div');
    document.body.appendChild(target);

    tooltip.show(target, 'clipped text');
    vi.advanceTimersByTime(500);

    const el = document.querySelector('.bg-tooltip');
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('clipped text');
  });

  it('dismiss() cancels a pending show', () => {
    const tooltip = createTooltip({ delay: 500 });
    const target = document.createElement('div');
    document.body.appendChild(target);

    tooltip.show(target, 'never shown');
    tooltip.dismiss();
    vi.advanceTimersByTime(1000);

    expect(document.querySelector('.bg-tooltip')).toBeNull();
  });

  it('dismiss() removes a visible tooltip', () => {
    const tooltip = createTooltip({ delay: 0 });
    const target = document.createElement('div');
    document.body.appendChild(target);

    tooltip.show(target, 'visible');
    vi.advanceTimersByTime(0);
    expect(document.querySelector('.bg-tooltip')).not.toBeNull();

    tooltip.dismiss();
    expect(document.querySelector('.bg-tooltip')).toBeNull();
  });

  it('show() while a previous tooltip is visible replaces it', () => {
    const tooltip = createTooltip({ delay: 0 });
    const target = document.createElement('div');
    document.body.appendChild(target);

    tooltip.show(target, 'first');
    vi.advanceTimersByTime(0);
    tooltip.show(target, 'second');
    vi.advanceTimersByTime(0);

    const els = document.querySelectorAll('.bg-tooltip');
    expect(els).toHaveLength(1);
    expect(els[0]!.textContent).toBe('second');
  });

  it('positions tooltip at cursor coordinates when provided', () => {
    const tooltip = createTooltip({ delay: 0 });
    const target = document.createElement('div');
    document.body.appendChild(target);

    tooltip.show(target, 'cursor-positioned', 250, 100);
    vi.advanceTimersByTime(0);

    const el = document.querySelector('.bg-tooltip') as HTMLElement;
    expect(el.style.left).toBe('250px');
    expect(el.style.top).toBe('112px'); // 100 + 12
  });

  it('uses default 500ms delay when no options passed', () => {
    const tooltip = createTooltip();
    const target = document.createElement('div');
    document.body.appendChild(target);

    tooltip.show(target, 'default delay');
    vi.advanceTimersByTime(499);
    expect(document.querySelector('.bg-tooltip')).toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector('.bg-tooltip')).not.toBeNull();
  });
});
