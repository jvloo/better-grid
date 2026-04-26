// ============================================================================
// @better-grid/react/rhf — react-hook-form bridge
// ============================================================================
//
// Forwards Better Grid cell commits to a react-hook-form FormProvider, so
// `<input>` elements rendered by the editing plugin (especially
// `column.alwaysInput: true`) participate in your form's dirty/touched state,
// validation, and submit lifecycle without each cell needing its own
// <Controller>.
//
// Usage:
//   <FormProvider {...methods}>
//     <CostsTable />     // calls useGridForm({ grid, baseName: 'costs' })
//   </FormProvider>
// ============================================================================

import { useEffect, useRef } from 'react';
import { useFormContext, type FieldValues, type UseFormSetValue } from 'react-hook-form';
import type { CellChange } from '@better-grid/core';
import type { GridHandle } from './types';

/**
 * Pure helper — forwards a single CellChange into a RHF setValue. Extracted so
 * it can be unit-tested without React render context. Returns the resolved
 * field path so callers can log/inspect.
 */
export function forwardCellChangeToRhf<TData>(
  change: CellChange<TData>,
  opts: Omit<UseGridFormOptions<TData>, 'grid'>,
  setValue: UseFormSetValue<FieldValues>,
): string | null {
  const value = opts.transform ? opts.transform(change) : change.newValue;
  if (value === undefined && opts.transform) return null;
  const path = opts.getFieldPath
    ? opts.getFieldPath(change.rowIndex, change.columnId, change.row)
    : `${opts.baseName}.${change.rowIndex}.${change.columnId}`;
  setValue(path, value, {
    shouldDirty: opts.shouldDirty ?? true,
    shouldTouch: opts.shouldTouch ?? true,
    shouldValidate: opts.shouldValidate ?? false,
  });
  return path;
}

export interface UseGridFormOptions<TData = unknown> {
  /** Grid handle from `useGrid()`. */
  grid: GridHandle<TData> | null | undefined;

  /**
   * Base RHF field path. Combined as `${baseName}.${rowIndex}.${columnId}`.
   * Either `baseName` OR `getFieldPath` must be provided.
   */
  baseName?: string;

  /**
   * Custom RHF field-path resolver. Wins over `baseName`. Use this when row
   * positions don't map 1:1 to your form's array index (e.g. virtualized
   * subset, hierarchy with stable ids).
   */
  getFieldPath?: (rowIndex: number, columnId: string, row: TData) => string;

  /** Mark fields dirty on commit. Default: true. */
  shouldDirty?: boolean;

  /** Mark fields touched on commit. Default: true. */
  shouldTouch?: boolean;

  /** Trigger RHF validation after each commit. Default: false. */
  shouldValidate?: boolean;

  /**
   * Called for each grid commit before forwarding to RHF. Return a different
   * value to override what gets stored in form state, or `undefined` to skip.
   */
  transform?: (change: CellChange<TData>) => unknown;
}

/**
 * Subscribe a Better Grid handle to the surrounding RHF FormProvider so cell
 * edits flow into form state.
 *
 * Returns nothing — installs an event listener for the lifetime of the host
 * component, then unsubscribes on unmount.
 */
export function useGridForm<TData = unknown, TFormValues extends FieldValues = FieldValues>(
  opts: UseGridFormOptions<TData>,
): void {
  const ctx = useFormContext<TFormValues>();
  if (!ctx) {
    throw new Error('[better-grid/rhf] useGridForm must be used inside a <FormProvider>.');
  }
  if (!opts.baseName && !opts.getFieldPath) {
    throw new Error('[better-grid/rhf] Either `baseName` or `getFieldPath` is required.');
  }

  const setValue = ctx.setValue as UseFormSetValue<FieldValues>;

  // Stash latest opts in a ref so the effect dep list stays minimal —
  // resubscribing on every render would lose in-flight commits.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const grid = opts.grid;
  useEffect(() => {
    if (!grid) return;
    const off = grid.api.on('cell:change', (changes: CellChange<TData>[]) => {
      for (const change of changes) {
        forwardCellChangeToRhf(change, optsRef.current, setValue);
      }
    });
    return off;
  }, [grid, setValue]);
}
