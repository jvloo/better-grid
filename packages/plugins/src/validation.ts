// ============================================================================
// Validation Plugin — Cell validation with visual error indicators
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition } from '@better-grid/core';

export interface ValidationOptions {
  /** When to validate: 'commit' (after edit), 'all' (validate everything on init). Default: 'commit' */
  validateOn?: 'commit' | 'all';
}

export interface ValidationError {
  position: CellPosition;
  message: string;
}

export interface ValidationApi {
  /** Validate a single cell or all cells. Returns errors found. */
  validate(position?: CellPosition): ValidationError[];
  /** Get all current errors */
  getErrors(): ValidationError[];
  /** Clear all errors */
  clearErrors(): void;
  /** Check if all cells are valid */
  isValid(): boolean;
}

export function validation(options?: ValidationOptions): GridPlugin<'validation'> {
  const config = {
    validateOn: options?.validateOn ?? 'commit',
  };

  return {
    id: 'validation',

    init(ctx: PluginContext) {
      const errors = new Map<string, ValidationError>();

      function positionKey(pos: CellPosition): string {
        return `${pos.rowIndex}:${pos.colIndex}`;
      }

      function validateCell(position: CellPosition): string | null {
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        if (!column) return null;

        const row = state.data[position.rowIndex];
        const value = column.accessorKey
          ? (row as Record<string, unknown>)?.[column.accessorKey]
          : undefined;

        // Check required
        if (column.required && (value == null || value === '')) {
          return 'This field is required';
        }

        // Check rules
        if (!column.rules || column.rules.length === 0) return null;

        for (const rule of column.rules) {
          const result = rule.validate(value, row);
          if (result === false) {
            return rule.message ?? 'Invalid value';
          }
          if (typeof result === 'string') {
            return result;
          }
        }

        return null;
      }

      // Inject error border CSS once
      if (!document.getElementById('bg-validation-style')) {
        const style = document.createElement('style');
        style.id = 'bg-validation-style';
        style.textContent = `
          .bg-cell--error .bg-input-box {
            border: 1px solid #FFAAAA !important;
          }
        `;
        document.head.appendChild(style);
      }

      // Track hover listeners for cleanup
      const hoverCleanups = new Map<HTMLElement, () => void>();

      function applyErrorStyles(): void {
        // Remove existing error styles and hover listeners
        document.querySelectorAll('.bg-cell--error').forEach((el) => {
          el.classList.remove('bg-cell--error');
          const cleanup = hoverCleanups.get(el as HTMLElement);
          if (cleanup) { cleanup(); hoverCleanups.delete(el as HTMLElement); }
        });

        // Apply error styles and tooltip hover to cells with errors
        let lastErrorCell: HTMLElement | null = null;
        let lastErrorMessage = '';

        for (const error of errors.values()) {
          const { rowIndex, colIndex } = error.position;
          const cells = document.querySelectorAll(
            `.bg-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`,
          );
          for (const cell of cells) {
            cell.classList.add('bg-cell--error');
            const htmlCell = cell as HTMLElement;

            // Tooltip on hover via grid's built-in tooltip system
            const onEnter = (e: MouseEvent) => {
              ctx.showTooltip(htmlCell, error.message, e.clientX, e.clientY);
            };
            const onLeave = () => { ctx.dismissTooltip(); };
            htmlCell.addEventListener('mouseenter', onEnter);
            htmlCell.addEventListener('mouseleave', onLeave);
            hoverCleanups.set(htmlCell, () => {
              htmlCell.removeEventListener('mouseenter', onEnter);
              htmlCell.removeEventListener('mouseleave', onLeave);
            });

            lastErrorCell = htmlCell;
            lastErrorMessage = error.message;
          }
        }

        // Auto-show tooltip on the most recently validated error cell
        if (lastErrorCell) {
          const rect = lastErrorCell.getBoundingClientRect();
          ctx.showTooltip(lastErrorCell, lastErrorMessage, rect.left + rect.width / 2, rect.bottom);
        }
      }

      function validateAndRender(position?: CellPosition): ValidationError[] {
        const result = api.validate(position);
        applyErrorStyles();
        return result;
      }

      const api: ValidationApi = {
        validate(position) {
          if (position) {
            const error = validateCell(position);
            const key = positionKey(position);
            if (error) {
              const entry = { position, message: error };
              errors.set(key, entry);
              return [entry];
            }
            errors.delete(key);
            return [];
          }

          // Validate all cells
          errors.clear();
          const state = ctx.grid.getState();
          const allErrors: ValidationError[] = [];
          for (let row = 0; row < state.data.length; row++) {
            for (let col = 0; col < state.columns.length; col++) {
              const column = state.columns[col];
              // Only validate columns with rules or required
              if (!column?.rules?.length && !column?.required) continue;

              const pos = { rowIndex: row, colIndex: col };
              const error = validateCell(pos);
              if (error) {
                const entry = { position: pos, message: error };
                errors.set(positionKey(pos), entry);
                allErrors.push(entry);
              }
            }
          }
          return allErrors;
        },
        getErrors: () => [...errors.values()],
        clearErrors: () => {
          errors.clear();
          applyErrorStyles();
        },
        isValid: () => errors.size === 0,
      };

      // Auto-validate on data change (after edit commit)
      const unsubData = ctx.on('data:change', (changes) => {
        for (const change of changes) {
          const colIndex = ctx.grid.getState().columns.findIndex((c) => c.id === change.columnId);
          if (colIndex >= 0) {
            validateAndRender({ rowIndex: change.rowIndex, colIndex });
          }
        }
      });

      // Re-apply error styles after render (cells get recreated by virtualization)
      const unsubRender = ctx.on('render', () => {
        if (errors.size > 0) {
          applyErrorStyles();
        }
      });

      // Validate all on init if configured
      if (config.validateOn === 'all') {
        // Delay to after first render
        setTimeout(() => validateAndRender(), 0);
      }

      ctx.expose(api);

      return () => {
        unsubData();
        unsubRender();
        errors.clear();
        for (const cleanup of hoverCleanups.values()) cleanup();
        hoverCleanups.clear();
      };
    },
  };
}
