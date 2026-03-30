// ============================================================================
// Undo/Redo Plugin — Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) history
// ============================================================================

import type { GridPlugin, PluginContext } from '@better-grid/core';

export interface UndoRedoOptions {
  /** Maximum history size. Default: 50 */
  maxHistory?: number;
}

export interface UndoRedoApi {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}

interface HistoryEntry {
  type: 'cell';
  rowIndex: number;
  columnId: string;
  oldValue: unknown;
  newValue: unknown;
}

export function undoRedo(options?: UndoRedoOptions): GridPlugin<'undoRedo'> {
  const maxHistory = options?.maxHistory ?? 50;

  return {
    id: 'undoRedo',

    init(ctx: PluginContext) {
      const undoStack: HistoryEntry[] = [];
      const redoStack: HistoryEntry[] = [];
      let isUndoRedoAction = false; // prevent recording during undo/redo

      // Listen for cell changes to record history.
      // Note: data:change passes CellChange[] where `oldValue` is the old row
      // object, so we extract the actual cell value via columnId.
      ctx.on('data:change', (changes) => {
        if (isUndoRedoAction) return;

        for (const change of changes) {
          const oldCellValue =
            change.oldValue != null
              ? (change.oldValue as Record<string, unknown>)[change.columnId]
              : undefined;

          undoStack.push({
            type: 'cell',
            rowIndex: change.rowIndex,
            columnId: change.columnId,
            oldValue: oldCellValue,
            newValue: change.newValue,
          });

          // Trim to max history
          while (undoStack.length > maxHistory) {
            undoStack.shift();
          }
        }

        // Clear redo stack on new action
        redoStack.length = 0;
      });

      function undo(): void {
        const entry = undoStack.pop();
        if (!entry) return;

        isUndoRedoAction = true;
        ctx.grid.updateCell(entry.rowIndex, entry.columnId, entry.oldValue);
        isUndoRedoAction = false;

        redoStack.push(entry);
      }

      function redo(): void {
        const entry = redoStack.pop();
        if (!entry) return;

        isUndoRedoAction = true;
        ctx.grid.updateCell(entry.rowIndex, entry.columnId, entry.newValue);
        isUndoRedoAction = false;

        undoStack.push(entry);
      }

      // Key bindings — use wildcard key with manual check (same pattern as
      // clipboard plugin) so we can match modifier combos.

      const unbindUndo = ctx.registerKeyBinding({
        key: '*',
        priority: 8,
        handler: (event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key === 'z' &&
            !event.shiftKey
          ) {
            event.preventDefault();
            undo();
            return true;
          }
          return false;
        },
      });

      const unbindRedo = ctx.registerKeyBinding({
        key: '*',
        priority: 8,
        handler: (event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            (event.key === 'y' ||
              (event.key === 'z' && event.shiftKey) ||
              (event.key === 'Z' && event.shiftKey))
          ) {
            event.preventDefault();
            redo();
            return true;
          }
          return false;
        },
      });

      const api: UndoRedoApi = {
        undo,
        redo,
        canUndo: () => undoStack.length > 0,
        canRedo: () => redoStack.length > 0,
        clear: () => {
          undoStack.length = 0;
          redoStack.length = 0;
        },
      };

      ctx.expose(api);

      return () => {
        unbindUndo();
        unbindRedo();
      };
    },
  };
}
