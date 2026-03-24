// ============================================================================
// Validation Plugin — Cell validation rules and error state
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition } from '@better-grid/core';

export interface ValidationRule<T = unknown> {
  /** Return true if valid, or an error message string if invalid */
  validate: (value: T, row: unknown) => boolean | string;
  /** Fallback error message if validate returns false */
  message?: string;
}

export interface ValidationOptions {
  /** When to validate. Default: 'commit' */
  validateOn?: 'commit' | 'change';
  /** Show inline error indicators. Default: true */
  showErrors?: boolean;
}

export interface ValidationError {
  position: CellPosition;
  message: string;
}

export interface ValidationApi {
  validate(position?: CellPosition): ValidationError[];
  getErrors(): ValidationError[];
  clearErrors(): void;
  isValid(): boolean;
}

export function validation(_options?: ValidationOptions): GridPlugin<'validation'> {
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
        if (!column?.meta?.rules) return null;

        const rules = column.meta.rules as ValidationRule[];
        const row = state.data[position.rowIndex];
        const value = column.accessorKey
          ? (row as Record<string, unknown>)?.[column.accessorKey]
          : undefined;

        for (const rule of rules) {
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
        clearErrors: () => errors.clear(),
        isValid: () => errors.size === 0,
      };

      ctx.expose(api);

      return () => {
        errors.clear();
      };
    },
  };
}
