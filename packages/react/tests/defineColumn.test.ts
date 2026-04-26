import { describe, test, expect, beforeEach } from 'vitest';
import { defineColumn as col, registerColumn, _resetColumnRegistry } from '../src/defineColumn';

describe('defineColumn (col.*)', () => {
  beforeEach(() => _resetColumnRegistry());

  test('col.text returns a ColumnDef with id + field from field', () => {
    const c = col.text('name', { headerName: 'Name', width: 100 });
    expect(c.id).toBe('name');
    expect(c.field).toBe('name');
    expect(c.headerName).toBe('Name');
    expect(c.width).toBe(100);
  });

  test('col.currency wires cellType + right alignment', () => {
    const c = col.currency('q1Actual', { precision: 0 } as any);
    expect(c.cellType).toBe('currency');
    expect(c.align).toBe('right');
    expect((c as { precision?: number }).precision).toBe(0);
  });

  test('col.custom requires cellRenderer and does not set cellType', () => {
    const renderer = () => {};
    const c = col.custom('foo', { cellRenderer: renderer });
    expect(c.cellRenderer).toBe(renderer);
    expect(c.cellType).toBeUndefined();
  });

  test('user opts override builder defaults', () => {
    const c = col.currency('q1', { align: 'left', precision: 2 } as any);
    expect(c.align).toBe('left');
    expect((c as { precision?: number }).precision).toBe(2);
  });

  test('default header falls back to the field name', () => {
    const c = col.text('department');
    expect(c.headerName).toBe('department');
  });

  test('registerColumn adds a custom type usable as col.<name>', () => {
    registerColumn('avatar', { width: 60, align: 'center' });
    const c = (col as unknown as Record<string, (...a: unknown[]) => unknown>).avatar('user.avatarUrl', { width: 80 });
    expect((c as { width: number }).width).toBe(80);
    expect((c as { align: string }).align).toBe('center');
  });

  test('registerColumn rejects built-in name collisions', () => {
    expect(() => registerColumn('currency', { width: 80 })).toThrow(/built-in/);
  });

  test('registerColumn rejects duplicate registration', () => {
    registerColumn('avatar', { width: 60 });
    expect(() => registerColumn('avatar', { width: 80 })).toThrow(/already registered/);
  });

  test('accessing a non-registered column type throws a helpful error', () => {
    expect(() => (col as unknown as Record<string, () => unknown>).bogus()).toThrow(/not a registered column type/);
  });

  test('col.text forwards hide / flex / headerAlign / headerRenderer', () => {
    const fn = (container: HTMLElement) => container.append('x');
    const c = col.text<{ name: string }>('name', {
      headerName: 'Name',
      hide: true,
      flex: 2,
      headerAlign: 'right',
      headerRenderer: fn,
    });
    expect(c.field).toBe('name');
    expect(c.headerName).toBe('Name');
    expect(c.hide).toBe(true);
    expect(c.flex).toBe(2);
    expect(c.headerAlign).toBe('right');
    expect(c.headerRenderer).toBe(fn);
  });

  test('col.text auto-derives id from field', () => {
    const c = col.text('amount', { headerName: 'Amount' });
    expect(c.id).toBe('amount');
  });

  test('col.text explicit id wins over field', () => {
    const c = col.text('amount', { id: 'amountUSD', headerName: 'Amount' });
    expect(c.id).toBe('amountUSD');
  });
});
