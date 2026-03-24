// ============================================================================
// Editing Plugin — Cell editing with type-to-edit, dblclick, commit/cancel
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition } from '@better-grid/core';

export interface EditingOptions {
  /** How to trigger edit mode. Default: 'dblclick' */
  editTrigger?: 'click' | 'dblclick' | 'type';
  /** When to commit edits. Default: ['blur', 'enter', 'tab'] */
  commitOn?: ('blur' | 'enter' | 'tab')[];
  /** Cancel on Escape. Default: true */
  cancelOnEscape?: boolean;
}

export interface EditingApi {
  startEdit(position: CellPosition): void;
  commitEdit(): void;
  cancelEdit(): void;
  isEditing(): boolean;
  getEditingCell(): CellPosition | null;
}

export function editing(options?: EditingOptions): GridPlugin<'editing'> {
  const config = {
    editTrigger: options?.editTrigger ?? 'dblclick',
    commitOn: options?.commitOn ?? ['blur', 'enter', 'tab'],
    cancelOnEscape: options?.cancelOnEscape ?? true,
  };

  return {
    id: 'editing',

    init(ctx: PluginContext) {
      let editingCell: CellPosition | null = null;

      const api: EditingApi = {
        startEdit(position: CellPosition) {
          editingCell = position;
          ctx.emit('cell:focus', position);
        },
        commitEdit() {
          if (editingCell) {
            editingCell = null;
          }
        },
        cancelEdit() {
          editingCell = null;
        },
        isEditing() {
          return editingCell !== null;
        },
        getEditingCell() {
          return editingCell;
        },
      };

      // Register dblclick trigger
      if (config.editTrigger === 'dblclick') {
        ctx.on('cell:dblclick', (cell) => {
          api.startEdit(cell);
        });
      }

      // Enter key starts/commits editing
      const unbindEnter = ctx.registerKeyBinding({
        key: 'Enter',
        priority: 10,
        handler: (_event, cell) => {
          if (editingCell) {
            api.commitEdit();
            return true;
          }
          if (cell) {
            api.startEdit(cell);
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
                api.cancelEdit();
                return true;
              }
              return false;
            },
          })
        : undefined;

      ctx.expose(api);

      return () => {
        unbindEnter();
        unbindEscape?.();
      };
    },
  };
}
