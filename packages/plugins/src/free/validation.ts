// ============================================================================
// Validation Plugin — Cell validation with visual error indicators
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition } from '@better-grid/core';
import { getCellValue } from '@better-grid/core';

/** Context passed to a validation messageRenderer. */
export interface ValidationIssue<TData = unknown> {
  message: string;
  code: ValidationErrorCode;
  position: CellPosition;
  row: TData;
  value: unknown;
  column: import('@better-grid/core').ColumnDef<TData>;
}

/**
 * Custom renderer for an error message body. Return an HTMLElement (e.g. an
 * MUI Alert mounted into a detached div) or a plain string. The renderer
 * replaces the tooltip's text node — the tooltip wrapper still provides
 * positioning and z-index.
 */
export type ValidationMessageRenderer<TData = unknown> = (
  issue: ValidationIssue<TData>,
) => HTMLElement | string;

/** Validation rule for a column */
export interface ColumnValidationRule<TData = unknown> {
  /** Return true if valid, or an error message string if invalid */
  validate: (value: unknown, row: TData) => boolean | string;
  /** Fallback error message when validate returns false */
  message?: string;
  /**
   * Custom renderer for this rule's error. Wins over the column-level
   * `validationMessageRenderer`. Use to render rich UI (icons, links, MUI
   * Alert) inside the tooltip.
   */
  messageRenderer?: ValidationMessageRenderer<TData>;
}

declare module '@better-grid/core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnDef<TData = unknown> {
    required?: boolean;
    rules?: ColumnValidationRule<TData>[];
    /**
     * Default renderer for any validation error on this column. Overridden by
     * a per-rule `messageRenderer`. Useful when you want the same look across
     * all rules on a column (e.g. always render an MUI Alert).
     */
    validationMessageRenderer?: ValidationMessageRenderer<TData>;
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
      // Internal entry holds the public ValidationError + optional renderer
      // context so applyErrorStyles can pick it up later.
      type InternalEntry = ValidationError & {
        renderer?: ValidationMessageRenderer;
        row?: unknown;
        value?: unknown;
        column?: import('@better-grid/core').ColumnDef;
      };
      const errors = new Map<string, InternalEntry>();

      // Map from tooltip key → { tooltip element, anchor cell element }
      type TooltipRecord = { el: HTMLElement; anchor: HTMLElement };
      const tooltipRecords = new Map<string, TooltipRecord>();

      /** The per-grid tooltip layer element. Created on first mount. */
      let tooltipLayer: HTMLElement | null = null;

      function positionKey(pos: CellPosition): string {
        return `${pos.rowIndex}:${pos.colIndex}`;
      }

      type CellFailure = {
        message: string;
        code: ValidationErrorCode;
        renderer?: ValidationMessageRenderer;
        row: unknown;
        value: unknown;
        column: import('@better-grid/core').ColumnDef;
      };

      function validateCell(position: CellPosition): CellFailure | null {
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        if (!column) return null;

        const row = state.data[position.rowIndex];
        const value = getCellValue(row, column, position.rowIndex);
        const colRenderer = column.validationMessageRenderer;

        if (column.required && (value == null || value === '')) {
          return {
            message: 'This field is required',
            code: VALIDATION_ERROR_CODES.REQUIRED_FIELD,
            renderer: colRenderer,
            row, value, column,
          };
        }

        if (!column.rules || column.rules.length === 0) return null;

        for (const rule of column.rules) {
          const result = rule.validate(value, row);
          if (result === false) {
            return {
              message: rule.message ?? 'Invalid value',
              code: VALIDATION_ERROR_CODES.VALIDATION_FAILED,
              renderer: rule.messageRenderer ?? colRenderer,
              row, value, column,
            };
          }
          if (typeof result === 'string') {
            return {
              message: result,
              code: VALIDATION_ERROR_CODES.VALIDATION_FAILED,
              renderer: rule.messageRenderer ?? colRenderer,
              row, value, column,
            };
          }
        }

        return null;
      }

      // Inject error border CSS once (shared across all grid instances)
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
          .bg-validation-tooltip-layer {
            position: absolute;
            pointer-events: none;
            overflow: hidden;
            z-index: 20;
          }
          .bg-validation-tooltip {
            position: absolute;
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

      // ---------------------------------------------------------------------------
      // Tooltip layer management
      // ---------------------------------------------------------------------------

      /**
       * Ensure the tooltip layer exists inside the grid container and is sized to
       * the "body region" — below the header, above pinned-bottom, right of the
       * frozen-col overlay. overflow:hidden on the layer clips any tooltip whose
       * anchor has scrolled into a chrome zone.
       */
      function ensureTooltipLayer(): HTMLElement {
        const gridEl = ctx.grid.getContainer();
        if (!gridEl) throw new Error('Grid not mounted');

        if (!tooltipLayer || !gridEl.contains(tooltipLayer)) {
          // Create fresh layer
          tooltipLayer = document.createElement('div');
          tooltipLayer.className = 'bg-validation-tooltip-layer';
          // Set critical layout/clip styles inline so they are programmatically
          // testable and work even when the <style> injection is deduped/skipped.
          tooltipLayer.style.position = 'absolute';
          tooltipLayer.style.overflow = 'hidden';
          tooltipLayer.style.pointerEvents = 'none';
          tooltipLayer.style.zIndex = '20';
          gridEl.appendChild(tooltipLayer);
        }

        return tooltipLayer;
      }

      /**
       * Recompute layer geometry from the grid's current DOM chrome elements.
       * Called after every render so the layer stays in sync with header/pinned
       * heights and frozen-col widths.
       */
      function updateLayerGeometry(): void {
        const gridEl = ctx.grid.getContainer();
        if (!gridEl || !tooltipLayer) return;

        const gridRect = gridEl.getBoundingClientRect();

        // Top boundary: bottom of the header row
        const headerEl = gridEl.querySelector('.bg-grid__headers') as HTMLElement | null;
        const headerBottom = headerEl
          ? headerEl.getBoundingClientRect().bottom - gridRect.top
          : 0;

        // Left boundary: right edge of the frozen column overlay (if present)
        const frozenEl = gridEl.querySelector('.bg-grid__frozen-overlay') as HTMLElement | null;
        const frozenRight = frozenEl
          ? frozenEl.getBoundingClientRect().right - gridRect.left
          : 0;

        // Bottom boundary: top of the pinned-bottom wrapper (if non-zero height)
        const pinnedBottomEl = gridEl.querySelector('.bg-grid__pinned-bottom') as HTMLElement | null;
        let bottomOffset = 0;
        if (pinnedBottomEl) {
          const h = pinnedBottomEl.getBoundingClientRect().height;
          if (h > 0) {
            bottomOffset = gridRect.height - (pinnedBottomEl.getBoundingClientRect().top - gridRect.top);
          }
        }

        tooltipLayer.style.top = `${headerBottom}px`;
        tooltipLayer.style.left = `${frozenRight}px`;
        tooltipLayer.style.right = '0';
        tooltipLayer.style.bottom = `${bottomOffset}px`;
      }

      // ---------------------------------------------------------------------------
      // Tooltip creation & positioning
      // ---------------------------------------------------------------------------

      function dismissValidationTooltips(): void {
        for (const record of tooltipRecords.values()) {
          record.el.remove();
        }
        tooltipRecords.clear();
      }

      /**
       * Position (or reposition) a single tooltip relative to the tooltip layer.
       * The tooltip is absolutely positioned inside the layer; the layer's
       * overflow:hidden automatically clips tooltips whose anchors scroll under
       * chrome zones.
       */
      function positionTooltip(tooltipEl: HTMLElement, anchorEl: HTMLElement): void {
        if (!tooltipLayer) return;

        const layerRect = tooltipLayer.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();

        // Position tooltip below the anchor cell, relative to layer origin
        const left = anchorRect.left - layerRect.left;
        const top = anchorRect.bottom - layerRect.top + 4;

        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
      }

      /** Reposition all visible tooltips (called on scroll). */
      function repositionAllTooltips(): void {
        if (!tooltipLayer || tooltipRecords.size === 0) return;
        for (const record of tooltipRecords.values()) {
          positionTooltip(record.el, record.anchor);
        }
      }

      function buildTooltipContent(tooltip: HTMLElement, entry: InternalEntry): void {
        if (entry.renderer && entry.column) {
          const issue: ValidationIssue = {
            message: entry.message,
            code: entry.code,
            position: entry.position,
            row: entry.row,
            value: entry.value,
            column: entry.column,
          };
          const result = entry.renderer(issue);
          if (typeof result === 'string') {
            const text = document.createElement('p');
            text.className = 'bg-validation-tooltip__text';
            text.textContent = result;
            tooltip.appendChild(text);
          } else {
            tooltip.classList.add('bg-validation-tooltip--custom');
            tooltip.appendChild(result);
          }
        } else {
          const text = document.createElement('p');
          text.className = 'bg-validation-tooltip__text';
          text.textContent = entry.message;
          tooltip.appendChild(text);
        }
      }

      function showValidationTooltip(key: string, anchorEl: HTMLElement, entry: InternalEntry): void {
        const layer = ensureTooltipLayer();
        updateLayerGeometry();

        const tooltip = document.createElement('div');
        tooltip.className = 'bg-validation-tooltip';
        buildTooltipContent(tooltip, entry);
        layer.appendChild(tooltip);
        positionTooltip(tooltip, anchorEl);

        tooltipRecords.set(key, { el: tooltip, anchor: anchorEl });
      }

      // Track hover listeners for cleanup
      const hoverCleanups = new Map<HTMLElement, () => void>();

      function applyErrorStyles(): void {
        dismissValidationTooltips();

        // Scope all cell queries to THIS grid's container so two grids on the
        // same page don't clobber each other's error styles (Pattern A fix).
        const gridEl = ctx.grid.getContainer();
        if (!gridEl) return;

        // Remove existing error styles and hover listeners
        gridEl.querySelectorAll('.bg-cell--error').forEach((el) => {
          el.classList.remove('bg-cell--error');
          const cleanup = hoverCleanups.get(el as HTMLElement);
          if (cleanup) { cleanup(); hoverCleanups.delete(el as HTMLElement); }
        });

        // Ensure layer exists and geometry is current before creating tooltips
        if (errors.size > 0) {
          ensureTooltipLayer();
          updateLayerGeometry();
        }

        // Apply error styles and tooltip hover to cells with errors
        for (const error of errors.values()) {
          const { rowIndex, colIndex } = error.position;
          const cells = gridEl.querySelectorAll(
            `.bg-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`,
          );
          for (const cell of cells) {
            cell.classList.add('bg-cell--error');
            const htmlCell = cell as HTMLElement;
            const anchor = htmlCell.querySelector('.bg-input-box') as HTMLElement | null ?? htmlCell;

            const key = positionKey(error.position);
            // Only show one tooltip per error position (first cell rendered wins)
            if (!tooltipRecords.has(key)) {
              showValidationTooltip(key, anchor, error);
            }

            const onEnter = () => {
              if (!tooltipRecords.has(key)) {
                showValidationTooltip(key, anchor, error);
              }
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

      function publicError(entry: InternalEntry): ValidationError {
        return { position: entry.position, message: entry.message, code: entry.code };
      }

      const api: ValidationApi = {
        validate(position) {
          if (position) {
            const failure = validateCell(position);
            const key = positionKey(position);
            if (failure) {
              const entry: InternalEntry = { position, ...failure };
              errors.set(key, entry);
              return [publicError(entry)];
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
                const entry: InternalEntry = { position: pos, ...failure };
                errors.set(positionKey(pos), entry);
                allErrors.push(publicError(entry));
              }
            }
          }
          return allErrors;
        },
        getErrors: () => [...errors.values()].map(publicError),
        clearErrors: () => {
          errors.clear();
          applyErrorStyles();
        },
        isValid: () => errors.size === 0,
      };

      // Auto-validate on data change (after edit commit)
      const unsubData = ctx.on('cell:change', (changes) => {
        for (const change of changes) {
          const colIndex = ctx.grid.getState().columns.findIndex((c) => c.id === change.columnId);
          if (colIndex >= 0) {
            validateAndRender({ rowIndex: change.rowIndex, colIndex });
          }
        }
      });

      // Re-apply error styles after render (cells get recreated by virtualization)
      // Also update layer geometry and reposition tooltips so they track scroll.
      const unsubRender = ctx.on('render', () => {
        if (errors.size > 0) {
          applyErrorStyles();
        }
      });

      // Reposition tooltips on scroll without a full applyErrorStyles pass.
      const unsubScroll = ctx.on('scroll', () => {
        if (tooltipLayer && tooltipRecords.size > 0) {
          repositionAllTooltips();
        }
      });

      // Validate all on init if configured. Fire on the first render event so
      // that cell elements exist in the DOM before applyErrorStyles() queries them.
      // The previous setTimeout(0) caused a StrictMode double-mount race where
      // both deferred callbacks fired after the first cleanup ran, resulting in
      // double validation with stale cell refs (Pattern B fix).
      let unsubFirstRender: (() => void) | null = null;
      if (config.validateOn === 'all') {
        unsubFirstRender = ctx.on('render', () => {
          // Self-unsubscribe after first fire so subsequent renders don't re-run
          // the full validate() scan (the unsubRender handler above covers re-renders).
          unsubFirstRender?.();
          unsubFirstRender = null;
          validateAndRender();
        });
      }

      ctx.expose(api);

      return () => {
        unsubFirstRender?.();
        unsubData();
        unsubRender();
        unsubScroll();
        errors.clear();
        dismissValidationTooltips();
        if (tooltipLayer) {
          tooltipLayer.remove();
          tooltipLayer = null;
        }
        for (const cleanup of hoverCleanups.values()) cleanup();
        hoverCleanups.clear();
      };
    },
  };
}
