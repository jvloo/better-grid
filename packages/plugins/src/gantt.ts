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
        el.style.opacity = '0.7';
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
          ctx.emit('gantt:dragEnd' as keyof never, {
            rowIndex,
            startColumn: newStart,
            endColumn: newEnd,
            dragType,
          } as never);

          // Also update the row data directly
          const data = ctx.grid.getData();
          const row = data[rowIndex];
          if (row) {
            ctx.grid.updateCell(rowIndex, startColumnField, newStart);
            ctx.grid.updateCell(rowIndex, endColumnField, newEnd);
          }
        }

        dragState = null;
        totalScrollDelta = 0;
        removeOverlay();
        document.body.classList.remove('bg-gantt-dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
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

      // ─── Gantt cell renderer ───────────────────────────────────────
      const ganttRenderer: CellTypeRenderer = {
        render(container: HTMLElement, context: CellRenderContext): void | (() => void) {
          container.textContent = '';

          // Override cell styles so the bar can bleed across cell boundaries
          container.style.position = 'relative';
          container.style.overflow = 'visible';
          container.style.padding = '0';
          container.style.lineHeight = 'normal';
          container.style.borderRight = 'none';
          container.style.borderBottom = 'none';

          const row = context.row as Record<string, unknown>;
          const startCol = row[startColumnField] as number | undefined;
          const endCol = row[endColumnField] as number | undefined;

          if (startCol == null || endCol == null) return;

          // Determine which date column index this cell is
          const colId = context.column.id;
          if (!colId.startsWith(dateColumnPrefix)) return;

          // Build date column index (cached on grid columns)
          const allCols = ctx.grid.getColumns();
          const dateColIds: string[] = [];
          for (const c of allCols) {
            if (c.id.startsWith(dateColumnPrefix)) dateColIds.push(c.id);
          }
          const dateColIndex = dateColIds.indexOf(colId);
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

          // Skip interaction layer if drag disabled or parent row in hierarchy
          if (!dragEnabled || isParentRow) return;

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

          interactive.addEventListener('mouseenter', () => {
            interactive.style.opacity = '0.3';
            interactive.style.backgroundColor = '#fff';
          });
          interactive.addEventListener('mouseleave', () => {
            interactive.style.opacity = '0';
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

          const allCols = ctx.grid.getColumns();
          const dateColIds: string[] = [];
          for (const c of allCols) {
            if (c.id.startsWith(dateColumnPrefix)) dateColIds.push(c.id);
          }
          const dateColIndex = dateColIds.indexOf(colId);
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
        .bg-gantt-dragging * { cursor: move !important; user-select: none !important; }
        .bg-cell:has(.bg-gantt-bar) { overflow: visible !important; padding: 0 !important; border-right-color: transparent !important; border-bottom-color: transparent !important; display: block !important; }
      `;
      if (!document.getElementById('bg-gantt-drag-style')) {
        document.head.appendChild(style);
      }

      return () => {
        unreg();
        stopAutoScroll();
        removeOverlay();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
    },
  };
}
