// ============================================================================
// Editing Plugin — Cell editing with type-to-edit, dblclick, commit/cancel
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition } from '@better-grid/core';

export interface EditingOptions {
  /** How to trigger edit mode. Default: 'dblclick' */
  editTrigger?: 'click' | 'dblclick' | 'type';
  /** When to commit edits. Default: ['enter', 'tab'] */
  commitOn?: ('enter' | 'tab')[];
  /** Cancel on Escape. Default: true */
  cancelOnEscape?: boolean;
}

export interface EditingApi {
  startEdit(position: CellPosition, initialValue?: string): void;
  commitEdit(): boolean;
  cancelEdit(): void;
  isEditing(): boolean;
  getEditingCell(): CellPosition | null;
}

export function editing(options?: EditingOptions): GridPlugin<'editing'> {
  const config = {
    editTrigger: options?.editTrigger ?? 'dblclick',
    commitOn: options?.commitOn ?? ['enter', 'tab'],
    cancelOnEscape: options?.cancelOnEscape ?? true,
  };

  return {
    id: 'editing',

    init(ctx: PluginContext) {
      let editingCell: CellPosition | null = null;
      let editInput: HTMLInputElement | null = null;
      let originalValue: unknown = null;

      function getCellElement(pos: CellPosition): HTMLElement | null {
        // Search in both main and frozen containers
        const selectors = `.bg-cell[data-row="${pos.rowIndex}"][data-col="${pos.colIndex}"]`;
        return document.querySelector(selectors);
      }

      function startEdit(position: CellPosition, initialValue?: string): void {
        // Commit any active edit first
        if (editingCell) commitEdit();

        const cellEl = getCellElement(position);
        if (!cellEl) return;

        // Check if column is editable
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        if (!column) return;
        if (column.meta?.editable === false) return;

        editingCell = position;

        // Get current value
        const data = state.data[position.rowIndex];
        if (column.accessorKey && data) {
          originalValue = (data as Record<string, unknown>)[column.accessorKey];
        } else {
          originalValue = cellEl.textContent;
        }

        // Create input element
        editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'bg-cell-editor';
        editInput.value = initialValue ?? (originalValue != null ? String(originalValue) : '');
        editInput.style.cssText = `
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

        // Replace cell content with input
        cellEl.textContent = '';
        cellEl.classList.add('bg-cell--editing');
        cellEl.style.padding = '0 4px';
        cellEl.appendChild(editInput);

        // Focus and select
        editInput.focus();
        if (initialValue !== undefined) {
          // Type-to-edit: cursor at end
          editInput.setSelectionRange(initialValue.length, initialValue.length);
        } else {
          editInput.select();
        }

        // Input event handlers
        editInput.addEventListener('keydown', handleInputKeydown);
        editInput.addEventListener('blur', handleInputBlur);
      }

      function commitEdit(): boolean {
        if (!editingCell || !editInput) return false;

        const newValue = editInput.value;
        const position = editingCell;
        const prevValue = originalValue;

        // Parse the value based on cell type
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        let parsedValue: unknown = newValue;

        if (column) {
          const cellType = column.cellType;
          if (cellType === 'number' || cellType === 'currency') {
            const num = Number(newValue.replace(/[^0-9.\-]/g, ''));
            parsedValue = isNaN(num) ? prevValue : num;
          } else if (cellType === 'percent') {
            const num = Number(newValue.replace(/[^0-9.\-]/g, ''));
            parsedValue = isNaN(num) ? prevValue : num / 100;
          }
        }

        // Update grid data BEFORE cleanup — cleanup triggers re-render
        // which needs to show the new value
        if (column?.accessorKey && parsedValue !== prevValue) {
          ctx.grid.updateCell(position.rowIndex, column.id, parsedValue);
        }

        // Clean up the input (re-render will show updated formatted value)
        cleanupEdit();

        return true;
      }

      function cancelEdit(): void {
        cleanupEdit();
      }

      function cleanupEdit(): void {
        if (editInput) {
          editInput.removeEventListener('keydown', handleInputKeydown);
          editInput.removeEventListener('blur', handleInputBlur);
        }

        if (editingCell) {
          const cellEl = getCellElement(editingCell);
          if (cellEl) {
            cellEl.classList.remove('bg-cell--editing');
            cellEl.style.padding = '';
          }
        }

        editInput = null;
        editingCell = null;
        originalValue = null;

        // Re-render to restore formatted cell content
        ctx.grid.refresh();
      }

      function handleInputKeydown(e: KeyboardEvent): void {
        e.stopPropagation(); // Don't let grid handle these keys

        if (e.key === 'Enter' && config.commitOn.includes('enter')) {
          e.preventDefault();
          const pos = editingCell;
          commitEdit();
          // Move to next row
          if (pos) {
            const state = ctx.grid.getState();
            const nextRow = Math.min(pos.rowIndex + 1, state.data.length - 1);
            ctx.grid.setSelection({
              active: { rowIndex: nextRow, colIndex: pos.colIndex },
              ranges: [{
                startRow: nextRow, endRow: nextRow,
                startCol: pos.colIndex, endCol: pos.colIndex,
              }],
            });
          }
        } else if (e.key === 'Tab' && config.commitOn.includes('tab')) {
          e.preventDefault();
          const pos = editingCell;
          commitEdit();
          // Move to next/prev column
          if (pos) {
            const state = ctx.grid.getState();
            const nextCol = e.shiftKey
              ? Math.max(pos.colIndex - 1, 0)
              : Math.min(pos.colIndex + 1, state.columns.length - 1);
            ctx.grid.setSelection({
              active: { rowIndex: pos.rowIndex, colIndex: nextCol },
              ranges: [{
                startRow: pos.rowIndex, endRow: pos.rowIndex,
                startCol: nextCol, endCol: nextCol,
              }],
            });
          }
        } else if (e.key === 'Escape' && config.cancelOnEscape) {
          e.preventDefault();
          cancelEdit();
        }
      }

      function handleInputBlur(): void {
        // Small delay to allow click events to process first
        setTimeout(() => {
          if (editingCell) {
            commitEdit();
          }
        }, 100);
      }

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

      // Enter key starts/commits editing
      const unbindEnter = ctx.registerKeyBinding({
        key: 'Enter',
        priority: 10,
        handler: (_event, cell) => {
          if (editingCell) {
            // Enter during edit is handled by the input's own keydown
            return false;
          }
          if (cell) {
            startEdit(cell);
            return true;
          }
          return false;
        },
      });

      // Escape cancels editing
      const unbindEscape = config.cancelOnEscape
        ? ctx.registerKeyBinding({
            key: 'Escape',
            priority: 10,
            handler: () => {
              if (editingCell) {
                cancelEdit();
                return true;
              }
              return false;
            },
          })
        : undefined;

      // Type-to-edit: any printable key starts editing with that character
      const unbindType = config.editTrigger === 'type'
        ? ctx.registerKeyBinding({
            key: '*',
            priority: -1, // low priority, runs after other bindings
            handler: (event, cell) => {
              if (editingCell) return false;
              if (!cell) return false;
              // Only trigger on printable characters (single char, no modifier except shift)
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
