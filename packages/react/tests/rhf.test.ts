import { describe, test, expect, vi } from 'vitest';
import type { CellChange } from '@better-grid/core';
import type { FieldValues, UseFormSetValue } from 'react-hook-form';
import { forwardCellChangeToRhf } from '../src/rhf';

interface Row { id: number; qty: number; price: number }

function mkChange(over: Partial<CellChange<Row>> = {}): CellChange<Row> {
  return {
    rowIndex: 2,
    columnId: 'qty',
    oldValue: 10,
    newValue: 25,
    row: { id: 99, qty: 25, price: 100 },
    ...over,
  };
}

describe('forwardCellChangeToRhf', () => {
  test('uses baseName to build dotted path', () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<FieldValues>;
    const path = forwardCellChangeToRhf(mkChange(), { baseName: 'costs' }, setValue);
    expect(path).toBe('costs.2.qty');
    expect(setValue).toHaveBeenCalledWith('costs.2.qty', 25, expect.any(Object));
  });

  test('getFieldPath wins over baseName', () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<FieldValues>;
    const path = forwardCellChangeToRhf(
      mkChange(),
      {
        baseName: 'ignored',
        getFieldPath: (rowIndex, columnId, row) => `entries.${row.id}.${columnId}.${rowIndex}`,
      },
      setValue,
    );
    expect(path).toBe('entries.99.qty.2');
  });

  test('transform overrides forwarded value', () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<FieldValues>;
    forwardCellChangeToRhf(
      mkChange(),
      {
        baseName: 'costs',
        transform: (c) => Number(c.newValue) * 2,
      },
      setValue,
    );
    expect(setValue).toHaveBeenCalledWith('costs.2.qty', 50, expect.any(Object));
  });

  test('transform returning undefined skips the forward', () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<FieldValues>;
    const path = forwardCellChangeToRhf(
      mkChange(),
      {
        baseName: 'costs',
        transform: () => undefined,
      },
      setValue,
    );
    expect(path).toBeNull();
    expect(setValue).not.toHaveBeenCalled();
  });

  test('default flags: shouldDirty true, shouldTouch true, shouldValidate false', () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<FieldValues>;
    forwardCellChangeToRhf(mkChange(), { baseName: 'x' }, setValue);
    expect(setValue).toHaveBeenCalledWith('x.2.qty', 25, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
  });

  test('shouldValidate opt-in honored', () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<FieldValues>;
    forwardCellChangeToRhf(mkChange(), { baseName: 'x', shouldValidate: true }, setValue);
    expect(setValue).toHaveBeenCalledWith('x.2.qty', 25, expect.objectContaining({ shouldValidate: true }));
  });
});
