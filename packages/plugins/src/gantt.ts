// ============================================================================
// Gantt Plugin — Pro tier: Gantt bar renderer with drag-to-move/resize
// ============================================================================

import type { GridPlugin, PluginContext, CellTypeRenderer, CellRenderContext } from '@better-grid/core';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GanttOptions {
  /** Bar height as fraction of cell height (0–1). Default: 0.5 */
  barHeight?: number;
  /** Bar colors by variance state */
  colors?: { neutral?: string; ahead?: string; late?: string };
  /** Separate color for parent (group) rows. Default: '#1a5276' (dark teal) */
  parentColor?: string;
  /** Enable drag interactions. Default: true */
  dragEnabled?: boolean;
  /** Auto-scroll near viewport edges during drag. Default: true */
  autoScroll?: boolean;
  /** Distance from edge to trigger auto-scroll (px). Default: 100 */
  autoScrollThreshold?: number;
  /** Column id prefix that identifies date columns for Gantt rendering. Default: 'm_' */
  dateColumnPrefix?: string;
  /** Field name on row for the start column index. Default: 'startColumn' */
  startColumnField?: string;
  /** Field name on row for the end column index. Default: 'endColumn' */
  endColumnField?: string;
  /** Field name on row for variance (positive=ahead, negative=late). Default: 'variance' */
  varianceField?: string;
  /** Background color for parent (group) row gantt cells. Default: undefined (no override) */
  parentRowBackground?: string;
  /**
   * Field names for start date, duration, and end date on the row data.
   * When set, drag updates these fields (End auto-calculated from Start + Duration).
   */
  startDateField?: string;
  durationField?: string;
  endDateField?: string;
  /**
   * Convert a column index to a date string (for updating startDateField/endDateField).
   * E.g. (colIndex) => '2025-07-01'
   */
  columnToDate?: (colIndex: number) => string;
  /**
   * Calculate duration in months between two column indices.
   * Default: endCol - startCol + 1
   */
  columnsToDuration?: (startCol: number, endCol: number) => number;
  /**
   * Format a date string for tooltip display.
   * Receives the raw value from startDateField/endDateField.
   * Default: returns the raw string as-is.
   */
  formatDate?: (dateStr: string) => string;
}

export interface GanttApi {
  /** Currently dragging row index, or null */
  getDragState(): GanttDragState | null;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type DragType = 'move' | 'resize-start' | 'resize-end';
type SegmentType = 'start' | 'middle' | 'end' | 'full';

interface GanttDragState {
  rowIndex: number;
  dragType: DragType;
  originalStartCol: number;
  originalEndCol: number;
  currentColumnShift: number;
  initialMouseX: number;
  columnWidth: number;
  initialScrollLeft: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVarianceColor(
  variance: number | undefined,
  colors: { neutral: string; ahead: string; late: string },
): string {
  if (variance === undefined || variance === 0) return colors.neutral;
  return variance > 0 ? colors.ahead : colors.late;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export function gantt(options?: GanttOptions): GridPlugin<'gantt'> {
  const barHeightFrac = options?.barHeight ?? 0.5;
  const colors = {
    neutral: options?.colors?.neutral ?? '#2BBDEE',
    ahead: options?.colors?.ahead ?? '#009856',
    late: options?.colors?.late ?? '#fb4c4d',
  };
  const dragEnabled = options?.dragEnabled ?? true;
  const autoScroll = options?.autoScroll ?? true;
  const autoScrollThreshold = options?.autoScrollThreshold ?? 100;
  const parentColor = options?.parentColor ?? '#1a5276';
  const dateColumnPrefix = options?.dateColumnPrefix ?? 'm_';
  const startColumnField = options?.startColumnField ?? 'startColumn';
  const endColumnField = options?.endColumnField ?? 'endColumn';
  const varianceField = options?.varianceField ?? 'variance';
  const parentRowBackground = options?.parentRowBackground;
  const fmtDate = options?.formatDate ?? ((s: string) => s);
  const startDateFld = options?.startDateField ?? 'start';
  const endDateFld = options?.endDateField ?? 'end';
  const durFld = options?.durationField ?? 'duration';

  /** Build tooltip text from row data */
  function tooltipText(row: Record<string, unknown>): string {
    const s = fmtDate(row[startDateFld] as string || '');
    const e = fmtDate(row[endDateFld] as string || '');
    const d = row[durFld] as number | null;
    if (!s && !e) return '';
    return `${s} – ${e}${d != null ? ` (${d} months)` : ''}`;
  }

  return {
    id: 'gantt',
    init(ctx: PluginContext) {
      let dragState: GanttDragState | null = null;
      let overlayEl: HTMLElement | null = null;
      let scrollInterval: number | null = null;
      let totalScrollDelta = 0;

      // ─── Drag overlay ─��─────────────────────────────────────────────
      function createOverlay(): HTMLElement {
        const el = document.createElement('div');
        el.className = 'bg-gantt-overlay';
        el.style.position = 'fixed';
        el.style.zIndex = '9999';
        el.style.pointerEvents = 'none';
        el.style.borderRadius = '4px';
        el.style.opacity = '0.35';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        el.style.transition = 'width 80ms ease-out';
        document.body.appendChild(el);
        return el;
      }

      function removeOverlay(): void {
        if (overlayEl) {
          overlayEl.remove();
          overlayEl = null;
        }
      }

      // ─── Auto-scroll ───────────────────────────────────────────────
      function startAutoScroll(direction: 'left' | 'right'): void {
        stopAutoScroll();
        const gridContainer = ctx.grid.getContainer();
        const scrollEl = gridContainer?.querySelector('.bg-grid__scroll') as HTMLElement | null;
        if (!scrollEl || !dragState) return;

        const colW = dragState.columnWidth;
        const speed = colW * 0.15;

        scrollInterval = window.setInterval(() => {
          if (!dragState) { stopAutoScroll(); return; }
          const delta = direction === 'left' ? -speed : speed;
          scrollEl.scrollLeft = Math.max(0, scrollEl.scrollLeft + delta);
          totalScrollDelta += delta;
        }, 16);
      }

      function stopAutoScroll(): void {
        if (scrollInterval !== null) {
          clearInterval(scrollInterval);
          scrollInterval = null;
        }
      }

      // ─── Drag handlers (document-level) ─────────────────────────────
      function onMouseMove(e: MouseEvent): void {
        if (!dragState || !overlayEl) return;

        const mouseDelta = e.clientX - dragState.initialMouseX;
        const totalDelta = mouseDelta + totalScrollDelta;
        const columnShift = Math.round(totalDelta / dragState.columnWidth);

        // Constrain based on drag type
        let finalShift = columnShift;
        const span = dragState.originalEndCol - dragState.originalStartCol;

        if (dragState.dragType === 'resize-start') {
          finalShift = Math.min(columnShift, span); // can't go past end
        } else if (dragState.dragType === 'resize-end') {
          finalShift = Math.max(columnShift, -span); // can't go past start
        }

        dragState.currentColumnShift = finalShift;

        // Update overlay position & size
        const barW = (span + 1) * dragState.columnWidth;
        let overlayW = barW;
        let overlayLeft = parseFloat(overlayEl.dataset.origLeft ?? '0');

        if (dragState.dragType === 'move') {
          overlayLeft += finalShift * dragState.columnWidth;
        } else if (dragState.dragType === 'resize-start') {
          overlayLeft += finalShift * dragState.columnWidth;
          overlayW = Math.max(dragState.columnWidth * 0.5, barW - finalShift * dragState.columnWidth);
        } else if (dragState.dragType === 'resize-end') {
          overlayW = Math.max(dragState.columnWidth * 0.5, barW + finalShift * dragState.columnWidth);
        }

        overlayEl.style.left = `${overlayLeft}px`;
        overlayEl.style.width = `${overlayW}px`;

        // Auto-scroll detection
        if (autoScroll) {
          const gridContainer = ctx.grid.getContainer();
          if (gridContainer) {
            const rect = gridContainer.getBoundingClientRect();
            const fromLeft = e.clientX - rect.left;
            const fromRight = rect.right - e.clientX;
            if (fromLeft < autoScrollThreshold) {
              startAutoScroll('left');
            } else if (fromRight < autoScrollThreshold) {
              startAutoScroll('right');
            } else {
              stopAutoScroll();
            }
          }
        }
      }

      function onMouseUp(): void {
        if (!dragState) return;

        stopAutoScroll();
        const { dragType, originalStartCol, originalEndCol, currentColumnShift, rowIndex } = dragState;

        if (currentColumnShift !== 0) {
          let newStart = originalStartCol;
          let newEnd = originalEndCol;

          if (dragType === 'move') {
            newStart += currentColumnShift;
            newEnd += currentColumnShift;
          } else if (dragType === 'resize-start') {
            newStart += currentColumnShift;
          } else if (dragType === 'resize-end') {
            newEnd += currentColumnShift;
          }

          // Clamp to >= 0
          newStart = Math.max(0, newStart);
          newEnd = Math.max(newStart, newEnd);

          // Emit event for consumer to handle
          (ctx.emit as Function)('gantt:dragEnd', {
            rowIndex,
            startColumn: newStart,
            endColumn: newEnd,
            dragType,
          });

          // Update the row data directly — mutate data array and notify store
          const visibleData = ctx.grid.getData();
          const rowData = visibleData[rowIndex] as Record<string, unknown> | undefined;
          if (rowData) {
            // Update column indices on the row object
            rowData[startColumnField] = newStart;
            rowData[endColumnField] = newEnd;

            // Update date/duration fields if configured
            if (options?.columnToDate) {
              const startDateFld = options.startDateField ?? 'start';
              const endDateFld = options.endDateField ?? 'end';
              const durFld = options.durationField ?? 'duration';
              rowData[startDateFld] = options.columnToDate(newStart);
              rowData[endDateFld] = options.columnToDate(newEnd);
              rowData[durFld] = options.columnsToDuration
                ? options.columnsToDuration(newStart, newEnd)
                : newEnd - newStart + 1;
            }

            // Update cells that have corresponding columns (for display refresh)
            const cols = ctx.grid.getColumns();
            for (const col of cols) {
              if (col.accessorKey && col.accessorKey in rowData) {
                const val = rowData[col.accessorKey];
                if (val !== undefined) {
                  ctx.grid.updateCell(rowIndex, col.id, val);
                }
              }
            }
          }
        }

        dragState = null;
        totalScrollDelta = 0;
        removeOverlay();
        document.body.classList.remove('bg-gantt-dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Force re-render so bars reflect updated data
        ctx.grid.refresh();
      }

      // ─── Start drag from cell ──────────────────────────────────────
      function startDrag(
        e: MouseEvent,
        rowIndex: number,
        colIndex: number,
        dragType: DragType,
        cellEl: HTMLElement,
        row: unknown,
        variance: number | undefined,
      ): void {
        e.preventDefault();
        e.stopPropagation();

        const rec = row as Record<string, unknown>;
        const startCol = rec[startColumnField] as number;
        const endCol = rec[endColumnField] as number;
        if (startCol == null || endCol == null) return;

        const cellRect = cellEl.getBoundingClientRect();
        const columnWidth = cellRect.width;

        // Calculate bar's full visual rect
        const barSpan = endCol - startCol + 1;
        const barLeft = cellRect.left - (colIndex - startCol) * columnWidth;
        const barTop = cellRect.top + cellRect.height * ((1 - barHeightFrac) / 2);
        const barHeight = cellRect.height * barHeightFrac;
        const barWidth = barSpan * columnWidth;

        const gridContainer = ctx.grid.getContainer();
        const scrollEl = gridContainer?.querySelector('.bg-grid__scroll') as HTMLElement | null;

        dragState = {
          rowIndex,
          dragType,
          originalStartCol: startCol,
          originalEndCol: endCol,
          currentColumnShift: 0,
          initialMouseX: e.clientX,
          columnWidth,
          initialScrollLeft: scrollEl?.scrollLeft ?? 0,
        };
        totalScrollDelta = 0;

        // Create overlay
        overlayEl = createOverlay();
        overlayEl.style.left = `${barLeft}px`;
        overlayEl.style.top = `${barTop}px`;
        overlayEl.style.width = `${barWidth}px`;
        overlayEl.style.height = `${barHeight}px`;
        overlayEl.style.backgroundColor = getVarianceColor(variance, colors);
        overlayEl.dataset.origLeft = String(barLeft);

        document.body.classList.add('bg-gantt-dragging');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }

      // ─── Date column index cache ────────────────────────────────────
      // Built once on first render, rebuilt if columns change.
      let cachedDateColMap: Map<string, number> | null = null;
      let cachedColCount = 0;

      function getDateColIndex(colId: string): number {
        const allCols = ctx.grid.getColumns();
        if (!cachedDateColMap || allCols.length !== cachedColCount) {
          cachedDateColMap = new Map();
          cachedColCount = allCols.length;
          let idx = 0;
          for (const c of allCols) {
            if (c.id.startsWith(dateColumnPrefix)) {
              cachedDateColMap.set(c.id, idx++);
            }
          }
        }
        return cachedDateColMap.get(colId) ?? -1;
      }

      // ─── Gantt cell renderer ───────────────────────────────────────
      const ganttRenderer: CellTypeRenderer = {
        render(container: HTMLElement, context: CellRenderContext): void | (() => void) {
          // Reset gantt cell — clean slate
          container.textContent = '';
          container.style.padding = '0';
          container.style.borderRight = 'none';
          container.style.borderBottom = 'none';
          container.style.overflow = 'hidden';
          container.style.display = 'block';
          container.style.lineHeight = 'normal';

          const row = context.row as Record<string, unknown>;
          const startCol = row[startColumnField] as number | undefined;
          const endCol = row[endColumnField] as number | undefined;

          if (startCol == null || endCol == null) return;

          // Determine which date column index this cell is
          const colId = context.column.id;
          if (!colId.startsWith(dateColumnPrefix)) return;

          const dateColIndex = getDateColIndex(colId);
          if (dateColIndex < 0) return;

          // Detect parent row early (needed for background on ALL gantt cells, not just bar cells)
          const hierarchyState = ctx.grid.getState().hierarchyState;
          let isParentRow = false;
          if (hierarchyState) {
            const dataIndex = hierarchyState.visibleRows[context.rowIndex] ?? context.rowIndex;
            const rowId = hierarchyState.dataIndexToRowId.get(dataIndex) ?? -1;
            isParentRow = hierarchyState.parentIds.has(rowId);
          }

          // Apply parent row background to all gantt cells (including empty ones outside bar range)
          if (isParentRow && parentRowBackground) {
            container.style.backgroundColor = parentRowBackground;
          }

          // Is this cell within the bar range?
          if (dateColIndex < startCol || dateColIndex > endCol) return;

          // Bar cells: allow overflow for seamless multi-cell bars
          container.style.overflow = 'visible';

          const isStart = dateColIndex === startCol;
          const isEnd = dateColIndex === endCol;
          let segmentType: SegmentType;
          if (isStart && isEnd) segmentType = 'full';
          else if (isStart) segmentType = 'start';
          else if (isEnd) segmentType = 'end';
          else segmentType = 'middle';

          const variance = row[varianceField] as number | undefined;

          const barColor = isParentRow ? parentColor : getVarianceColor(variance, colors);
          const barH = Math.round(context.style.height * barHeightFrac);
          const barTop = Math.round((context.style.height - barH) / 2);

          // Create bar element — uses exact pixel sizing for crisp rendering
          const bar = document.createElement('div');
          bar.className = 'bg-gantt-bar';
          bar.style.position = 'absolute';
          bar.style.left = '-1px';
          bar.style.top = `${barTop}px`;
          // Width: 100% + 2px to cover cell borders seamlessly (matches Wiseway)
          bar.style.width = `calc(100% + 2px)`;
          bar.style.height = `${barH}px`;
          bar.style.backgroundColor = barColor;
          bar.style.pointerEvents = 'none';
          bar.style.zIndex = '1';

          // Rounded corners based on segment
          const radius = Math.min(4, barH / 2);
          if (segmentType === 'start' || segmentType === 'full') {
            bar.style.borderTopLeftRadius = `${radius}px`;
            bar.style.borderBottomLeftRadius = `${radius}px`;
          }
          if (segmentType === 'end' || segmentType === 'full') {
            bar.style.borderTopRightRadius = `${radius}px`;
            bar.style.borderBottomRightRadius = `${radius}px`;
            bar.style.width = 'calc(100% + 1px)'; // end: don't extend past last cell border
          }

          container.appendChild(bar);

          // Parent rows: tooltip only (no drag)
          if (isParentRow || !dragEnabled) {
            const hoverLayer = document.createElement('div');
            hoverLayer.style.position = 'absolute';
            hoverLayer.style.left = '-1px';
            hoverLayer.style.top = `${barTop}px`;
            hoverLayer.style.width = `calc(100% + 2px)`;
            hoverLayer.style.height = `${barH}px`;
            hoverLayer.style.zIndex = '2';
            hoverLayer.style.cursor = 'default';
            hoverLayer.addEventListener('mouseenter', (e) => {
              if (document.body.classList.contains('bg-gantt-dragging')) return;
              const text = tooltipText(row as Record<string, unknown>);
              if (text) ctx.showTooltip(hoverLayer, text, e.clientX, e.clientY);
            });
            hoverLayer.addEventListener('mouseleave', () => { ctx.dismissTooltip(); });
            container.appendChild(hoverLayer);
            return;
          }

          // Interactive overlay (for drag)
          const interactive = document.createElement('div');
          interactive.className = 'bg-gantt-interactive';
          interactive.style.position = 'absolute';
          interactive.style.left = '-1px';
          interactive.style.top = `${barTop}px`;
          interactive.style.width = `calc(100% + 2px)`;
          interactive.style.height = `${barH}px`;
          interactive.style.cursor = 'move';
          interactive.style.zIndex = '2';
          interactive.style.opacity = '0';
          interactive.style.transition = 'opacity 100ms';

          interactive.addEventListener('mouseenter', (e) => {
            if (document.body.classList.contains('bg-gantt-dragging')) return;
            interactive.style.opacity = '0.3';
            interactive.style.backgroundColor = '#fff';
            const text = tooltipText(row as Record<string, unknown>);
            if (text) ctx.showTooltip(interactive, text, e.clientX, e.clientY);
          });
          interactive.addEventListener('mouseleave', () => {
            interactive.style.opacity = '0';
            ctx.dismissTooltip();
            interactive.style.backgroundColor = '';
          });

          // Move handler (click on bar middle)
          const onBarMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).classList.contains('bg-gantt-handle')) return;
            startDrag(e, context.rowIndex, dateColIndex, 'move', container, row, variance);
          };
          interactive.addEventListener('mousedown', onBarMouseDown);

          container.appendChild(interactive);

          // Resize handles (only on start/end segments)
          const cleanupFns: (() => void)[] = [];

          if (segmentType === 'start' || segmentType === 'full') {
            const handle = document.createElement('div');
            handle.className = 'bg-gantt-handle bg-gantt-handle-start';
            handle.style.position = 'absolute';
            handle.style.left = '-4px';
            handle.style.top = `${barTop}px`;
            handle.style.width = '12px';
            handle.style.height = `${barH}px`;
            handle.style.cursor = 'ew-resize';
            handle.style.zIndex = '3';
            handle.style.borderRadius = `${radius}px 0 0 ${radius}px`;

            handle.addEventListener('mouseenter', () => {
              handle.style.backgroundColor = 'rgba(255,255,255,0.8)';
            });
            handle.addEventListener('mouseleave', () => {
              handle.style.backgroundColor = '';
            });

            const onStartResize = (e: MouseEvent) => {
              startDrag(e, context.rowIndex, dateColIndex, 'resize-start', container, row, variance);
            };
            handle.addEventListener('mousedown', onStartResize);
            container.appendChild(handle);

            cleanupFns.push(() => {
              handle.removeEventListener('mousedown', onStartResize);
            });
          }

          if (segmentType === 'end' || segmentType === 'full') {
            const handle = document.createElement('div');
            handle.className = 'bg-gantt-handle bg-gantt-handle-end';
            handle.style.position = 'absolute';
            handle.style.right = '-4px';
            handle.style.top = `${barTop}px`;
            handle.style.width = '12px';
            handle.style.height = `${barH}px`;
            handle.style.cursor = 'ew-resize';
            handle.style.zIndex = '3';
            handle.style.borderRadius = `0 ${radius}px ${radius}px 0`;

            handle.addEventListener('mouseenter', () => {
              handle.style.backgroundColor = 'rgba(255,255,255,0.8)';
            });
            handle.addEventListener('mouseleave', () => {
              handle.style.backgroundColor = '';
            });

            const onEndResize = (e: MouseEvent) => {
              startDrag(e, context.rowIndex, dateColIndex, 'resize-end', container, row, variance);
            };
            handle.addEventListener('mousedown', onEndResize);
            container.appendChild(handle);

            cleanupFns.push(() => {
              handle.removeEventListener('mousedown', onEndResize);
            });
          }

          return () => {
            interactive.removeEventListener('mousedown', onBarMouseDown);
            for (const fn of cleanupFns) fn();
          };
        },

        getStringValue(context: CellRenderContext): string {
          const row = context.row as Record<string, unknown>;
          const startCol = row[startColumnField] as number | undefined;
          const endCol = row[endColumnField] as number | undefined;
          if (startCol == null || endCol == null) return '';

          const colId = context.column.id;
          if (!colId.startsWith(dateColumnPrefix)) return '';

          const dateColIndex = getDateColIndex(colId);
          if (dateColIndex >= startCol && dateColIndex <= endCol) return '\u2588'; // block char
          return '';
        },
      };

      const unreg = ctx.registerCellType('gantt', ganttRenderer);

      // Expose API
      ctx.expose({
        getDragState: () => dragState,
      });

      // Inject global styles for gantt cells and drag cursor
      const style = document.createElement('style');
      style.id = 'bg-gantt-drag-style';
      style.textContent = `
        .bg-gantt-dragging { cursor: move !important; }
        .bg-gantt-dragging * { cursor: move !important; user-select: none !important; pointer-events: none !important; }
        .bg-gantt-dragging .bg-gantt-overlay { pointer-events: none !important; }
        .bg-cell:has(.bg-gantt-bar) { overflow: visible !important; padding: 0 !important; border-right-color: transparent !important; border-bottom-color: transparent !important; display: block !important; }
      `;
      if (!document.getElementById('bg-gantt-drag-style')) {
        document.head.appendChild(style);
      }

      return () => {
        unreg();
        cachedDateColMap = null;
        stopAutoScroll();
        removeOverlay();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    },
  };
}
