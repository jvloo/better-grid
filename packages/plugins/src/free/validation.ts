// ============================================================================
// Validation Plugin — Cell validation with visual error indicators
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition } from '@better-grid/core';

/** Validation rule for a column */
export interface ColumnValidationRule {
  /** Return true if valid, or an error message string if invalid */
  validate: (value: unknown, row: unknown) => boolean | string;
  /** Fallback error message when validate returns false */
  message?: string;
}

declare module '@better-grid/core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnDef<TData = unknown> {
    required?: boolean;
    rules?: ColumnValidationRule[];
  }
}

export interface ValidationOptions {
  /** When to validate: 'commit' (after edit), 'all' (validate everything on init). Default: 'commit' */
  validateOn?: 'commit' | 'all';
}

export const VALIDATION_ERROR_CODES = {
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
} as const;

export type ValidationErrorCode = typeof VALIDATION_ERROR_CODES[keyof typeof VALIDATION_ERROR_CODES];

export interface ValidationError {
  position: CellPosition;
  message: string;
  /**
   * Stable code identifying which kind of validation failed. Compare against
   * `grid.$errorCodes.REQUIRED_FIELD` / `.VALIDATION_FAILED` for typed narrowing
   * instead of parsing `message`.
   */
  code: ValidationErrorCode;
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

export function validation(options?: ValidationOptions): GridPlugin<'validation', ValidationApi> {
  const config = {
    validateOn: options?.validateOn ?? 'commit',
  };

  return {
    id: 'validation',
    $errorCodes: VALIDATION_ERROR_CODES,

    init(ctx: PluginContext) {
      const errors = new Map<string, ValidationError>();
      const validationTooltipEls = new Map<string, HTMLElement>();

      function positionKey(pos: CellPosition): string {
        return `${pos.rowIndex}:${pos.colIndex}`;
      }

      type CellFailure = { message: string; code: ValidationErrorCode };

      function validateCell(position: CellPosition): CellFailure | null {
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        if (!column) return null;

        const row = state.data[position.rowIndex];
        const value = column.accessorKey
          ? (row as Record<string, unknown>)?.[column.accessorKey]
          : undefined;

        if (column.required && (value == null || value === '')) {
          return { message: 'This field is required', code: VALIDATION_ERROR_CODES.REQUIRED_FIELD };
        }

        if (!column.rules || column.rules.length === 0) return null;

        for (const rule of column.rules) {
          const result = rule.validate(value, row);
          if (result === false) {
            return { message: rule.message ?? 'Invalid value', code: VALIDATION_ERROR_CODES.VALIDATION_FAILED };
          }
          if (typeof result === 'string') {
            return { message: result, code: VALIDATION_ERROR_CODES.VALIDATION_FAILED };
          }
        }

        return null;
      }

      // Inject error border CSS once
      if (!document.getElementById('bg-validation-style')) {
        const style = document.createElement('style');
        style.id = 'bg-validation-style';
        style.textContent = `
          .bg-cell--input-editable.bg-cell--error {
            outline: none !important;
          }
          .bg-cell--error .bg-input-box {
            border: 1px solid #FFAAAA !important;
          }
          .bg-validation-tooltip {
            position: fixed;
            z-index: 10000;
            background: #fff;
            border-radius: 4px;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10);
            padding: 4px 8px;
            pointer-events: none;
            white-space: nowrap;
          }
          .bg-validation-tooltip__text {
            color: #FB4C4C;
            font-size: 12px;
            line-height: 18px;
            margin: 0;
          }
        `;
        document.head.appendChild(style);
      }

      function dismissValidationTooltips(): void {
        for (const tooltip of validationTooltipEls.values()) {
          tooltip.remove();
        }
        validationTooltipEls.clear();
      }

      function showValidationTooltip(key: string, target: HTMLElement, message: string): void {
        const anchor = target.querySelector('.bg-input-box') as HTMLElement | null;
        const rect = (anchor ?? target).getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'bg-validation-tooltip';
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 4}px`;

        const text = document.createElement('p');
        text.className = 'bg-validation-tooltip__text';
        text.textContent = message;
        tooltip.appendChild(text);

        document.body.appendChild(tooltip);
        validationTooltipEls.set(key, tooltip);
      }

      // Track hover listeners for cleanup
      const hoverCleanups = new Map<HTMLElement, () => void>();

      function applyErrorStyles(): void {
        dismissValidationTooltips();

        // Remove existing error styles and hover listeners
        document.querySelectorAll('.bg-cell--error').forEach((el) => {
          el.classList.remove('bg-cell--error');
          const cleanup = hoverCleanups.get(el as HTMLElement);
          if (cleanup) { cleanup(); hoverCleanups.delete(el as HTMLElement); }
        });

        // Apply error styles and tooltip hover to cells with errors
        for (const error of errors.values()) {
          const { rowIndex, colIndex } = error.position;
          const cells = document.querySelectorAll(
            `.bg-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`,
          );
          for (const cell of cells) {
            cell.classList.add('bg-cell--error');
            const htmlCell = cell as HTMLElement;

            const key = `${positionKey(error.position)}:${validationTooltipEls.size}`;
            showValidationTooltip(key, htmlCell, error.message);
            const onEnter = () => {
              if (!validationTooltipEls.has(key)) showValidationTooltip(key, htmlCell, error.message);
            };
            htmlCell.addEventListener('mouseenter', onEnter);
            hoverCleanups.set(htmlCell, () => {
              htmlCell.removeEventListener('mouseenter', onEnter);
            });
          }
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
            const failure = validateCell(position);
            const key = positionKey(position);
            if (failure) {
              const entry: ValidationError = { position, ...failure };
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
              const failure = validateCell(pos);
              if (failure) {
                const entry: ValidationError = { position: pos, ...failure };
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
        dismissValidationTooltips();
        for (const cleanup of hoverCleanups.values()) cleanup();
        hoverCleanups.clear();
      };
    },
  };
}
