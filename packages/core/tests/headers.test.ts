import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHeaderRenderer, type HeaderRendererDeps } from '../src/rendering/headers';
import type { ColumnDef, GridState, HeaderRow } from '../src/types';
import type { LayoutMeasurements } from '../src/virtualization/engine';

function makeState(columns: ColumnDef[], frozenLeftColumns = 0): GridState {
  return {
    columns,
    frozenLeftColumns,
    frozenTopRows: 0,
    rows: [],
    pinnedTopRows: [],
    pinnedBottomRows: [],
    selection: { ranges: [] },
    scroll: { scrollTop: 0, scrollLeft: 0 },
    hierarchy: null,
  } as unknown as GridState;
}

function makeMeasurements(colWidths: number[]): LayoutMeasurements {
  const offsets = new Float32Array(colWidths.length + 1);
  let running = 0;
  for (let i = 0; i < colWidths.length; i++) {
    running += colWidths[i]!;
    offsets[i + 1] = running;
  }
  return {
    colOffsets: offsets,
    rowOffsets: new Float32Array([0]),
    totalWidth: running,
    totalHeight: 0,
  } as LayoutMeasurements;
}

function setup(
  columns: ColumnDef[],
  overrides: Partial<HeaderRendererDeps> = {},
  headerRows?: HeaderRow[],
  frozenLeftColumns = 0,
) {
  const headerContainer = document.createElement('div');
  const frozenHeaderOverlay = document.createElement('div');
  document.body.appendChild(headerContainer);
  document.body.appendChild(frozenHeaderOverlay);

  const deps: HeaderRendererDeps = {
    headerContainer,
    frozenHeaderOverlay,
    headerRows,
    headerHeight: 32,
    singleHeaderRowHeight: 32,
    tooltip: { show: vi.fn(), dismiss: vi.fn() },
    hasFilterPlugin: () => false,
    onHeaderClick: vi.fn(),
    onHeaderContextMenu: vi.fn(),
    onFilterButtonClick: vi.fn(),
    onColumnResize: vi.fn(),
    ...overrides,
  } as unknown as HeaderRendererDeps;

  const renderer = createHeaderRenderer(deps);
  const widths = columns.map(() => 100);
  renderer.render(makeState(columns, frozenLeftColumns), makeMeasurements(widths));

  return { renderer, deps, headerContainer, frozenHeaderOverlay };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createHeaderRenderer', () => {
  it('renders one header cell per column in single-row mode', () => {
    const { headerContainer } = setup([
      { id: 'a', header: 'Alpha' } as ColumnDef,
      { id: 'b', header: 'Beta' } as ColumnDef,
    ]);
    const cells = headerContainer.querySelectorAll('.bg-header-cell');
    expect(cells).toHaveLength(2);
    expect((cells[0] as HTMLElement).textContent).toBe('Alpha');
    expect((cells[1] as HTMLElement).textContent).toBe('Beta');
  });

  it('routes frozen columns to the overlay and scrollable to the main container', () => {
    const { headerContainer, frozenHeaderOverlay } = setup(
      [
        { id: 'a', header: 'A' } as ColumnDef,
        { id: 'b', header: 'B' } as ColumnDef,
        { id: 'c', header: 'C' } as ColumnDef,
      ],
      {},
      undefined,
      2,
    );
    expect(frozenHeaderOverlay.querySelectorAll('.bg-header-cell')).toHaveLength(2);
    expect(headerContainer.querySelectorAll('.bg-header-cell')).toHaveLength(1);
  });

  it('invokes onHeaderClick when a header cell is clicked', () => {
    const onHeaderClick = vi.fn();
    const { headerContainer } = setup(
      [{ id: 'a', header: 'A' } as ColumnDef],
      { onHeaderClick },
    );
    (headerContainer.querySelector('.bg-header-cell') as HTMLElement).click();
    expect(onHeaderClick).toHaveBeenCalledWith('a');
  });

  it('invokes onHeaderContextMenu on right-click and prevents default', () => {
    const onHeaderContextMenu = vi.fn();
    const { headerContainer } = setup(
      [{ id: 'a', header: 'A' } as ColumnDef],
      { onHeaderContextMenu },
    );
    const cell = headerContainer.querySelector('.bg-header-cell') as HTMLElement;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    cell.dispatchEvent(event);
    expect(onHeaderContextMenu).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('renders a filter button only when hasFilterPlugin() is true', () => {
    const { headerContainer: withOff } = setup(
      [{ id: 'a', header: 'A' } as ColumnDef],
      { hasFilterPlugin: () => false },
    );
    expect(withOff.querySelector('.bg-header-cell__filter-btn')).toBeNull();

    document.body.innerHTML = '';
    const { headerContainer: withOn } = setup(
      [{ id: 'a', header: 'A' } as ColumnDef],
      { hasFilterPlugin: () => true },
    );
    expect(withOn.querySelector('.bg-header-cell__filter-btn')).not.toBeNull();
  });

  it('routes filter button mousedown to onFilterButtonClick', () => {
    const onFilterButtonClick = vi.fn();
    const { headerContainer } = setup(
      [{ id: 'a', header: 'A' } as ColumnDef],
      { hasFilterPlugin: () => true, onFilterButtonClick },
    );
    const btn = headerContainer.querySelector('.bg-header-cell__filter-btn') as HTMLElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(onFilterButtonClick).toHaveBeenCalled();
    expect(onFilterButtonClick.mock.calls[0][1]).toBe('a');
  });

  it('renders a resize handle and calls onColumnResize on pointerdown', () => {
    const onColumnResize = vi.fn();
    const { headerContainer } = setup(
      [{ id: 'a', header: 'A' } as ColumnDef],
      { onColumnResize },
    );
    const handle = headerContainer.querySelector('.bg-resize-handle') as HTMLElement;
    expect(handle).not.toBeNull();
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onColumnResize).toHaveBeenCalledWith(0, expect.any(PointerEvent));
  });

  it('omits the resize handle when column.resizable === false', () => {
    const { headerContainer } = setup([
      { id: 'a', header: 'A', resizable: false } as ColumnDef,
    ]);
    expect(headerContainer.querySelector('.bg-resize-handle')).toBeNull();
  });

  it('render() is idempotent until invalidate() is called', () => {
    const { renderer, headerContainer, deps } = setup([
      { id: 'a', header: 'A' } as ColumnDef,
    ]);
    const firstCount = headerContainer.querySelectorAll('.bg-header-cell').length;

    // Re-render without invalidating — no changes expected
    renderer.render(
      makeState([{ id: 'a', header: 'A' } as ColumnDef]),
      makeMeasurements([100]),
    );
    expect(headerContainer.querySelectorAll('.bg-header-cell').length).toBe(firstCount);

    // Invalidate + re-render with two columns — rebuilds
    renderer.invalidate();
    renderer.render(
      makeState([
        { id: 'a', header: 'A' } as ColumnDef,
        { id: 'b', header: 'B' } as ColumnDef,
      ]),
      makeMeasurements([100, 100]),
    );
    expect(headerContainer.querySelectorAll('.bg-header-cell').length).toBe(2);
    expect(deps.onHeaderClick).not.toHaveBeenCalled();
  });

  it('fires tooltip.show via delegated mouseover when header text is clipped', () => {
    const show = vi.fn();
    const dismiss = vi.fn();
    const { headerContainer } = setup(
      [{ id: 'a', header: 'A very long header label that will clip' } as ColumnDef],
      { tooltip: { show, dismiss } as unknown as HeaderRendererDeps['tooltip'] },
    );
    const cell = headerContainer.querySelector('.bg-header-cell') as HTMLElement;
    const textSpan = cell.querySelector('.bg-header-cell__text') as HTMLElement;

    // Simulate clipping (happy-dom doesn't provide real layout metrics).
    Object.defineProperty(textSpan, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(textSpan, 'clientWidth', { value: 50, configurable: true });

    // Dispatch mouseover from the text span — should bubble up to the
    // delegated listener on headerContainer.
    textSpan.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith(cell, expect.stringContaining('A very long'));

    // Dispatch mouseout leaving the cell — dismiss fires.
    textSpan.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-fire tooltip.show when moving within the same cell (relatedTarget guard)', () => {
    const show = vi.fn();
    const dismiss = vi.fn();
    const { headerContainer } = setup(
      [{ id: 'a', header: 'Long clipped header' } as ColumnDef],
      {
        tooltip: { show, dismiss } as unknown as HeaderRendererDeps['tooltip'],
        hasFilterPlugin: () => true,
      },
    );
    const cell = headerContainer.querySelector('.bg-header-cell') as HTMLElement;
    const textSpan = cell.querySelector('.bg-header-cell__text') as HTMLElement;
    const filterBtn = cell.querySelector('.bg-header-cell__filter-btn') as HTMLElement;
    Object.defineProperty(textSpan, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(textSpan, 'clientWidth', { value: 50, configurable: true });

    // Initial entry from outside the cell.
    textSpan.dispatchEvent(
      new MouseEvent('mouseover', { bubbles: true, cancelable: true, relatedTarget: document.body }),
    );
    expect(show).toHaveBeenCalledTimes(1);

    // Move within the same cell (textSpan -> filterBtn). relatedTarget is
    // still inside the cell, so show() must NOT be called again, and
    // dismiss() must NOT be called on the corresponding mouseout.
    textSpan.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, cancelable: true, relatedTarget: filterBtn }),
    );
    filterBtn.dispatchEvent(
      new MouseEvent('mouseover', { bubbles: true, cancelable: true, relatedTarget: textSpan }),
    );
    expect(show).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('attaches delegated tooltip listeners exactly once per renderer (not per cell)', () => {
    // Monkey-patch addEventListener on a container to count how many
    // mouseover/mouseout listeners get attached.
    const headerContainer = document.createElement('div');
    const frozenHeaderOverlay = document.createElement('div');
    document.body.appendChild(headerContainer);
    document.body.appendChild(frozenHeaderOverlay);

    const counts: Record<string, number> = {};
    const origAdd = headerContainer.addEventListener.bind(headerContainer);
    headerContainer.addEventListener = ((type: string, ...rest: unknown[]) => {
      counts[type] = (counts[type] ?? 0) + 1;
      // @ts-expect-error — pass-through
      return origAdd(type, ...rest);
    }) as typeof headerContainer.addEventListener;

    const deps: HeaderRendererDeps = {
      headerContainer,
      frozenHeaderOverlay,
      headerRows: undefined,
      headerHeight: 32,
      singleHeaderRowHeight: 32,
      tooltip: { show: vi.fn(), dismiss: vi.fn() },
      hasFilterPlugin: () => false,
      onHeaderClick: vi.fn(),
      onHeaderContextMenu: vi.fn(),
      onFilterButtonClick: vi.fn(),
      onColumnResize: vi.fn(),
    } as unknown as HeaderRendererDeps;

    const renderer = createHeaderRenderer(deps);
    const columns = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, header: `H${i}` } as ColumnDef));
    const widths = columns.map(() => 100);
    renderer.render(makeState(columns), makeMeasurements(widths));

    // Second render() is no-op (idempotent) — still 1 mouseover + 1 mouseout.
    renderer.render(makeState(columns), makeMeasurements(widths));
    // Invalidate + re-render must NOT re-attach.
    renderer.invalidate();
    renderer.render(makeState(columns), makeMeasurements(widths));

    expect(counts.mouseover).toBe(1);
    expect(counts.mouseout).toBe(1);
  });

  it('renders multi-level header rows with group spans', () => {
    const headerRows: HeaderRow[] = [
      {
        id: 'groups',
        height: 32,
        cells: [
          { id: 'g1', content: 'Group', colSpan: 2 },
          { id: 'g2', content: '', columnId: 'c' },
        ],
      },
      {
        id: 'cols',
        height: 32,
        cells: [
          { id: 'h-a', content: 'A', columnId: 'a' },
          { id: 'h-b', content: 'B', columnId: 'b' },
          { id: 'h-c', content: 'C', columnId: 'c' },
        ],
      },
    ];
    const { headerContainer } = setup(
      [
        { id: 'a', header: 'A' } as ColumnDef,
        { id: 'b', header: 'B' } as ColumnDef,
        { id: 'c', header: 'C' } as ColumnDef,
      ],
      {},
      headerRows,
    );

    const groupCells = headerContainer.querySelectorAll('.bg-header-cell--group');
    expect(groupCells.length).toBeGreaterThan(0);
    const groupLabel = Array.from(headerContainer.querySelectorAll('.bg-header-cell__text'))
      .map((el) => el.textContent)
      .find((t) => t === 'Group');
    expect(groupLabel).toBe('Group');
  });
});
