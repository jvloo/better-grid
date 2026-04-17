import { describe, it, expect } from 'vitest';
import { EventEmitter } from '../src/events/emitter';

interface TestEvents {
  [key: string]: (...args: unknown[]) => void;
  ping: () => void;
  pong: () => void;
}

type EmitterInternals = { listeners: Map<keyof TestEvents, Set<(...args: unknown[]) => void>> };

describe('EventEmitter listener-set pruning', () => {
  it('removes the Set from the listeners Map when the last handler unsubscribes (via returned fn)', () => {
    const emitter = new EventEmitter<TestEvents>();
    const internals = emitter as unknown as EmitterInternals;

    const off = emitter.on('ping', () => undefined);
    expect(internals.listeners.has('ping')).toBe(true);

    off();
    expect(internals.listeners.has('ping')).toBe(false);
  });

  it('removes the Set from the listeners Map when the last handler unsubscribes (via off)', () => {
    const emitter = new EventEmitter<TestEvents>();
    const internals = emitter as unknown as EmitterInternals;
    const handler = () => undefined;

    emitter.on('ping', handler);
    expect(internals.listeners.has('ping')).toBe(true);

    emitter.off('ping', handler);
    expect(internals.listeners.has('ping')).toBe(false);
  });

  it('keeps the Set when only one of multiple handlers unsubscribes', () => {
    const emitter = new EventEmitter<TestEvents>();
    const internals = emitter as unknown as EmitterInternals;
    const h1 = () => undefined;
    const h2 = () => undefined;

    const off1 = emitter.on('ping', h1);
    emitter.on('ping', h2);

    off1();
    expect(internals.listeners.has('ping')).toBe(true);
    expect(internals.listeners.get('ping')?.size).toBe(1);
  });

  it('does not throw when off is called for an unknown event', () => {
    const emitter = new EventEmitter<TestEvents>();
    expect(() => emitter.off('ping', () => undefined)).not.toThrow();
  });
});
