import { describe, it, expect } from 'vitest';
import { StateStore } from '../src/state/store';
import type { GridState } from '../src/types';

type StoreInternals = { listeners: Map<string, Set<() => void>> };

function makeState(): GridState<unknown> {
  return {
    data: [],
    columns: [],
    columnWidths: [],
    rowHeights: [],
    scrollTop: 0,
    scrollLeft: 0,
    visibleRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
    selection: { ranges: [], active: null },
    frozenTopRows: 0,
    frozenLeftColumns: 0,
    pinnedTopRows: [],
    pinnedBottomRows: [],
    hierarchyState: null,
    pluginState: {},
  };
}

describe('StateStore listener-set pruning', () => {
  it('removes the Set from the listeners Map when the last subscriber unsubscribes', () => {
    const store = new StateStore(makeState());
    const internals = store as unknown as StoreInternals;

    const unsubscribe = store.subscribe('data', () => undefined);
    expect(internals.listeners.has('data')).toBe(true);

    unsubscribe();
    expect(internals.listeners.has('data')).toBe(false);
  });

  it('keeps the Set when only one of multiple subscribers unsubscribes', () => {
    const store = new StateStore(makeState());
    const internals = store as unknown as StoreInternals;

    const off1 = store.subscribe('data', () => undefined);
    store.subscribe('data', () => undefined);

    off1();
    expect(internals.listeners.has('data')).toBe(true);
    expect(internals.listeners.get('data')?.size).toBe(1);
  });

  it('unsubscribing twice is a no-op and does not throw', () => {
    const store = new StateStore(makeState());
    const internals = store as unknown as StoreInternals;

    const off = store.subscribe('data', () => undefined);
    off();
    expect(() => off()).not.toThrow();
    expect(internals.listeners.has('data')).toBe(false);
  });
});
