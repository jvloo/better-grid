// ============================================================================
// Editing Plugin — Cell editing with text input & dropdown support
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition } from '@better-grid/core';

export interface EditingOptions {
  /** How to trigger edit mode. Default: 'dblclick' */
  editTrigger?: 'click' | 'dblclick' | 'type';
  /** When to commit edits. Default: ['enter', 'tab'] */
  commitOn?: ('enter' | 'tab')[];
  /** Cancel on Escape. Default: true */
  cancelOnEscape?: boolean;
  /** Custom labels for boolean dropdown. Default: ['Yes', 'No'] */
  booleanLabels?: [string, string];
}

/** Dropdown option for columns with meta.options */
export interface DropdownOption {
  label: string;
  value: unknown;
}

export interface EditingApi {
  startEdit(position: CellPosition, initialValue?: string): void;
  commitEdit(): boolean;
  cancelEdit(): void;
  isEditing(): boolean;
  getEditingCell(): CellPosition | null;
}

const INPUT_CSS = `
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  background: var(--bg-edit-bg, #fff);
  box-sizing: border-box;
`;

const SELECT_CSS = `
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  padding: 0 18px 0 12px;
  margin: 0;
  font: inherit;
  color: var(--bg-text-color, #1a1a1a);
  background: var(--bg-edit-bg, #fff);
  box-sizing: border-box;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23999'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
`;

export function editing(options?: EditingOptions): GridPlugin<'editing'> {
  const config = {
    editTrigger: options?.editTrigger ?? 'dblclick',
    commitOn: options?.commitOn ?? ['enter', 'tab'],
    cancelOnEscape: options?.cancelOnEscape ?? true,
    booleanLabels: options?.booleanLabels ?? (['Yes', 'No'] as [string, string]),
  };

  return {
    id: 'editing',

    init(ctx: PluginContext) {
      let editingCell: CellPosition | null = null;
      let activeEditor: HTMLInputElement | HTMLSelectElement | null = null;
      let originalValue: unknown = null;

      function getCellElement(pos: CellPosition): HTMLElement | null {
        const selector = `.bg-cell[data-row="${pos.rowIndex}"][data-col="${pos.colIndex}"]`;
        return document.querySelector(selector);
      }

      // -----------------------------------------------------------------------
      // Determine editor type
      // -----------------------------------------------------------------------

      function getDropdownOptions(
        column: { cellType?: string; meta?: Record<string, unknown> },
        value: unknown,
      ): DropdownOption[] | null {
        // meta.editor: 'text' forces text input, skips all dropdown logic
        if (column.meta?.editor === 'text') return null;

        // Explicit options in column meta → always dropdown
        const metaOpts = column.meta?.options;
        if (Array.isArray(metaOpts) && metaOpts.length > 0) {
          return metaOpts.map((opt) =>
            typeof opt === 'object' && opt !== null && 'label' in opt
              ? (opt as DropdownOption)
              : { label: String(opt), value: opt },
          );
        }

        // meta.editor: 'dropdown' forces dropdown even without options
        // (useful with boolean values where you want explicit control)
        if (column.meta?.editor === 'dropdown' && typeof value === 'boolean') {
          return [
            { label: config.booleanLabels[0], value: true },
            { label: config.booleanLabels[1], value: false },
          ];
        }

        // Auto-detect: boolean → Yes/No dropdown (unless editor is 'text')
        if (typeof value === 'boolean') {
          return [
            { label: config.booleanLabels[0], value: true },
            { label: config.booleanLabels[1], value: false },
          ];
        }

        // select/toggle cell types
        if (column.cellType === 'select' || column.cellType === 'toggle') {
          if (typeof value === 'boolean') {
            return [
              { label: config.booleanLabels[0], value: true },
              { label: config.booleanLabels[1], value: false },
            ];
          }
        }

        return null;
      }

      // -----------------------------------------------------------------------
      // Start editing
      // -----------------------------------------------------------------------

      function startEdit(position: CellPosition, initialValue?: string): void {
        if (editingCell) commitEdit();

        const cellEl = getCellElement(position);
        if (!cellEl) return;

        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        if (!column) return;
        if (column.meta?.editable === false) return;

        editingCell = position;

        // Get current raw value
        const data = state.data[position.rowIndex];
        if (column.accessorKey && data) {
          originalValue = (data as Record<string, unknown>)[column.accessorKey];
        } else {
          originalValue = cellEl.textContent;
        }

        // Check if this should be a dropdown
        const dropdownOpts = getDropdownOptions(column, originalValue);

        // Prepare cell for editing
        cellEl.textContent = '';
        cellEl.classList.add('bg-cell--editing');

        if (dropdownOpts) {
          // Dropdown: keep cell padding so text aligns with non-editing cells
          cellEl.style.padding = '0';
          activeEditor = createDropdown(cellEl, dropdownOpts, originalValue);
        } else {
          // Text input: reduce cell padding, input has its own
          cellEl.style.padding = '0 4px';
          const editValue = initialValue ?? (originalValue != null ? String(originalValue) : '');
          activeEditor = createTextInput(cellEl, editValue, initialValue !== undefined);
        }
      }

      // -----------------------------------------------------------------------
      // Text input editor
      // -----------------------------------------------------------------------

      function createTextInput(
        cellEl: HTMLElement,
        value: string,
        cursorAtEnd: boolean,
      ): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor';
        input.value = value;
        input.style.cssText = INPUT_CSS;

        cellEl.appendChild(input);
        input.focus();

        if (cursorAtEnd) {
          input.setSelectionRange(value.length, value.length);
        } else {
          input.select();
        }

        input.addEventListener('keydown', handleEditorKeydown);
        input.addEventListener('blur', handleEditorBlur);
        return input;
      }

      // -----------------------------------------------------------------------
      // Dropdown editor
      // -----------------------------------------------------------------------

      function createDropdown(
        cellEl: HTMLElement,
        opts: DropdownOption[],
        currentValue: unknown,
      ): HTMLSelectElement {
        const select = document.createElement('select');
        select.className = 'bg-cell-editor bg-cell-editor--select';
        select.style.cssText = SELECT_CSS;

        for (const opt of opts) {
          const option = document.createElement('option');
          option.value = String(opt.value);
          option.textContent = opt.label;
          // Match by strict equality on value, or by string comparison
          if (opt.value === currentValue || String(opt.value) === String(currentValue)) {
            option.selected = true;
          }
          select.appendChild(option);
        }

        // Store options for value lookup on commit
        (select as HTMLSelectElement & { _options: DropdownOption[] })._options = opts;

        cellEl.appendChild(select);
        select.focus();

        // Commit on change (user picks a different option)
        select.addEventListener('change', () => {
          commitEdit();
        });
        select.addEventListener('keydown', handleEditorKeydown);
        select.addEventListener('blur', handleEditorBlur);

        return select;
      }

      // -----------------------------------------------------------------------
      // Commit / Cancel
      // -----------------------------------------------------------------------

      function commitEdit(): boolean {
        if (!editingCell || !activeEditor) return false;

        const position = editingCell;
        const prevValue = originalValue;
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];

        let parsedValue: unknown;

        if (activeEditor instanceof HTMLSelectElement) {
          // Dropdown: look up the actual value from the stored options
          const storedOpts = (activeEditor as HTMLSelectElement & { _options?: DropdownOption[] })._options;
          const selectedIdx = activeEditor.selectedIndex;
          if (storedOpts && selectedIdx >= 0) {
            parsedValue = storedOpts[selectedIdx]!.value;
          } else {
            parsedValue = activeEditor.value;
          }
        } else {
          // Text input: parse based on cell type
          const newValue = activeEditor.value;
          parsedValue = parseTextValue(newValue, column, prevValue);
        }

        // Update grid data BEFORE cleanup
        if (column?.accessorKey && parsedValue !== prevValue) {
          ctx.grid.updateCell(position.rowIndex, column.id, parsedValue);
        }

        cleanupEdit();
        return true;
      }

      function parseTextValue(
        newValue: string,
        column: { cellType?: string } | undefined,
        prevValue: unknown,
      ): unknown {
        if (!column) return newValue;

        const cellType = column.cellType;
        if (cellType === 'number' || cellType === 'currency') {
          const num = Number(newValue.replace(/[^0-9.\-]/g, ''));
          return isNaN(num) ? prevValue : num;
        }
        if (cellType === 'percent') {
          const num = Number(newValue.replace(/[^0-9.\-]/g, ''));
          return isNaN(num) ? prevValue : num / 100;
        }
        if (typeof prevValue === 'boolean') {
          const lower = newValue.toLowerCase().trim();
          if (['yes', 'y', 'true', '1'].includes(lower)) return true;
          if (['no', 'n', 'false', '0'].includes(lower)) return false;
          return prevValue;
        }
        if (typeof prevValue === 'number') {
          const num = Number(newValue);
          return isNaN(num) ? prevValue : num;
        }
        return newValue;
      }

      function cancelEdit(): void {
        cleanupEdit();
      }

      function cleanupEdit(): void {
        if (activeEditor) {
          activeEditor.removeEventListener('keydown', handleEditorKeydown);
          activeEditor.removeEventListener('blur', handleEditorBlur);
          if (activeEditor instanceof HTMLSelectElement) {
            activeEditor.removeEventListener('change', () => commitEdit());
          }
        }

        if (editingCell) {
          const cellEl = getCellElement(editingCell);
          if (cellEl) {
            cellEl.classList.remove('bg-cell--editing');
            cellEl.style.padding = '';
          }
        }

        activeEditor = null;
        editingCell = null;
        originalValue = null;

        ctx.grid.refresh();
      }

      // -----------------------------------------------------------------------
      // Event handlers
      // -----------------------------------------------------------------------

      function handleEditorKeydown(e: KeyboardEvent): void {
        e.stopPropagation();

        if (e.key === 'Enter' && config.commitOn.includes('enter')) {
          e.preventDefault();
          const pos = editingCell;
          commitEdit();
          if (pos) {
            const state = ctx.grid.getState();
            const nextRow = Math.min(pos.rowIndex + 1, state.data.length - 1);
            ctx.grid.setSelection({
              active: { rowIndex: nextRow, colIndex: pos.colIndex },
              ranges: [{ startRow: nextRow, endRow: nextRow, startCol: pos.colIndex, endCol: pos.colIndex }],
            });
          }
        } else if (e.key === 'Tab' && config.commitOn.includes('tab')) {
          e.preventDefault();
          const pos = editingCell;
          commitEdit();
          if (pos) {
            const state = ctx.grid.getState();
            const nextCol = e.shiftKey
              ? Math.max(pos.colIndex - 1, 0)
              : Math.min(pos.colIndex + 1, state.columns.length - 1);
            ctx.grid.setSelection({
              active: { rowIndex: pos.rowIndex, colIndex: nextCol },
              ranges: [{ startRow: pos.rowIndex, endRow: pos.rowIndex, startCol: nextCol, endCol: nextCol }],
            });
          }
        } else if (e.key === 'Escape' && config.cancelOnEscape) {
          e.preventDefault();
          cancelEdit();
        }
      }

      function handleEditorBlur(): void {
        setTimeout(() => {
          if (editingCell) commitEdit();
        }, 100);
      }

      // -----------------------------------------------------------------------
      // API & bindings
      // -----------------------------------------------------------------------

      const api: EditingApi = {
        startEdit,
        commitEdit,
        cancelEdit,
        isEditing: () => editingCell !== null,
        getEditingCell: () => editingCell,
      };

      // Register triggers
      if (config.editTrigger === 'dblclick') {
        ctx.on('cell:dblclick', (cell) => startEdit(cell));
      } else if (config.editTrigger === 'click') {
        ctx.on('cell:click', (cell) => startEdit(cell));
      }

      const unbindEnter = ctx.registerKeyBinding({
        key: 'Enter',
        priority: 10,
        handler: (_event, cell) => {
          if (editingCell) return false; // let the editor's own keydown handle it
          if (cell) { startEdit(cell); return true; }
          return false;
        },
      });

      const unbindEscape = config.cancelOnEscape
        ? ctx.registerKeyBinding({
            key: 'Escape',
            priority: 10,
            handler: () => {
              if (editingCell) { cancelEdit(); return true; }
              return false;
            },
          })
        : undefined;

      const unbindType = config.editTrigger === 'type'
        ? ctx.registerKeyBinding({
            key: '*',
            priority: -1,
            handler: (event, cell) => {
              if (editingCell || !cell) return false;
              if (event.key.length !== 1) return false;
              if (event.ctrlKey || event.altKey || event.metaKey) return false;
              startEdit(cell, event.key);
              return true;
            },
          })
        : undefined;

      ctx.expose(api);

      return () => {
        unbindEnter();
        unbindEscape?.();
        unbindType?.();
        if (editingCell) cancelEdit();
      };
    },
  };
}
