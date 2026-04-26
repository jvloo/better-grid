// ============================================================================
// Reactive State Store with Batching
// ============================================================================

import type { GridState } from '../types';

export class StateStore<TData = unknown> {
  private state: GridState<TData>;
  private listeners = new Map<string, Set<() => void>>();
  private batchDepth = 0;
  private pendingNotifications = new Set<string>();

  constructor(initialState: GridState<TData>) {
    this.state = initialState;
  }

  getState(): GridState<TData> {
    return this.state;
  }

  /** Subscribe to a specific state slice (e.g., 'data', 'selection', 'scroll'). Use '*' for all. */
  subscribe(key: string, callback: () => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    return () => {
      const set = this.listeners.get(key);
      if (!set) return;
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  /** Update a state slice and notify subscribers */
  update(key: string, updater: (state: GridState<TData>) => Partial<GridState<TData>>): void {
    const patch = updater(this.state);
    // Skip notification if every patched key is reference-equal to current state
    const p = patch as Record<string, unknown>;
    const s = this.state as unknown as Record<string, unknown>;
    let changed = false;
    for (const k in p) {
      if (p[k] !== s[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };

    if (this.batchDepth > 0) {
      this.pendingNotifications.add(key);
    } else {
      this.notify(key);
    }
  }

  /** Batch multiple updates into a single notification cycle */
  batch(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0) {
        const keys = new Set(this.pendingNotifications);
        this.pendingNotifications.clear();
        for (const key of keys) {
          this.notify(key);
        }
      }
    }
  }

  // --- Convenience methods ---

  setData(data: TData[]): void {
    this.update('data', () => ({ data }));
  }

  setCellValue(rowIndex: number, columnId: string, value: unknown): void {
    const newData = [...this.state.data];
    const colIndex = this.state.columns.findIndex((c) => c.id === columnId);
    if (colIndex === -1) return;

    const column = this.state.columns[colIndex];
    if (column?.field) {
      newData[rowIndex] = { ...newData[rowIndex], [column.field]: value } as TData;
    }
    this.update('data', () => ({ data: newData }));
  }

  setSelection(selection: GridState<TData>['selection']): void {
    this.update('selection', () => ({ selection }));
  }

  setColumnWidth(colIndex: number, width: number): void {
    const columnWidths = [...this.state.columnWidths];
    columnWidths[colIndex] = width;
    this.update('columns', () => ({ columnWidths }));
  }

  setScroll(scrollTop: number, scrollLeft: number): void {
    // Skip touchpad jitter / no-op scrolls — both axes unchanged
    if (this.state.scrollTop === scrollTop && this.state.scrollLeft === scrollLeft) return;
    // Mutate in place — scroll is the hottest path, avoid object spread
    this.state.scrollTop = scrollTop;
    this.state.scrollLeft = scrollLeft;
    if (this.batchDepth > 0) {
      this.pendingNotifications.add('scroll');
    } else {
      this.notify('scroll');
    }
  }

  private notify(key: string): void {
    this.listeners.get(key)?.forEach((cb) => cb());
    this.listeners.get('*')?.forEach((cb) => cb());
  }
}
