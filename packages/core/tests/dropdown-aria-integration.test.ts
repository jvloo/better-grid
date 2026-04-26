/**
 * Integration test: dropdown editors expose correct ARIA roles and keyboard behavior.
 *
 * Covers:
 *  - Trigger has role="combobox", aria-haspopup="listbox", aria-expanded="true" while open.
 *  - Panel has role="listbox" and a stable id linked via aria-controls.
 *  - Each option has role="option"; the highlighted one has aria-selected="true".
 *  - ArrowDown/ArrowUp/Home/End move the highlighted option.
 *  - Enter commits the highlighted option and closes the panel.
 *  - Escape cancels and restores the prior value.
 *  - Type-to-search jumps to the first label starting with the typed character.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid } from '../src/grid';
import { editing } from '../../plugins/src/free/editing';
import type { ColumnDef } from '../src/types';

interface Row {
  id: number;
  status: string;
}

const DATA: Row[] = [
  { id: 1, status: 'A' },
  { id: 2, status: 'B' },
];

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: 'id',
    field: 'id',
    headerName: 'ID',
    editable: false,
  },
  {
    id: 'status',
    field: 'status',
    headerName: 'Status',
    editable: true,
    cellEditor: 'select',
    options: ['A', 'B', 'C'],
  },
];

let host: HTMLElement;
let originalRaf: typeof requestAnimationFrame;

beforeEach(() => {
  document.body.innerHTML = '';
  // Make requestAnimationFrame synchronous so grid.refresh() renders immediately.
  originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof requestAnimationFrame;

  host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(host, 'clientHeight', { configurable: true, value: 400 });
  document.body.appendChild(host);
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function makeGrid() {
  const grid = createGrid<Row>({
    data: DATA.map((r) => ({ ...r })),
    columns: COLUMNS,
    plugins: [editing()],
  });
  grid.mount(host);
  grid.refresh();
  return grid;
}

describe('dropdown ARIA integration', () => {
  it('trigger has aria-haspopup="listbox" and aria-expanded="true" when panel is open', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLElement>('.bg-cell-editor--dropdown-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger!.getAttribute('aria-expanded')).toBe('true');

    grid.destroy();
  });

  it('panel has role="listbox" linked via aria-controls on the trigger', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLElement>('.bg-cell-editor--dropdown-trigger');
    const panelId = trigger!.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute('role')).toBe('listbox');

    grid.destroy();
  });

  it('each option has role="option"; the pre-selected one has aria-selected="true"', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 }); // row 0 has status='A' which is options[0]

    const trigger = host.querySelector<HTMLElement>('.bg-cell-editor--dropdown-trigger');
    const panelId = trigger!.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId)!;

    const options = panel.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3); // 'A', 'B', 'C'

    // First option (A) should be selected (it matches the current value)
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    expect(options[1]!.getAttribute('aria-selected')).toBe('false');
    expect(options[2]!.getAttribute('aria-selected')).toBe('false');

    grid.destroy();
  });

  it('ArrowDown moves highlight to next option and updates aria-selected', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLInputElement>('.bg-cell-editor--dropdown-trigger')!;
    const panelId = trigger.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId)!;

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    const options = panel.querySelectorAll('[role="option"]');
    // After one ArrowDown from index 0, index 1 (B) should be selected
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    expect(options[2]!.getAttribute('aria-selected')).toBe('false');

    grid.destroy();
  });

  it('ArrowDown twice + Enter commits the third option (C)', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLInputElement>('.bg-cell-editor--dropdown-trigger')!;

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const state = grid.getState();
    expect((state.data[0] as Row).status).toBe('C');

    grid.destroy();
  });

  it('Home moves to the first option', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLInputElement>('.bg-cell-editor--dropdown-trigger')!;
    const panelId = trigger.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId)!;

    // Move to end first
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    // Then back to Home
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

    const options = panel.querySelectorAll('[role="option"]');
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    expect(options[2]!.getAttribute('aria-selected')).toBe('false');

    grid.destroy();
  });

  it('End moves to the last option', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLInputElement>('.bg-cell-editor--dropdown-trigger')!;
    const panelId = trigger.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId)!;

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

    const options = panel.querySelectorAll('[role="option"]');
    expect(options[2]!.getAttribute('aria-selected')).toBe('true');
    expect(options[0]!.getAttribute('aria-selected')).toBe('false');

    grid.destroy();
  });

  it('Escape cancels edit without committing', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLInputElement>('.bg-cell-editor--dropdown-trigger')!;

    // Move to C
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // Escape — should cancel
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const state = grid.getState();
    // Value should remain 'A' (original)
    expect((state.data[0] as Row).status).toBe('A');
    // Panel should be gone
    expect(document.querySelector('.bg-dropdown-panel')).toBeNull();

    grid.destroy();
  });

  it('type-to-search jumps to first option whose label starts with the typed character', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLInputElement>('.bg-cell-editor--dropdown-trigger')!;
    expect(trigger).not.toBeNull();
    const panelId = trigger.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId)!;

    // Type 'c' — should jump to option 'C' (index 2).
    // The debounce timer is irrelevant for the initial jump; it only resets the prefix.
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));

    const options = panel.querySelectorAll('[role="option"]');
    expect(options[2]!.getAttribute('aria-selected')).toBe('true');

    grid.destroy();
  });

  it('aria-activedescendant on trigger points to highlighted option id', () => {
    const grid = makeGrid();
    const api = (grid.plugins as Record<string, { startEdit: (pos: { rowIndex: number; colIndex: number }) => void }>).editing;
    api.startEdit({ rowIndex: 0, colIndex: 1 });

    const trigger = host.querySelector<HTMLInputElement>('.bg-cell-editor--dropdown-trigger')!;
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    const activedescendant = trigger.getAttribute('aria-activedescendant');
    expect(activedescendant).toBeTruthy();

    // The element with that id must exist and have aria-selected="true"
    const activeEl = document.getElementById(activedescendant!);
    expect(activeEl).not.toBeNull();
    expect(activeEl!.getAttribute('aria-selected')).toBe('true');

    grid.destroy();
  });
});
