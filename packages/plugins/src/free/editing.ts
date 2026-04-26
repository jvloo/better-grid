// ============================================================================
// Editing Plugin — Cell editing with text input & dropdown support
// ============================================================================

import type { GridPlugin, PluginContext, CellPosition, ColumnDef, CellRenderContext } from '@better-grid/core';

export interface SelectInputConfig<TData = unknown> {
  /** Select option value that reveals the sibling input. */
  optionValue: unknown;
  /** Input flavor shown next to the selected option. Default: 'number'. */
  type?: 'number' | 'text';
  /** Prefix shown inside the input, pinned to the left edge, e.g. '$'. */
  prefix?: string | ((row: TData) => string | undefined);
  /** Suffix shown after the input, e.g. '%'. */
  suffix?: string | ((row: TData) => string | undefined);
  /** Alias for suffix. Prefer `suffix` for new columns. */
  unit?: string | ((row: TData) => string | undefined);
  /** Width in px for the sibling input. Default: 60. */
  width?: number;
  /** Default sibling input value when switching into the input option. */
  defaultValue?: string | number;
  min?: number | ((row: TData) => number | undefined);
  max?: number | ((row: TData) => number | undefined);
  precision?: number | ((row: TData) => number | undefined);
}

export interface SelectWithInputValue<TData = unknown> {
  optionValue: unknown;
  inputValue: string | number;
  row: TData;
  column: ColumnDef<TData>;
  previousValue: unknown;
}

export type InputCellBoolean<TData = unknown> =
  | boolean
  | ((row: TData, column: ColumnDef<TData>) => boolean | undefined);

declare module '@better-grid/core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnDef<TData = unknown> {
    precision?: number | ((row: TData) => number | undefined);
    /** Minimum allowed numeric value (used for ArrowUp/Down clamping) */
    min?: number | ((row: TData) => number | undefined);
    /** Maximum allowed numeric value (used for ArrowUp/Down clamping) */
    max?: number | ((row: TData) => number | undefined);
    /** Placeholder text shown in empty editable cells when inputStyle is enabled */
    placeholder?: string;
    /** Input mask pattern (e.g. 'MM/YY'). Each letter = editable digit section, other chars = fixed. */
    mask?: string;
    /** Persistent suffix adornment (e.g. '%'). Rendered both in display and edit modes.
     *  Can be a static string or a per-row function that returns a suffix or undefined. */
    prefix?: string | ((row: TData) => string | undefined);
    suffix?: string | ((row: TData) => string | undefined);
    unit?: string | ((row: TData) => string | undefined);
    /** Resolve the selected option for selectWithInput columns from the stored cell value. */
    selectValue?: (value: unknown, row: TData, column: ColumnDef<TData>) => unknown;
    /** Resolve the sibling input value for selectWithInput columns from the stored cell value. */
    selectInputValue?: (value: unknown, row: TData, column: ColumnDef<TData>) => string | number | undefined;
    /** Sibling input config for selectWithInput columns. */
    selectInput?: SelectInputConfig<TData>;
    /** Convert selectWithInput UI state back into the stored cell value. */
    parseSelectWithInputValue?: (value: SelectWithInputValue<TData>) => unknown;
    /**
     * Enable display-mode ellipsis + overflow-to-floating-editor for inputStyle cells.
     * Defaults to the editing plugin's `inputEllipsis` option.
     */
    inputEllipsis?: InputCellBoolean<TData>;
    /**
     * Show the text-edit cursor over inputStyle editable cells.
     * Defaults to the editing plugin's `inputEditCursor` option.
     */
    inputEditCursor?: InputCellBoolean<TData>;
    /**
     * Render an actual `<input>` element permanently inside the cell — instead
     * of opening a floating editor on click. Designed for finance-style sheets
     * where every visible cell should already accept keystrokes.
     *
     * Commits via the standard parser path on `change`/`blur`/`Enter`; reverts
     * on `Escape`. Cannot coexist with `cellEditor: 'select' | 'selectWithInput'`
     * — those columns continue to use the floating dropdown editor.
     *
     * Performance: each `alwaysInput` cell adds a real DOM `<input>` for every
     * visible row. The plugin warns when `alwaysInput cols × visible rows`
     * exceeds `alwaysInputThreshold` (default 1000).
     */
    alwaysInput?: InputCellBoolean<TData>;
  }
}

export interface EditingOptions {
  /** How to trigger edit mode. Default: 'dblclick' */
  editTrigger?: 'click' | 'dblclick' | 'type';
  /** When to commit edits. Default: ['enter', 'tab'] */
  commitOn?: ('enter' | 'tab')[];
  /** Cancel on Escape. Default: true */
  cancelOnEscape?: boolean;
  /** Custom labels for boolean dropdown. Default: ['Yes', 'No'] */
  booleanLabels?: [string, string];
  /** Default decimal precision for number/currency cells. Per-column `precision` prop overrides. */
  precision?: number;
  /** Editor rendering mode. 'float' = floating overlay (default), 'inline' = inside cell bounds */
  editorMode?: 'float' | 'inline';
  /**
   * Show editable cells with input-like styling (subtle border, rounded corners).
   * Only applied to cells where `editable` is true/returns true.
   * Default: false
   */
  inputStyle?: boolean;
  /**
   * Display overflowing inputStyle values with ellipsis and open them in the
   * floating editor when clipped. Default: true.
   */
  inputEllipsis?: boolean;
  /**
   * Show the text-edit cursor over inputStyle editable cells. Default: true.
   */
  inputEditCursor?: boolean;
  /**
   * Warning threshold for `column.alwaysInput`. When `alwaysInput cols × rows`
   * exceeds this, the plugin emits a one-time console warning. Default: 1000.
   * Set to 0 to disable.
   */
  alwaysInputThreshold?: number;
}

/** Dropdown option for columns with meta.options */
export interface DropdownOption {
  label: string;
  value: unknown;
}

export interface EditingApi {
  startEdit(position: CellPosition, initialValue?: string): void;
  commitEdit(): boolean;
  cancelEdit(): void;
  isEditing(): boolean;
  getEditingCell(): CellPosition | null;
}

const INPUT_CSS = `
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  background: transparent;
  box-sizing: border-box;
`;

// Chevron SVG for dropdown trigger
const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23999'/%3E%3C/svg%3E")`;

// Module-level canvas reused across caret-from-x measurements (avoids
// allocating a canvas on every cell click).
let caretMeasureCanvas: HTMLCanvasElement | null = null;

// Static per-column check: is this column potentially alwaysInput? (truthy or
// function). Function variants might return false per-row, but the column still
// needs the input wrapper installed.
function isAlwaysInputColumn(col: ColumnDef): boolean {
  const ai = col.alwaysInput;
  return ai === true || typeof ai === 'function';
}

// Resolve a per-row alwaysInput decision. Falls back to false when undefined.
function resolveAlwaysInput(col: ColumnDef, row: unknown): boolean {
  const ai = col.alwaysInput;
  if (ai === true) return true;
  if (typeof ai === 'function') return ai(row, col) ?? false;
  return false;
}

export function editing(options?: EditingOptions): GridPlugin<'editing', EditingApi> {
  const config = {
    editTrigger: options?.editTrigger ?? 'dblclick',
    commitOn: options?.commitOn ?? ['enter', 'tab'],
    cancelOnEscape: options?.cancelOnEscape ?? true,
    booleanLabels: options?.booleanLabels ?? (['Yes', 'No'] as [string, string]),
    precision: options?.precision,
    editorMode: options?.editorMode ?? 'float',
    inputStyle: options?.inputStyle ?? false,
    inputEllipsis: options?.inputEllipsis ?? true,
    inputEditCursor: options?.inputEditCursor ?? true,
    alwaysInputThreshold: options?.alwaysInputThreshold ?? 1000,
  };

  return {
    id: 'editing',

    init(ctx: PluginContext) {
      const initialColumns = ctx.store.getState().columns;
      const hasAlwaysInput = initialColumns.some(isAlwaysInputColumn);

      // ─── Always-input CSS (minimal, runs whenever any column uses it) ─
      if (hasAlwaysInput && !document.getElementById('bg-editing-always-input-style')) {
        const style = document.createElement('style');
        style.id = 'bg-editing-always-input-style';
        style.textContent = `
          .bg-cell--always-input {
            display: flex !important;
            align-items: center !important;
            padding: 0 !important;
          }
          .bg-cell--always-input > .bg-always-input {
            flex: 1 1 auto;
            min-width: 0;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            border: none;
            outline: none;
            background: transparent;
            color: inherit;
            font: inherit;
            text-align: inherit;
            padding: 0 8px;
            margin: 0;
          }
          .bg-cell--always-input.bg-cell--align-right > .bg-always-input { text-align: right; }
          .bg-cell--always-input.bg-cell--align-center > .bg-always-input { text-align: center; }
        `;
        document.head.appendChild(style);
      }

      // ─── Input-style CSS + cellClass wrapping ────────────────────────
      if (config.inputStyle || hasAlwaysInput) {
        // Inject CSS once (inputStyle visual treatment only)
        if (config.inputStyle && !document.getElementById('bg-editing-input-style')) {
          const style = document.createElement('style');
          style.id = 'bg-editing-input-style';
          style.textContent = `
            .bg-cell--input-editable {
              display: flex !important;
              align-items: center !important;
              line-height: normal !important;
            }
            .bg-cell--input-edit-cursor {
              cursor: text;
            }
            .bg-cell--input-editable .bg-input-box {
              pointer-events: none;
              background: var(--bg-input-bg, #F8F8F8);
              border-radius: 4px;
              box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
              height: 30px;
              padding: 0 8px;
              display: flex;
              align-items: center;
              box-sizing: border-box;
              width: 100%;
              font-size: 12px;
              cursor: inherit;
            }
            .bg-cell--input-editable .bg-input-box,
            .bg-cell--input-editable .bg-input-box__value,
            .bg-cell--input-editable .bg-select-trigger,
            .bg-cell--input-editable .bg-select-compound,
            .bg-cell--input-editable .bg-select-compound-input-wrap,
            .bg-cell--input-editable .bg-select-compound-input {
              min-width: 0;
            }
            .bg-cell--input-editable .bg-input-box,
            .bg-cell--input-editable .bg-input-box__value,
            .bg-cell--input-editable .bg-select-trigger,
            .bg-cell--input-editable .bg-select-compound-input {
              white-space: nowrap;
            }
            .bg-cell--input-ellipsis .bg-input-box,
            .bg-cell--input-ellipsis .bg-input-box__value,
            .bg-cell--input-ellipsis .bg-select-trigger,
            .bg-cell--input-ellipsis .bg-select-compound-input {
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .bg-cell--input-editable .bg-input-box:hover {
              background: var(--bg-input-hover-bg, #F0F0F0);
            }
            .bg-cell--input-editable .bg-input-box--placeholder {
              color: var(--bg-input-placeholder, #98A2B3);
            }
            .bg-cell--input-editable .bg-input-box--has-adornment {
              position: relative;
            }
            .bg-cell--input-editable .bg-input-box--dropdown {
              position: relative;
              padding-right: 28px;
            }
            .bg-cell--input-editable .bg-input-box--dropdown::after {
              content: "";
              position: absolute;
              right: 8px;
              top: 50%;
              width: 8px;
              height: 5px;
              transform: translateY(-50%);
              background-image: ${CHEVRON_SVG};
              background-repeat: no-repeat;
              background-size: 8px 5px;
              opacity: 0.65;
              pointer-events: none;
            }
            .bg-cell--input-editable .bg-select-trigger,
            .bg-cell--input-editable .bg-select-compound-input-wrap,
            .bg-cell--input-editable .bg-select-compound-input {
              pointer-events: auto;
            }
            .bg-cell--input-editable .bg-select-trigger {
              border: none;
              cursor: pointer;
              color: inherit;
              font: inherit;
              text-align: inherit;
            }
            .bg-cell--input-editable .bg-select-compound {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
              width: 100%;
            }
            .bg-cell--input-ellipsis .bg-select-compound {
              overflow: hidden;
            }
            .bg-cell--input-editable .bg-select-compound .bg-select-trigger {
              flex: 1 1 auto;
              width: auto !important;
            }
            .bg-cell--input-editable .bg-select-compound-input-wrap {
              display: flex;
              align-items: center;
              height: 30px;
              border-radius: 4px;
              box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
              background: var(--bg-input-bg, #F8F8F8);
              box-sizing: border-box;
              flex: 0 0 auto;
              overflow: hidden;
            }
            .bg-cell--input-editable .bg-select-compound-input {
              height: 100%;
              min-width: 0;
              border: none;
              box-shadow: none;
              background: transparent;
              box-sizing: border-box;
              color: inherit;
              flex: 1 1 auto;
              font: inherit;
              font-size: 12px;
              outline: none;
              padding: 0 var(--bg-input-suffix-space, 6px) 0 var(--bg-input-prefix-space, 6px);
              text-align: center;
            }
            .bg-cell--input-editable .bg-select-compound-prefix,
            .bg-cell--input-editable .bg-select-compound-suffix,
            .bg-cell--input-editable .bg-select-compound-unit {
              display: inline-flex;
              align-items: center;
              bottom: 0;
              color: var(--bg-input-unit, #98A2B3);
              font-size: 12px;
              justify-content: center;
              line-height: 1;
              pointer-events: none;
              position: absolute;
              top: 0;
            }
            .bg-cell--input-editable .bg-select-compound-prefix {
              left: 6px;
            }
            .bg-cell--input-editable .bg-select-compound-suffix,
            .bg-cell--input-editable .bg-select-compound-unit {
              right: 6px;
            }
            .bg-cell--input-editable .bg-input-box__value {
              display: block;
              align-items: center;
              min-width: 0;
              width: 100%;
              padding: 0 var(--bg-input-suffix-space, 0px) 0 var(--bg-input-prefix-space, 0px);
              box-sizing: border-box;
              text-align: inherit;
            }
            .bg-cell--input-editable .bg-input-box__prefix,
            .bg-cell--input-editable .bg-input-box__suffix,
            .bg-cell--input-editable .bg-input-box__unit {
              display: inline-flex;
              align-items: center;
              bottom: 0;
              color: var(--bg-input-unit, #98A2B3);
              justify-content: center;
              pointer-events: none;
              font-size: inherit;
              line-height: 1;
              position: absolute;
              top: 0;
            }
            .bg-cell--input-editable .bg-input-box__prefix {
              left: 8px;
            }
            .bg-cell--input-editable .bg-input-box__suffix,
            .bg-cell--input-editable .bg-input-box__unit {
              right: 8px;
            }
            .bg-cell--editing .bg-input-box__value .bg-cell-editor {
              background: transparent !important;
              box-shadow: none !important;
              pointer-events: auto !important;
              cursor: text;
            }
            .bg-cell--editing .bg-input-box,
            .bg-cell--editing .bg-input-box__value {
              pointer-events: auto;
            }
            .bg-cell--editing .bg-input-box--has-adornment .bg-input-box__value {
              display: flex;
              align-items: center;
              height: 100%;
            }
            .bg-cell--editing .bg-input-box--has-adornment .bg-input-box__value .bg-cell-editor--inline {
              width: 100% !important;
              min-width: 0 !important;
              height: 100% !important;
              text-align: inherit;
            }
          `;
          document.head.appendChild(style);
        }

        // Wrap cellClass + cellRenderer on editable columns — mark cells for flat input
        // styling and render permanent <input> elements for alwaysInput columns.
        // Guard against double-wrapping (HMR, plugin re-registration): skip any column
        // we've already wrapped via the __inputStyleWrapped sentinel.
        //
        // applyColumnWrap() is called once at init time and again from the
        // 'columns:set' subscriber below, which re-wraps whenever grid.setColumns()
        // is called (e.g. the React adapter's useEffect on first render).
        // setColumns() creates fresh spread-copies of every ColumnDef via
        // normalizeColumn(), discarding the mutations applied here — the subscriber
        // ensures they are re-applied to the new column references.
        const applyColumnWrap = (cols: (ColumnDef & { id: string })[]): void => {
          let changed = false;
          for (const col of cols) {
            if (col.editable === false) continue;
            if (!col.field && !col.valueGetter) continue;
            if ((col as { __inputStyleWrapped?: boolean }).__inputStyleWrapped) continue;
            (col as { __inputStyleWrapped?: boolean }).__inputStyleWrapped = true;

            const origCellClass = col.cellClass;
            const placeholder = col.placeholder;

            col.cellClass = (value: unknown, row: unknown, rowIndex: number) => {
              let cls = origCellClass ? origCellClass(value, row as never, rowIndex) ?? '' : '';
              const classes = new Set(cls.split(/\s+/).filter(Boolean));
              let isEditable = true;
              if (typeof col.editable === 'function') {
                isEditable = col.editable(row as never, col as never);
              }
              if (isEditable) {
                if (resolveAlwaysInput(col, row)) {
                  classes.add('bg-cell--always-input');
                  if (col.align === 'right') classes.add('bg-cell--align-right');
                  else if (col.align === 'center') classes.add('bg-cell--align-center');
                } else if (config.inputStyle) {
                  classes.add('bg-cell--input-editable');
                  if (shouldUseInputEllipsis(col, row)) {
                    classes.add('bg-cell--input-ellipsis');
                  }
                  if (shouldUseInputEditCursor(col, row)) {
                    classes.add('bg-cell--input-edit-cursor');
                  }
                }
              }
              cls = Array.from(classes).join(' ');
              return cls || undefined;
            };

            // Wrap cellRenderer to add inner input box
            const origRenderer = col.cellRenderer;
            (col as { __inputStyleOriginalRenderer?: typeof origRenderer }).__inputStyleOriginalRenderer = origRenderer;
            col.cellRenderer = (container, context) => {
              let isEditable = col.editable !== false;
              if (typeof col.editable === 'function') {
                isEditable = col.editable(context.row as never, col as never);
              }

              if (!isEditable) {
                if (origRenderer) return origRenderer(container, context);
                renderFormattedDisplay(container, context);
                return;
              }

              // Always-input branch: render a real <input> permanently. Skip the
              // inputStyle styled-div path entirely. Select-style editors keep
              // their normal dropdown editor (alwaysInput doesn't apply there).
              if (
                resolveAlwaysInput(col, context.row) &&
                col.cellEditor !== 'select' &&
                col.cellEditor !== 'selectWithInput'
              ) {
                renderAlwaysInputCell(container, context, col, origRenderer, placeholder);
                return;
              }

              // No inputStyle wrapping requested → fall back to original renderer.
              if (!config.inputStyle) {
                if (origRenderer) return origRenderer(container, context);
                renderFormattedDisplay(container, context);
                return;
              }

              const selectDisplayOpts = getDropdownOptions(col, context.value);
              if (
                selectDisplayOpts &&
                (col.cellEditor === 'select' || col.cellEditor === 'selectWithInput')
              ) {
                renderSelectDisplayCell(container, context, col, selectDisplayOpts);
                return;
              }

              // Run original renderer to set styles (bg, font, padding) on the cell.
              // When no column.cellRenderer is set, fall back to valueFormatter or
              // the raw value so editable cells without a custom renderer still
              // produce text for the input box.
              if (origRenderer) {
                origRenderer(container, context);
              } else if (col.valueFormatter) {
                renderFormattedDisplay(container, context);
              } else if (col.cellType) {
                renderFormattedDisplay(container, context);
              } else {
                renderFormattedDisplay(container, context);
              }

              // Capture text set by original renderer, then replace with input box
              const text = container.textContent?.trim() || '';
              container.textContent = '';

              const box = document.createElement('div');
              box.className = 'bg-input-box';
              // Inherit alignment from column
              if (context.column.align === 'center') box.style.justifyContent = 'center';
              else if (context.column.align === 'right') box.style.justifyContent = 'flex-end';
              const isPlaceholderText = Boolean(
                placeholder &&
                text === placeholder &&
                (context.value == null || context.value === ''),
              );
              const prefix = resolveColumnPrefix(col, context.row);
              const suffix = resolveColumnSuffix(col, context.row);
              const isDropdown = (Array.isArray(col.options) && col.options.length > 0) || typeof context.value === 'boolean';
              if (isDropdown) box.classList.add('bg-input-box--dropdown');
              if (prefix || suffix) {
                box.classList.add('bg-input-box--has-adornment');
                if (suffix) box.classList.add('bg-input-box--has-unit');
                // Reserve space only for the side that actually has an
                // adornment — asymmetric padding lets the editor extend to
                // the opposite edge when only one side has a prefix/suffix
                // (e.g., `$27,000,000` should give the number full width to
                // the right, not reserve phantom right-side padding).
                box.style.setProperty('--bg-input-prefix-space', prefix ? `${getAdornmentSpace(prefix)}px` : '0px');
                box.style.setProperty('--bg-input-suffix-space', suffix ? `${getAdornmentSpace(suffix)}px` : '0px');
                // Structured value + adornments so editing can clear the value without destroying either edge.
                if (prefix) {
                  const prefixSpan = document.createElement('span');
                  prefixSpan.className = 'bg-input-box__prefix';
                  prefixSpan.textContent = prefix;
                  box.appendChild(prefixSpan);
                }
                const valueSpan = document.createElement('span');
                valueSpan.className = 'bg-input-box__value';
                const displayText = stripInputAdornments(text, prefix, suffix);
                if (text) {
                  valueSpan.textContent = displayText;
                  if (isPlaceholderText) box.classList.add('bg-input-box--placeholder');
                } else if (placeholder) {
                  valueSpan.textContent = placeholder;
                  box.classList.add('bg-input-box--placeholder');
                }
                box.appendChild(valueSpan);
                if (suffix) {
                  const suffixSpan = document.createElement('span');
                  suffixSpan.className = 'bg-input-box__suffix bg-input-box__unit';
                  suffixSpan.textContent = suffix;
                  box.appendChild(suffixSpan);
                }
              } else if (text) {
                box.textContent = text;
                if (isPlaceholderText) box.classList.add('bg-input-box--placeholder');
              } else if (placeholder) {
                box.textContent = placeholder;
                box.classList.add('bg-input-box--placeholder');
              }
              container.appendChild(box);
            };

            changed = true;
          }

          if (changed) {
            ctx.store.update('columns', () => ({ columns: [...cols] }));
          }
        }

        applyColumnWrap(ctx.store.getState().columns);

        // Perf gate: warn (once per init) if alwaysInput coverage is heavy.
        if (config.alwaysInputThreshold > 0 && hasAlwaysInput) {
          const alwaysInputCols = ctx.store.getState().columns.filter(isAlwaysInputColumn).length;
          const rowCount = ctx.store.getState().data.length;
          const liveInputs = alwaysInputCols * rowCount;
          if (liveInputs > config.alwaysInputThreshold) {
            console.warn(
              `[better-grid] alwaysInput renders ${liveInputs} live <input> elements ` +
              `(${alwaysInputCols} columns × ${rowCount} rows). Threshold: ${config.alwaysInputThreshold}. ` +
              `Consider scoping alwaysInput per-row, paginating, or raising editing({ alwaysInputThreshold }).`,
            );
          }
        }

        // Re-apply column wrapping whenever grid.setColumns() is called. The React
        // adapter (and any other caller) calls setColumns() after createGrid —
        // normalizeColumn() creates fresh ColumnDef spread-copies for every column,
        // discarding the cellClass/cellRenderer mutations applied above. Subscribing
        // here re-wraps the new column references so alwaysInput and inputStyle cells
        // render correctly on every setColumns() call, including the initial one from
        // React's useEffect mount.
        ctx.on('columns:set', (newColumns) => {
          const needsWrap = config.inputStyle || newColumns.some(isAlwaysInputColumn);
          if (!needsWrap) return;
          applyColumnWrap(newColumns);
        });
      }
      let editingCell: CellPosition | null = null;
      let activeEditor: HTMLInputElement | null = null;
      let activeFloatBox: HTMLElement | null = null;
      let activeDropdownPanel: HTMLElement | null = null;
      let activeDisplaySelectPanel: HTMLElement | null = null;
      let activeDisplaySelectCleanup: (() => void) | null = null;
      /** Cleanup function for the current editor's outside-click listener */
      let activeOutsideClickCleanup: (() => void) | null = null;
      let activeDropdownOptions: DropdownOption[] | null = null;
      let originalValue: unknown = null;
      let pendingClickEditHandoff: CellPosition | null = null;
      let pendingClickEditHandoffFrame: number | null = null;

      function getGridContainer(): HTMLElement {
        return ctx.grid.getContainer() ?? document.body;
      }

      function getCellElement(pos: CellPosition): HTMLElement | null {
        const selector = `.bg-cell[data-row="${pos.rowIndex}"][data-col="${pos.colIndex}"]`;
        return getGridContainer().querySelector(selector);
      }

      function renderFormattedDisplay(
        container: HTMLElement,
        context: CellRenderContext,
      ): void {
        container.textContent = getFormattedDisplayText(context.column, context.row, context.value, context.rowIndex, context.colIndex);
      }

      function getFormattedDisplayText(
        column: ColumnDef & { id: string },
        row: unknown,
        value: unknown,
        rowIndex: number,
        colIndex: number,
      ): string {
        if (column.valueFormatter) return column.valueFormatter(value, row as never);
        if (column.cellType) {
          const typeRenderer = ctx.grid.getCellType(column.cellType);
          if (typeRenderer?.getStringValue) {
            return typeRenderer.getStringValue({
              rowIndex,
              colIndex,
              row,
              column,
              value,
              isSelected: false,
              isActive: false,
              style: { top: 0, left: 0, width: 0, height: 0 },
              context: undefined,
            });
          }
        }
        const suffix = resolveColumnSuffix(column, row);
        if ((resolveColumnPrefix(column, row) || suffix) && typeof value === 'number') {
          const precision = getPrecision(column, row);
          return precision != null ? value.toFixed(precision) : String(value);
        }
        return value != null ? String(value) : '';
      }

      // Render an always-on <input> inside the cell. Reuses the input across
      // re-renders of the same logical (row,col) so focus and in-progress text
      // survive grid refreshes (scroll, sibling-cell updates).
      function renderAlwaysInputCell(
        container: HTMLElement,
        context: CellRenderContext,
        column: ColumnDef,
        origRenderer: ColumnDef['cellRenderer'] | undefined,
        placeholder: string | undefined,
      ): void {
        const key = `${context.rowIndex}:${context.colIndex}`;
        const displayText = origRenderer
          ? getInputStyleDisplayText(context.column, context.row, context.value, context.rowIndex, context.colIndex)
          : getFormattedDisplayText(context.column, context.row, context.value, context.rowIndex, context.colIndex);
        const prefix = resolveColumnPrefix(context.column, context.row);
        const suffix = resolveColumnSuffix(context.column, context.row);
        const inputValue = stripInputAdornments(displayText, prefix, suffix);

        // Try to reuse an existing input on this cell to preserve focus/caret.
        let input = container.querySelector<HTMLInputElement>('input.bg-always-input');
        if (input && input.dataset.cellKey === key) {
          // Same logical cell — only update value if the user is not editing.
          if (document.activeElement !== input && input.value !== inputValue) {
            input.value = inputValue;
          }
          return;
        }

        // Different cell (recycled) or first render — rebuild.
        container.textContent = '';
        input = document.createElement('input');
        input.className = 'bg-always-input';
        input.type = 'text';
        input.value = inputValue;
        input.dataset.cellKey = key;
        if (placeholder) input.placeholder = placeholder;

        const cellType = column.cellType;
        if (cellType === 'number' || cellType === 'currency' || cellType === 'percent' || cellType === 'bigint') {
          input.inputMode = 'decimal';
        }

        const commit = (): void => {
          const cellEl = input!.closest('.bg-cell') as HTMLElement | null;
          const rowAttr = cellEl?.dataset.row;
          const colAttr = cellEl?.dataset.col;
          if (rowAttr == null || colAttr == null) return;
          const rowIdx = Number(rowAttr);
          const colIdx = Number(colAttr);
          const state = ctx.grid.getState();
          const liveColumn = state.columns[colIdx];
          if (!liveColumn?.field) return;
          const hs = state.hierarchyState;
          const dataIdx = hs ? (hs.visibleRows[rowIdx] ?? rowIdx) : rowIdx;
          const rowData = state.data[dataIdx];
          const currentValue = liveColumn.valueGetter
            ? liveColumn.valueGetter(rowData as never, dataIdx)
            : (rowData as Record<string, unknown>)[liveColumn.field];
          const parsed = parseTextValue(input!.value, liveColumn, currentValue, rowData);
          if (parsed !== currentValue) {
            ctx.grid.updateCell(rowIdx, liveColumn.id, parsed);
          }
        };

        const revert = (): void => {
          const cellEl = input!.closest('.bg-cell') as HTMLElement | null;
          const rowAttr = cellEl?.dataset.row;
          const colAttr = cellEl?.dataset.col;
          if (rowAttr == null || colAttr == null) return;
          const rowIdx = Number(rowAttr);
          const colIdx = Number(colAttr);
          const state = ctx.grid.getState();
          const liveColumn = state.columns[colIdx];
          if (!liveColumn) return;
          const hs = state.hierarchyState;
          const dataIdx = hs ? (hs.visibleRows[rowIdx] ?? rowIdx) : rowIdx;
          const rowData = state.data[dataIdx];
          const currentValue = liveColumn.valueGetter
            ? liveColumn.valueGetter(rowData as never, dataIdx)
            : liveColumn.field
              ? (rowData as Record<string, unknown>)[liveColumn.field]
              : undefined;
          input!.value = stripInputAdornments(
            getInputStyleDisplayText(liveColumn, rowData, currentValue, rowIdx, colIdx),
            resolveColumnPrefix(liveColumn, rowData),
            resolveColumnSuffix(liveColumn, rowData),
          );
        };

        input.addEventListener('change', commit);
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            input!.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            revert();
            input!.blur();
          }
        });

        container.appendChild(input);
      }

      function getInputStyleDisplayText(
        column: ColumnDef & { id: string },
        row: unknown,
        value: unknown,
        rowIndex: number,
        colIndex: number,
      ): string {
        const origRenderer = (column as { __inputStyleOriginalRenderer?: ColumnDef['cellRenderer'] }).__inputStyleOriginalRenderer;
        if (origRenderer) {
          const temp = document.createElement('div');
          const cleanup = origRenderer(temp, {
            rowIndex,
            colIndex,
            row,
            column,
            value,
            isSelected: false,
            isActive: false,
            style: { top: 0, left: 0, width: 0, height: 0 },
            context: undefined,
          });
          if (typeof cleanup === 'function') cleanup();
          return temp.textContent?.trim() ?? '';
        }
        return getFormattedDisplayText(column, row, value, rowIndex, colIndex);
      }

      function resolveColumnPrefix(column: ColumnDef, row: unknown): string | undefined {
        return typeof column.prefix === 'function'
          ? (column.prefix as (row: unknown) => string | undefined)(row)
          : column.prefix;
      }

      function resolveColumnSuffix(column: ColumnDef, row: unknown): string | undefined {
        if (column.suffix) {
          return typeof column.suffix === 'function'
            ? (column.suffix as (row: unknown) => string | undefined)(row)
            : column.suffix;
        }
        return typeof column.unit === 'function'
          ? (column.unit as (row: unknown) => string | undefined)(row)
          : column.unit;
      }

      function getAdornmentSpace(adornment: string): number {
        return Math.max(16, Math.ceil(adornment.length * 8 + 10));
      }

      function getBalancedAdornmentSpace(prefix?: string, suffix?: string, fallback = 0): number {
        return Math.max(
          prefix ? getAdornmentSpace(prefix) : fallback,
          suffix ? getAdornmentSpace(suffix) : fallback,
        );
      }

      function stripInputAdornments(text: string, prefix?: string, suffix?: string): string {
        let next = text.trim();
        if (prefix && next.startsWith(prefix)) next = next.slice(prefix.length).trimStart();
        if (suffix && next.endsWith(suffix)) next = next.slice(0, -suffix.length).trimEnd();
        return next;
      }

      function resolveInputCellBoolean(
        setting: InputCellBoolean | undefined,
        fallback: boolean,
        row: unknown,
        column: ColumnDef,
      ): boolean {
        if (typeof setting === 'function') {
          return setting(row, column) ?? fallback;
        }
        if (typeof setting === 'boolean') return setting;
        return fallback;
      }

      function shouldUseInputEllipsis(column: ColumnDef, row: unknown): boolean {
        return resolveInputCellBoolean(column.inputEllipsis, config.inputEllipsis, row, column);
      }

      function shouldUseInputEditCursor(column: ColumnDef, row: unknown): boolean {
        return resolveInputCellBoolean(column.inputEditCursor, config.inputEditCursor, row, column);
      }

      function isDisplayOverflowing(el: HTMLElement | null | undefined): boolean {
        if (!el) return false;
        return el.scrollWidth > el.clientWidth + 1;
      }

      function isInputDisplayOverflowing(inputBox: HTMLElement): boolean {
        const targets = [
          inputBox,
          ...Array.from(inputBox.querySelectorAll<HTMLElement>(
            '.bg-input-box__value, .bg-select-trigger, .bg-select-compound-input',
          )),
        ];
        return targets.some(isDisplayOverflowing);
      }

      function getTextOffsetFromClientX(
        text: string,
        rect: DOMRect,
        computed: CSSStyleDeclaration,
        clientX: number,
      ): number {
        if (!text) return 0;

        if (!caretMeasureCanvas) caretMeasureCanvas = document.createElement('canvas');
        const ctx2d = caretMeasureCanvas.getContext('2d');
        if (!ctx2d) return text.length;

        ctx2d.font = computed.font ||
          `${computed.fontStyle} ${computed.fontVariant} ${computed.fontWeight} ${computed.fontSize} / ${computed.lineHeight} ${computed.fontFamily}`;

        const paddingLeft = parseFloat(computed.paddingLeft) || 0;
        const paddingRight = parseFloat(computed.paddingRight) || 0;
        const textWidth = ctx2d.measureText(text).width;
        const contentWidth = Math.max(0, rect.width - paddingLeft - paddingRight);
        let textStart = rect.left + paddingLeft;

        if (computed.textAlign === 'center') {
          textStart = rect.left + paddingLeft + Math.max(0, (contentWidth - textWidth) / 2);
        } else if (computed.textAlign === 'right' || computed.textAlign === 'end') {
          textStart = rect.right - paddingRight - textWidth;
        }

        const x = clientX - textStart;
        if (x <= 0) return 0;

        let advance = 0;
        for (let i = 0; i < text.length; i += 1) {
          const charWidth = ctx2d.measureText(text[i] ?? '').width;
          if (x < advance + charWidth / 2) return i;
          advance += charWidth;
        }

        return text.length;
      }

      function setContentEditableCaret(element: HTMLElement, offset: number): void {
        setContentEditableSelection(element, offset, offset);
      }

      function setContentEditableSelection(element: HTMLElement, start: number, end: number): void {
        const text = element.textContent ?? '';
        if (!element.firstChild) {
          element.appendChild(document.createTextNode(text));
        }
        const node = element.firstChild;
        if (!node) return;
        const clampedStart = Math.min(Math.max(start, 0), text.length);
        const clampedEnd = Math.min(Math.max(end, 0), text.length);

        const range = document.createRange();
        range.setStart(node, clampedStart);
        range.setEnd(node, clampedEnd);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }

      function optionValuesEqual(a: unknown, b: unknown): boolean {
        return a === b || String(a) === String(b);
      }

      function getSelectedOptionValue(
        column: ColumnDef,
        context: CellRenderContext,
      ): unknown {
        if (column.selectValue) {
          return column.selectValue(context.value, context.row as never, column as never);
        }
        return context.value;
      }

      function getSelectedOption(
        opts: DropdownOption[],
        value: unknown,
      ): DropdownOption | undefined {
        return opts.find((opt) => optionValuesEqual(opt.value, value));
      }

      function getSelectInputConfig(column: ColumnDef): SelectInputConfig | undefined {
        return column.selectInput as SelectInputConfig | undefined;
      }

      function getCompoundInputRawValue(
        column: ColumnDef,
        context: CellRenderContext,
      ): string | number {
        if (column.selectInputValue) {
          const resolved = column.selectInputValue(context.value, context.row as never, column as never);
          if (resolved != null) return resolved;
        }
        const cfg = getSelectInputConfig(column);
        return cfg?.defaultValue ?? '';
      }

      function resolveSelectInputPrefix(
        cfg: SelectInputConfig | undefined,
        row: unknown,
      ): string | undefined {
        if (!cfg?.prefix) return undefined;
        return typeof cfg.prefix === 'function'
          ? (cfg.prefix as (row: unknown) => string | undefined)(row)
          : cfg.prefix;
      }

      function resolveSelectInputSuffix(
        cfg: SelectInputConfig | undefined,
        row: unknown,
      ): string | undefined {
        if (cfg?.suffix) {
          return typeof cfg.suffix === 'function'
            ? (cfg.suffix as (row: unknown) => string | undefined)(row)
            : cfg.suffix;
        }
        if (!cfg?.unit) return undefined;
        return typeof cfg.unit === 'function'
          ? (cfg.unit as (row: unknown) => string | undefined)(row)
          : cfg.unit;
      }

      function coerceCompoundInputValue(
        rawValue: string | number,
        cfg: SelectInputConfig | undefined,
        row: unknown,
      ): string | number {
        if (cfg?.type === 'text') return String(rawValue);

        const raw = String(rawValue).trim();
        const n = raw === '' ? Number(cfg?.defaultValue ?? 0) : Number(raw);
        if (!Number.isFinite(n)) return Number(cfg?.defaultValue ?? 0);

        const precision = cfg?.precision != null
          ? (typeof cfg.precision === 'function'
            ? (cfg.precision as (row: unknown) => number | undefined)(row)
            : cfg.precision)
          : undefined;
        const min = cfg?.min != null
          ? (typeof cfg.min === 'function'
            ? (cfg.min as (row: unknown) => number | undefined)(row)
            : cfg.min)
          : undefined;
        const max = cfg?.max != null
          ? (typeof cfg.max === 'function'
            ? (cfg.max as (row: unknown) => number | undefined)(row)
            : cfg.max)
          : undefined;

        let next = precision != null ? Number(n.toFixed(precision)) : n;
        if (min != null && next < min) next = min;
        if (max != null && next > max) next = max;
        return next;
      }

      function buildSelectWithInputValue(
        column: ColumnDef,
        context: CellRenderContext,
        optionValue: unknown,
        inputValue: string | number,
      ): unknown {
        if (column.parseSelectWithInputValue) {
          return column.parseSelectWithInputValue({
            optionValue,
            inputValue,
            row: context.row as never,
            column: column as never,
            previousValue: context.value,
          });
        }

        const cfg = getSelectInputConfig(column);
        if (cfg && optionValuesEqual(optionValue, cfg.optionValue)) {
          return coerceCompoundInputValue(inputValue, cfg, context.row);
        }
        return optionValue;
      }

      function commitDisplaySelectValue(
        context: CellRenderContext,
        value: unknown,
      ): void {
        if (!context.column.field) return;
        if (value === context.value) return;
        ctx.grid.updateCell(context.rowIndex, context.column.id, value);
      }

      function closeDisplaySelectPanel(): void {
        if (activeDisplaySelectCleanup) {
          activeDisplaySelectCleanup();
          activeDisplaySelectCleanup = null;
        }
        activeDisplaySelectPanel?.remove();
        activeDisplaySelectPanel = null;
      }

      function openDisplaySelectPanel(
        anchorEl: HTMLElement,
        opts: DropdownOption[],
        selectedValue: unknown,
        onSelect: (option: DropdownOption) => void,
      ): void {
        closeDisplaySelectPanel();

        const rect = anchorEl.getBoundingClientRect();
        const panel = document.createElement('div');
        panel.className = 'bg-dropdown-panel bg-select-panel';
        panel.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.bottom + 2}px;
          min-width: ${rect.width}px;
          z-index: 10000;
          background: var(--bg-dropdown-bg, #fff);
          border: 1px solid var(--bg-dropdown-border, #EAECF0);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(16, 24, 40, 0.12);
          padding: 4px 0;
          max-height: 220px;
          overflow-y: auto;
          font: ${getComputedStyle(anchorEl).font};
          line-height: normal;
        `;

        let selectedIndex = Math.max(0, opts.findIndex((opt) => optionValuesEqual(opt.value, selectedValue)));

        const highlight = (index: number): void => {
          selectedIndex = index;
          const items = panel.querySelectorAll('.bg-dropdown-item');
          items.forEach((item, i) => {
            const el = item as HTMLElement;
            const selected = i === selectedIndex;
            el.classList.toggle('bg-dropdown-item--selected', selected);
            el.style.background = selected ? 'var(--bg-dropdown-selected-bg, #F2F4F7)' : '';
            el.style.fontWeight = selected ? '500' : '';
            if (selected) el.scrollIntoView({ block: 'nearest' });
          });
        };

        opts.forEach((opt, index) => {
          const item = document.createElement('div');
          item.className = 'bg-dropdown-item';
          item.textContent = opt.label;
          item.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            user-select: none;
            font: inherit;
            color: #344054;
            white-space: nowrap;
          `;
          item.addEventListener('mouseenter', () => {
            if (index !== selectedIndex) item.style.background = 'var(--bg-dropdown-hover-bg, #F9FAFB)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = index === selectedIndex ? 'var(--bg-dropdown-selected-bg, #F2F4F7)' : '';
          });
          item.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeDisplaySelectPanel();
            onSelect(opt);
          });
          panel.appendChild(item);
        });

        document.body.appendChild(panel);
        activeDisplaySelectPanel = panel;
        highlight(selectedIndex);

        const closeOnOutside = (event: MouseEvent) => {
          const target = event.target as Node;
          if (panel.contains(target) || anchorEl.contains(target)) return;
          closeDisplaySelectPanel();
        };
        const closeOnScroll = () => closeDisplaySelectPanel();
        const onKeyDown = (event: KeyboardEvent) => {
          if (!activeDisplaySelectPanel) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            closeDisplaySelectPanel();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            highlight(Math.min(selectedIndex + 1, opts.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            highlight(Math.max(selectedIndex - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            closeDisplaySelectPanel();
            const opt = opts[selectedIndex];
            if (opt) onSelect(opt);
          }
        };

        const syncTargets = getFloatingSyncTargets(anchorEl);
        setTimeout(() => document.addEventListener('mousedown', closeOnOutside, true), 0);
        document.addEventListener('keydown', onKeyDown, true);
        for (const target of syncTargets) target.addEventListener('scroll', closeOnScroll, { passive: true });
        window.addEventListener('resize', closeOnScroll);

        activeDisplaySelectCleanup = () => {
          document.removeEventListener('mousedown', closeOnOutside, true);
          document.removeEventListener('keydown', onKeyDown, true);
          for (const target of syncTargets) target.removeEventListener('scroll', closeOnScroll);
          window.removeEventListener('resize', closeOnScroll);
        };
      }

      function createSelectTrigger(
        label: string,
        column: ColumnDef,
      ): HTMLButtonElement {
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'bg-input-box bg-input-box--dropdown bg-select-trigger';
        trigger.textContent = label;
        trigger.style.justifyContent = column.align === 'center'
          ? 'center'
          : column.align === 'right'
            ? 'flex-end'
            : 'flex-start';
        trigger.style.width = '100%';
        trigger.style.pointerEvents = 'auto';
        trigger.addEventListener('pointerdown', (event) => event.stopPropagation());
        return trigger;
      }

      function renderSelectDisplayCell(
        container: HTMLElement,
        context: CellRenderContext,
        column: ColumnDef,
        opts: DropdownOption[],
      ): void {
        container.textContent = '';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.padding = '0 8px';

        const selectedValue = getSelectedOptionValue(column, context);
        const selectedOption = getSelectedOption(opts, selectedValue);

        if (column.cellEditor !== 'selectWithInput') {
          const trigger = createSelectTrigger(selectedOption?.label ?? String(selectedValue ?? ''), column);
          trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            openDisplaySelectPanel(trigger, opts, selectedValue, (option) => {
              commitDisplaySelectValue(context, option.value);
            });
          });
          trigger.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
              event.preventDefault();
              openDisplaySelectPanel(trigger, opts, selectedValue, (option) => {
                commitDisplaySelectValue(context, option.value);
              });
            }
          });
          container.appendChild(trigger);
          return;
        }

        const cfg = getSelectInputConfig(column);
        const inputSelected = !!cfg && optionValuesEqual(selectedValue, cfg.optionValue);
        const wrapper = document.createElement('div');
        wrapper.className = 'bg-select-compound';

        const trigger = createSelectTrigger(selectedOption?.label ?? String(selectedValue ?? ''), column);
        trigger.style.flex = '1 1 auto';
        trigger.style.minWidth = '0';
        trigger.style.width = 'auto';
        const selectOption = (option: DropdownOption) => {
          const inputRaw = inputSelected
            ? getCompoundInputRawValue(column, context)
            : cfg?.defaultValue ?? '';
          const next = cfg && optionValuesEqual(option.value, cfg.optionValue)
            ? buildSelectWithInputValue(column, context, option.value, inputRaw)
            : option.value;
          commitDisplaySelectValue(context, next);
        };
        trigger.addEventListener('click', (event) => {
          event.stopPropagation();
          openDisplaySelectPanel(trigger, opts, selectedValue, selectOption);
        });
        trigger.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            openDisplaySelectPanel(trigger, opts, selectedValue, selectOption);
          }
        });
        wrapper.appendChild(trigger);

        if (inputSelected && cfg) {
          const inputWrap = document.createElement('div');
          inputWrap.className = 'bg-select-compound-input-wrap';
          inputWrap.style.width = `${cfg.width ?? 60}px`;
          inputWrap.addEventListener('pointerdown', (event) => event.stopPropagation());
          const prefix = resolveSelectInputPrefix(cfg, context.row);
          const suffix = resolveSelectInputSuffix(cfg, context.row);
          inputWrap.style.position = 'relative';
          const inputAdornmentSpace = Math.max(6, getBalancedAdornmentSpace(prefix, suffix, 6) - 4);
          inputWrap.style.setProperty('--bg-input-prefix-space', `${inputAdornmentSpace}px`);
          inputWrap.style.setProperty('--bg-input-suffix-space', `${inputAdornmentSpace}px`);

          if (prefix) {
            const prefixEl = document.createElement('span');
            prefixEl.className = 'bg-select-compound-prefix';
            prefixEl.textContent = prefix;
            inputWrap.appendChild(prefixEl);
          }

          const input = document.createElement('input');
          input.className = 'bg-select-compound-input';
          input.type = cfg.type === 'text' ? 'text' : 'number';
          if (cfg.type !== 'text') {
            input.step = cfg.precision != null ? String(Math.pow(10, -(typeof cfg.precision === 'number' ? cfg.precision : 2))) : 'any';
            input.inputMode = 'decimal';
          }
          input.value = String(getCompoundInputRawValue(column, context));
          input.addEventListener('pointerdown', (event) => event.stopPropagation());
          input.addEventListener('change', () => {
            const inputValue = coerceCompoundInputValue(input.value, cfg, context.row);
            input.value = String(inputValue);
            commitDisplaySelectValue(
              context,
              buildSelectWithInputValue(column, context, selectedValue, inputValue),
            );
          });
          input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              input.blur();
            } else if (event.key === 'Escape') {
              input.value = String(getCompoundInputRawValue(column, context));
              input.blur();
            }
          });
          inputWrap.appendChild(input);

          if (suffix) {
            const suffixEl = document.createElement('span');
            suffixEl.className = 'bg-select-compound-suffix bg-select-compound-unit';
            suffixEl.textContent = suffix;
            inputWrap.appendChild(suffixEl);
          }
          wrapper.appendChild(inputWrap);
        }

        container.appendChild(wrapper);
      }

      function getCellPositionFromElement(el: Element | null): CellPosition | null {
        if (!(el instanceof HTMLElement)) return null;
        const cell = el.closest('.bg-cell') as HTMLElement | null;
        if (!cell) return null;

        const rowIndex = Number(cell.dataset.row);
        const colIndex = Number(cell.dataset.col);
        if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) return null;

        return { rowIndex, colIndex };
      }

      function isSameCell(a: CellPosition | null, b: CellPosition | null): boolean {
        return !!a && !!b && a.rowIndex === b.rowIndex && a.colIndex === b.colIndex;
      }

      function getCellFromPoint(clientX: number, clientY: number, overlay?: HTMLElement | null): CellPosition | null {
        const previousPointerEvents = overlay?.style.pointerEvents ?? '';
        if (overlay) overlay.style.pointerEvents = 'none';

        const target = document.elementFromPoint(clientX, clientY);

        if (overlay) overlay.style.pointerEvents = previousPointerEvents;
        return getCellPositionFromElement(target);
      }

      function suppressNextClickEdit(cell: CellPosition): void {
        pendingClickEditHandoff = cell;
        if (pendingClickEditHandoffFrame !== null) {
          cancelAnimationFrame(pendingClickEditHandoffFrame);
        }
        pendingClickEditHandoffFrame = requestAnimationFrame(() => {
          pendingClickEditHandoff = null;
          pendingClickEditHandoffFrame = null;
        });
      }

      function getNextClickedCell(
        event: MouseEvent,
        overlay?: HTMLElement | null,
      ): CellPosition | null {
        const directTargetCell = getCellPositionFromElement(event.target as Element | null);
        if (directTargetCell && !isSameCell(editingCell, directTargetCell)) {
          return directTargetCell;
        }

        const pointedCell = getCellFromPoint(event.clientX, event.clientY, overlay);
        if (pointedCell && !isSameCell(editingCell, pointedCell)) {
          return pointedCell;
        }

        return null;
      }

      function handlePointerHandoff(
        cleanup: () => void,
        e: MouseEvent,
        hitTestEl?: HTMLElement | null,
      ): boolean {
        const nextCell = getNextClickedCell(e, hitTestEl);
        if (!nextCell) return false;
        suppressNextClickEdit(nextCell);
        cleanup();
        if (editingCell) commitEdit();
        startEdit(nextCell, undefined, e);
        return true;
      }

      function getFloatingSyncTargets(anchorEl: HTMLElement): Array<HTMLElement | Window> {
        const targets: Array<HTMLElement | Window> = [window];
        const seen = new Set<HTMLElement | Window>(targets);

        const gridEl = anchorEl.closest('.bg-grid') as HTMLElement | null;
        const gridScroll = gridEl?.querySelector('.bg-grid__scroll') as HTMLElement | null;
        if (gridScroll && !seen.has(gridScroll)) {
          targets.push(gridScroll);
          seen.add(gridScroll);
        }

        let current = anchorEl.parentElement;
        while (current) {
          const style = getComputedStyle(current);
          const overflowValues = [style.overflow, style.overflowX, style.overflowY];
          const isScrollable = overflowValues.some((value) =>
            value === 'auto' || value === 'scroll' || value === 'overlay',
          );

          if (isScrollable && !seen.has(current)) {
            targets.push(current);
            seen.add(current);
          }

          current = current.parentElement;
        }

        return targets;
      }

      function bindFloatingPositionSync(anchorEl: HTMLElement, sync: () => void): () => void {
        let rafId: number | null = null;
        const onSync = () => {
          if (rafId !== null) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            rafId = null;
            sync();
          });
        };

        const targets = getFloatingSyncTargets(anchorEl);
        for (const target of targets) {
          target.addEventListener('scroll', onSync, { passive: true });
        }
        window.addEventListener('resize', onSync);

        // Defense-in-depth: also listen to the grid's own scroll/column-resize/
        // frozen-clip events. The DOM 'scroll' listener above usually catches
        // every scroll source, but core fires emitter events for every layout
        // change — subscribing here means a missed DOM listener (e.g. fakeScrollbar
        // not in the ancestor chain we walk) doesn't leave the editor stranded.
        const offScroll = ctx.on('scroll', onSync);
        const offColResize = ctx.on('column:resize', onSync);
        const offFrozenClip = ctx.on('frozen:clip', onSync);

        return () => {
          if (rafId !== null) cancelAnimationFrame(rafId);
          for (const target of targets) {
            target.removeEventListener('scroll', onSync);
          }
          window.removeEventListener('resize', onSync);
          offScroll();
          offColResize();
          offFrozenClip();
        };
      }

      // -----------------------------------------------------------------------
      // Determine editor type
      // -----------------------------------------------------------------------

      function getDropdownOptions(
        column: ColumnDef,
        value: unknown,
      ): DropdownOption[] | null {
        // column.cellEditor: 'text' forces text input, skips all dropdown logic
        if (column.cellEditor === 'text') return null;

        // Explicit column.options → always dropdown
        if (Array.isArray(column.options) && column.options.length > 0) {
          return column.options.map((opt) =>
            typeof opt === 'object' && opt !== null && 'label' in opt
              ? { label: opt.label, value: opt.value }
              : { label: String(opt), value: opt },
          );
        }

        // Auto-detect: boolean value → Yes/No dropdown
        if (typeof value === 'boolean') {
          return [
            { label: config.booleanLabels[0], value: true },
            { label: config.booleanLabels[1], value: false },
          ];
        }

        return null;
      }

      // -----------------------------------------------------------------------
      // Start editing
      // -----------------------------------------------------------------------

      function startEdit(position: CellPosition, initialValue?: string, clickEvent?: MouseEvent): void {
        if (editingCell) commitEdit();

        const cellEl = getCellElement(position);
        if (!cellEl) return;

        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        if (!column) return;
        if (column.cellEditor === 'selectWithInput') return;

        // Map visual row index to data index (hierarchy may reorder/filter rows)
        const hs = state.hierarchyState;
        const dataIndex = hs ? (hs.visibleRows[position.rowIndex] ?? position.rowIndex) : position.rowIndex;
        const rowData = state.data[dataIndex];

        // Resolve editable — supports boolean or function(row, column)
        if (column.editable === false) return;
        if (typeof column.editable === 'function') {
          if (!rowData || !column.editable(rowData, column)) return;
        }

        // alwaysInput cells render their own permanent <input>. Forward focus
        // to it instead of opening the floating editor. (selectWithInput
        // already returned above; only need to exclude 'select' here.)
        if (
          rowData &&
          resolveAlwaysInput(column, rowData) &&
          column.cellEditor !== 'select'
        ) {
          const liveInput = cellEl.querySelector<HTMLInputElement>('input.bg-always-input');
          if (liveInput) {
            liveInput.focus();
            liveInput.select();
          }
          return;
        }

        editingCell = position;

        // Get current raw value
        const data = rowData;
        if (column.field && data) {
          originalValue = (data as Record<string, unknown>)[column.field];
        } else {
          originalValue = cellEl.textContent;
        }

        // Check if this should be a dropdown or autocomplete
        const isAutocomplete = column.cellEditor === 'autocomplete';
        const dropdownOpts = getDropdownOptions(column, originalValue);

        // Prepare cell for editing
        // If the cell has an input box (inputStyle), use it as the editing anchor
        const inputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
        const inputEllipsisEnabled = shouldUseInputEllipsis(column, rowData);
        const displayWasOverflowing = inputEllipsisEnabled && inputBox ? isInputDisplayOverflowing(inputBox) : false;
        // If the input box is structured as value+unit, clear only the value span
        // so the unit suffix stays visible throughout editing.
        const valueSpan = inputBox?.querySelector('.bg-input-box__value') as HTMLElement | null;
        if (valueSpan) {
          valueSpan.textContent = '';
        } else if (inputBox) {
          inputBox.textContent = '';
        } else {
          cellEl.textContent = '';
        }
        cellEl.classList.add('bg-cell--editing');

        // Hide fill handle during editing
        const fillHandle = getGridContainer().querySelector('.bg-fill-handle') as HTMLElement | null;
        if (fillHandle) fillHandle.style.display = 'none';

        if (isAutocomplete) {
          const opts = dropdownOpts ?? [];
          activeEditor = createAutocomplete(cellEl, opts, originalValue, column);
        } else if (dropdownOpts) {
          activeEditor = createDropdown(cellEl, dropdownOpts, originalValue, column);
        } else {
          // Determine display string for the editor
          // Use valueFormatter if available (e.g. date formatting)
          let rawStr = originalValue != null
            ? (column.valueFormatter ? column.valueFormatter(originalValue, rowData as never) : String(originalValue))
            : '';

          if (column.cellType === 'bigint') {
            // BigInt: use String() to preserve full integer precision
            rawStr = originalValue != null ? String(originalValue) : '';
          } else if (column.cellType === 'percent' && typeof originalValue === 'number') {
            // For percent: show user-friendly value (5 instead of 0.05)
            // Avoid floating point: 0.0008 * 100 = 0.08 not 0.07999...
            rawStr = String(parseFloat((originalValue * 100).toPrecision(12)));
          } else if (
            (column.cellType === 'number' || column.cellType === 'currency') &&
            typeof originalValue === 'number'
          ) {
            // Apply precision formatting when starting edit
            const prec = getPrecision(column, rowData);
            if (prec != null) {
              rawStr = originalValue.toFixed(prec);
            }
          }
          rawStr = stripInputAdornments(
            rawStr,
            resolveColumnPrefix(column, rowData),
            resolveColumnSuffix(column, rowData),
          );

          // Check editor type or auto-detect from cellType
          const isDateEditor = column.cellEditor === 'date' ||
            (!column.cellEditor && column.cellType === 'date');
          const isNumberEditor = column.cellEditor === 'number' ||
            (!column.cellEditor && (column.cellType === 'number' || column.cellType === 'currency'));

          const editValue = initialValue ?? rawStr;
          const hasAdornedInputBox = !!cellEl.querySelector('.bg-input-box--has-adornment .bg-input-box__value');
          const shouldFloatOverflowInput = displayWasOverflowing && initialValue === undefined;

          if (column.cellEditor === 'masked' && column.mask) {
            activeEditor = createMaskedInput(cellEl, rawStr, column.mask, clickEvent);
          } else if (isDateEditor) {
            activeEditor = createDateInput(cellEl, rawStr);
          } else if (shouldFloatOverflowInput) {
            const prefix = resolveColumnPrefix(column, rowData);
            const suffix = resolveColumnSuffix(column, rowData);
            const displayText = stripInputAdornments(
              getInputStyleDisplayText(column, rowData, originalValue, position.rowIndex, position.colIndex),
              prefix,
              suffix,
            );
            activeEditor = createTextInput(cellEl, displayText || rawStr, false, isNumberEditor ? column : undefined, rowData, clickEvent);
          } else if (config.editorMode === 'inline' || hasAdornedInputBox) {
            activeEditor = createInlineTextInput(cellEl, editValue, initialValue !== undefined, isNumberEditor ? column : undefined, rowData, clickEvent, inputEllipsisEnabled);
          } else if (isNumberEditor) {
            activeEditor = createTextInput(cellEl, editValue, initialValue !== undefined, column, rowData, clickEvent);
          } else {
            activeEditor = createTextInput(cellEl, editValue, initialValue !== undefined, undefined, undefined, clickEvent);
          }
        }
      }

      // -----------------------------------------------------------------------
      // Text input editor
      // -----------------------------------------------------------------------

      function createTextInput(
        cellEl: HTMLElement,
        value: string,
        cursorAtEnd: boolean,
        numberColumn?: ColumnDef,
        rowData?: unknown,
        clickEvent?: MouseEvent,
        selectionRange?: { start: number; end: number },
      ): HTMLInputElement {
          // Use input box rect if present (inputStyle mode), otherwise cell rect
          const inputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
          const anchorEl = inputBox ?? cellEl;
          const cellRect = anchorEl.getBoundingClientRect();
          const gridEl = cellEl.closest('.bg-grid') as HTMLElement | null;
          const gridRect = gridEl?.getBoundingClientRect();
          const anchorComputed = getComputedStyle(anchorEl);
          const cellFont = anchorComputed.font;
          const cellTextAlign = anchorComputed.textAlign;
          const cellLetterSpacing = anchorComputed.letterSpacing;
          const maxRightWidth = gridRect ? gridRect.right - cellRect.left : cellRect.width;
          const fullWidth = gridRect?.width ?? cellRect.width;
          const gridLeft = gridRect?.left ?? cellRect.left;
          const prefixSource = inputBox?.querySelector('.bg-input-box__prefix') as HTMLElement | null;
          const suffixSource = inputBox?.querySelector('.bg-input-box__suffix, .bg-input-box__unit') as HTMLElement | null;
          const prefixText = prefixSource?.textContent ?? '';
          const suffixText = suffixSource?.textContent ?? '';
          const inputBoxStyles = inputBox ? getComputedStyle(inputBox) : null;
          const prefixSpace = prefixText
            ? parseFloat(inputBoxStyles?.getPropertyValue('--bg-input-prefix-space') || '') || getAdornmentSpace(prefixText)
            : 0;
          const suffixSpace = suffixText
            ? parseFloat(inputBoxStyles?.getPropertyValue('--bg-input-suffix-space') || '') || getAdornmentSpace(suffixText)
            : 0;

          // Measure span for auto-sizing
          const measureSpan = document.createElement('span');
          document.body.appendChild(measureSpan);

          // CSS variables are resolved from the grid container (not body)
          // so consumer-provided themes win over default values.
          const floatBox = document.createElement('div');
          floatBox.className = 'bg-cell-editor-float';
          const gridStyles = getComputedStyle(getGridContainer());
          const edBorderW = parseFloat(gridStyles.getPropertyValue('--bg-editor-border-width').trim() || '2');
          const edBg = gridStyles.getPropertyValue('--bg-editor-bg').trim() || '#fff';
          const edBorder = gridStyles.getPropertyValue('--bg-editor-border').trim() || gridStyles.getPropertyValue('--bg-active-border').trim() || '#1a73e8';
          const edRadius = gridStyles.getPropertyValue('--bg-editor-radius').trim() || '2px';
          const edShadow = gridStyles.getPropertyValue('--bg-editor-shadow').trim() || '0 2px 8px rgba(0,0,0,0.15)';
          floatBox.style.cssText = `
            position: fixed; z-index: 200; box-sizing: border-box;
            top: ${cellRect.top}px; left: ${cellRect.left}px;
            min-width: ${cellRect.width}px; max-width: ${fullWidth}px;
            background: ${edBg};
            border: ${edBorderW}px solid ${edBorder};
            border-radius: ${edRadius};
            box-shadow: ${edShadow};
            overflow: hidden;
          `;

          // contenteditable (vs <input>) keeps text vertically centered without
          // needing a flex parent — important when the float spans multiple lines.
          // (via flexbox) and word-wrap without textarea quirks
          const ed = document.createElement('div');
          ed.className = 'bg-cell-editor';
          ed.contentEditable = 'true';
          ed.textContent = value;
          // Match cell position exactly. Use normal line-height + vertical padding
          // for centering, so text selection highlight doesn't span full cell height.
          const fontSize = parseFloat(anchorComputed.fontSize) || 14;
          const contentLineHeight = Math.round(fontSize * 1.4);
          const editorHeight = cellRect.height - edBorderW * 2;
          const vertPad = Math.max(0, Math.floor((editorHeight - contentLineHeight) / 2));
          const basePadLeft = parseFloat(anchorComputed.paddingLeft) || 12;
          const basePadRight = parseFloat(anchorComputed.paddingRight) || basePadLeft;
          const valuePadLeft = Math.max(basePadLeft, prefixSpace);
          const valuePadRight = Math.max(basePadRight, suffixSpace);
          measureSpan.style.cssText = `position:fixed;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;font:${cellFont};padding:0 ${valuePadRight}px 0 ${valuePadLeft}px;`;

          const createFloatAdornment = (
            text: string,
            source: HTMLElement | null,
            side: 'left' | 'right',
            width: number,
          ): HTMLElement | null => {
            if (!text) return null;
            const sourceStyles = source ? getComputedStyle(source) : anchorComputed;
            const adornment = document.createElement('span');
            adornment.className = `bg-cell-editor-float__${side === 'left' ? 'prefix' : 'suffix'}`;
            adornment.textContent = text;
            adornment.style.cssText = `
              position:absolute; ${side}:0; top:0; bottom:0;
              width:${width}px; display:flex; align-items:center; justify-content:center;
              pointer-events:none; box-sizing:border-box;
              font-family:${sourceStyles.fontFamily || anchorComputed.fontFamily};
              font-size:${sourceStyles.fontSize || anchorComputed.fontSize};
              font-weight:${sourceStyles.fontWeight || anchorComputed.fontWeight};
              color:${sourceStyles.color || anchorComputed.color};
              line-height:${editorHeight}px;
            `;
            return adornment;
          };

          ed.style.cssText = `
            outline:none; margin:0;
            font-family:${anchorComputed.fontFamily}; font-size:${anchorComputed.fontSize};
            font-weight:${anchorComputed.fontWeight}; line-height:${contentLineHeight}px;
            color:inherit; letter-spacing:${cellLetterSpacing};
            background:transparent; box-sizing:border-box;
            padding:${vertPad}px ${valuePadRight}px ${vertPad}px ${valuePadLeft}px; text-align:${cellTextAlign};
            min-height:${editorHeight}px;
            max-height:${editorHeight * 4}px;
            overflow:hidden;
            white-space:nowrap;
          `;

          const prefixEl = createFloatAdornment(prefixText, prefixSource, 'left', prefixSpace);
          const suffixEl = createFloatAdornment(suffixText, suffixSource, 'right', suffixSpace);
          if (prefixEl) floatBox.appendChild(prefixEl);
          floatBox.appendChild(ed);
          if (suffixEl) floatBox.appendChild(suffixEl);

          // Number editor: add inputmode hint and restrict input to numeric characters
          if (numberColumn) {
            ed.setAttribute('inputmode', 'decimal');
            const numberPrecision = getPrecision(numberColumn, rowData);
            const numberMin = getMin(numberColumn, rowData);
            const numberMax = getMax(numberColumn, rowData);

            ed.addEventListener('keydown', (e) => {
              // Allow control-modified keys (Ctrl+A/C/V/X etc.)
              if (e.ctrlKey || e.metaKey || e.altKey) return;
              // ArrowUp/Down: increment/decrement value, clamped to min/max
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const text = ed.textContent || '';
                const cur = parseFloat(text.replace(/,/g, '')) || 0;
                const step = numberPrecision != null ? Math.pow(10, -numberPrecision) : 1;
                const delta = e.key === 'ArrowUp' ? step : -step;
                let next = cur + delta;
                if (numberPrecision != null) {
                  next = parseFloat(next.toFixed(numberPrecision));
                }
                if (numberMin != null && next < numberMin) next = numberMin;
                if (numberMax != null && next > numberMax) next = numberMax;
                ed.textContent = String(next);
                setContentEditableSelection(ed, 0, (ed.textContent ?? '').length);
                return;
              }
              // Allow navigation and control keys
              if (['Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
                   'ArrowLeft', 'ArrowRight',
                   'Home', 'End'].includes(e.key)) return;
              // Allow digits, minus, period
              if (/^[0-9.\-]$/.test(e.key)) {
                const text = ed.textContent || '';
                const selection = window.getSelection();
                const hasSelection = selection && selection.rangeCount > 0 &&
                  !selection.getRangeAt(0).collapsed;

                // Prevent multiple periods
                if (e.key === '.' && text.includes('.') && !hasSelection) {
                  e.preventDefault();
                  return;
                }
                // Prevent minus except at start when no existing minus
                if (e.key === '-') {
                  if (text.includes('-') && !hasSelection) {
                    e.preventDefault();
                    return;
                  }
                  // Only allow minus at cursor position 0
                  if (selection && selection.anchorOffset !== 0) {
                    e.preventDefault();
                    return;
                  }
                }
                // Enforce precision: prevent more decimal places than allowed
                if (numberPrecision != null && /^[0-9]$/.test(e.key) && !hasSelection) {
                  const dotIndex = text.indexOf('.');
                  if (dotIndex !== -1) {
                    const decimals = text.length - dotIndex - 1;
                    const cursorOffset = selection?.anchorOffset ?? text.length;
                    if (cursorOffset > dotIndex && decimals >= numberPrecision) {
                      e.preventDefault();
                      return;
                    }
                  }
                }
                return;
              }
              // Block everything else
              e.preventDefault();
            });
          }

          document.body.appendChild(floatBox);
          activeFloatBox = floatBox;

          function autoSize(): void {
            measureSpan.textContent = ed.textContent || ' ';
            const textWidth = measureSpan.offsetWidth + 16;

            if (textWidth <= maxRightWidth) {
              floatBox.style.left = `${cellRect.left}px`;
              floatBox.style.width = `${Math.max(cellRect.width, textWidth)}px`;
            } else {
              floatBox.style.left = `${gridLeft}px`;
              floatBox.style.width = `${fullWidth}px`;
            }

            // When content overflows, switch to wrap mode
            if (ed.scrollHeight > editorHeight) {
              ed.style.whiteSpace = 'pre-wrap';
              ed.style.wordBreak = 'break-word';
              ed.style.lineHeight = '1.5';
              ed.style.overflow = 'auto';
              ed.style.padding = `${basePadLeft}px ${valuePadRight}px ${basePadLeft}px ${valuePadLeft}px`;
            } else {
              ed.style.whiteSpace = 'nowrap';
              ed.style.lineHeight = `${contentLineHeight}px`;
              ed.style.overflow = 'hidden';
              ed.style.padding = `${vertPad}px ${valuePadRight}px ${vertPad}px ${valuePadLeft}px`;
            }
          }

          const editRow = cellEl.dataset.row;
          const editCol = cellEl.dataset.col;

          function syncPosition(): void {
            // Find current cell element by row/col (may be recycled by virtualization)
            const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
            const gr = gridEl?.getBoundingClientRect();

            if (!currentCell || !gr) {
              // Cell not in DOM (virtualized out) — hide float
              floatBox.style.visibility = 'hidden';
              return;
            }

            const box = currentCell.querySelector('.bg-input-box') as HTMLElement | null;
            let cr: DOMRect;
            if (box) {
              cr = box.getBoundingClientRect();
            } else {
              cr = currentCell.getBoundingClientRect();
            }
            const headerH = parseFloat(gridEl?.querySelector('.bg-grid__headers')?.getBoundingClientRect().height + '' || '0');
            const cellVisible = cr.bottom > (gr.top + headerH) && cr.top < gr.bottom && cr.right > gr.left && cr.left < gr.right;
            floatBox.style.visibility = cellVisible ? 'visible' : 'hidden';
            if (!cellVisible) return;

            // Update position
            measureSpan.textContent = ed.textContent || ' ';
            const textWidth = measureSpan.offsetWidth + 16;
            const curMaxRight = gr.right - cr.left;
            const curFullWidth = gr.width;
            const curGridLeft = gr.left;

            floatBox.style.top = `${cr.top}px`;
            if (textWidth <= curMaxRight) {
              floatBox.style.left = `${cr.left}px`;
              floatBox.style.width = `${Math.max(cr.width, textWidth)}px`;
            } else {
              floatBox.style.left = `${curGridLeft}px`;
              floatBox.style.width = `${curFullWidth}px`;
            }
          }

          autoSize();
          const unbindPositionSync = bindFloatingPositionSync(cellEl, syncPosition);
          syncPosition();
          ed.addEventListener('input', () => {
            autoSize();
            syncPosition();
          });
          ed.focus();

          const edText = ed.textContent ?? '';
          if (selectionRange) {
            setContentEditableSelection(ed, selectionRange.start, selectionRange.end);
          } else if (clickEvent && !cursorAtEnd) {
            const offset = getTextOffsetFromClientX(edText, ed.getBoundingClientRect(), getComputedStyle(ed), clickEvent.clientX);
            setContentEditableCaret(ed, offset);
          } else if (cursorAtEnd) {
            setContentEditableCaret(ed, edText.length);
          } else {
            setContentEditableSelection(ed, 0, edText.length);
          }

          ed.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              cleanupFloat();
            }
            if (e.key === 'Escape') {
              cleanupFloat();
            }
            handleEditorKeydown(e);
          });
          ed.addEventListener('dblclick', () => {
            requestAnimationFrame(() => setContentEditableSelection(ed, 0, (ed.textContent ?? '').length));
          });
          let floatActive = true;

          function cleanupFloat(): void {
            if (!floatActive) return;
            floatActive = false;
            measureSpan.remove();
            floatBox.remove();
            activeFloatBox = null;
            unbindPositionSync();
            document.removeEventListener('mousedown', onOutsideClick, true);
          }

          // Commit on click outside the float box (not blur-based)
          function onOutsideClick(e: MouseEvent): void {
            if (!floatActive) return;
            if (floatBox.contains(e.target as Node)) return;
            if (handlePointerHandoff(cleanupFloat, e, floatBox)) return;

            cleanupFloat();
            if (editingCell) commitEdit();
          }
          // Delay to avoid the dblclick that opened the editor
          setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);
          // Register so cleanupEdit can call it on Escape/Enter/transition
          activeOutsideClickCleanup = cleanupFloat;

          // Shim: make contenteditable act like an input for commit
          const editorShim = {
            get value() { return ed.textContent ?? ''; },
            set value(v: string) { ed.textContent = v; },
            focus() { ed.focus(); },
            removeEventListener: ed.removeEventListener.bind(ed),
            addEventListener: ed.addEventListener.bind(ed),
            select() { setContentEditableSelection(ed, 0, (ed.textContent ?? '').length); },
            setSelectionRange(start: number, end: number) { setContentEditableSelection(ed, start, end); },
            dispatchEvent: ed.dispatchEvent.bind(ed),
          } as unknown as HTMLInputElement;
          activeEditor = editorShim;
          return editorShim;
      }

      // -----------------------------------------------------------------------
      // Inline text input editor (renders inside the cell)
      // -----------------------------------------------------------------------

      function createInlineTextInput(
        cellEl: HTMLElement,
        value: string,
        cursorAtEnd: boolean,
        numberColumn?: ColumnDef,
        rowData?: unknown,
        clickEventRef?: MouseEvent,
        inputEllipsisEnabled = true,
      ): HTMLInputElement {
        // Capture computed styles BEFORE clearing cell content
        const computed = getComputedStyle(cellEl);
        const cellFont = computed.font;
        const cellTextAlign = computed.textAlign;
        const cellLetterSpacing = computed.letterSpacing;

        // Create a simple input inside the cell
        // The cell already has padding, so the input uses padding: 0 to avoid double padding
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor bg-cell-editor--inline';
        input.value = value;
        input.style.cssText = `
          width: 100%; height: 100%;
          border: none; outline: none;
          font: ${cellFont}; padding: 0;
          text-align: ${cellTextAlign}; letter-spacing: ${cellLetterSpacing};
          margin: 0; box-sizing: border-box;
          background: transparent; color: inherit;
        `;

        // Number filtering (same as float mode)
        if (numberColumn) {
          input.inputMode = 'decimal';
          const numberPrecision = getPrecision(numberColumn, rowData);
          const numberMin = getMin(numberColumn, rowData);
          const numberMax = getMax(numberColumn, rowData);

          // Thousand-separator formatting — retain comma grouping
          // while editing ("27,000,000") rather than reverting to the raw
          // "27000000". Uses toLocaleString to insert commas in the integer
          // portion; decimal portion is kept verbatim so mid-typing strings
          // like "10." don't lose the trailing dot.
          const formatWithCommas = (raw: string): string => {
            if (!raw) return raw;
            // Keep a leading minus if present
            const negative = raw.startsWith('-');
            const body = negative ? raw.slice(1) : raw;
            const [intPart = '', ...decParts] = body.split('.');
            const decPart = decParts.join('.');
            const cleanInt = intPart.replace(/\D/g, '');
            const formattedInt = cleanInt
              ? Number(cleanInt).toLocaleString('en-AU', { useGrouping: true, maximumFractionDigits: 0 })
              : '';
            const result = decPart !== undefined && body.includes('.')
              ? `${formattedInt}.${decPart.replace(/\D/g, '')}`
              : formattedInt;
            return negative ? `-${result}` : result;
          };

          // Format initial display with commas so open-edit matches the
          // read-only display. stripInputAdornments already removed any
          // $/% adornment before this function was called.
          input.value = formatWithCommas(input.value);

          // Reformat on every keystroke + preserve cursor position by
          // counting digits before the caret before + after reformat.
          input.addEventListener('input', () => {
            const before = input.value;
            const caret = input.selectionStart ?? before.length;
            const digitsBeforeCaret = before.slice(0, caret).replace(/[^0-9.-]/g, '').length;
            const reformatted = formatWithCommas(before);
            if (reformatted === before) return;
            input.value = reformatted;
            // Walk forward through the new string until we've passed the
            // same number of digits we had before, then park the caret there.
            let pos = 0, seen = 0;
            while (pos < reformatted.length && seen < digitsBeforeCaret) {
              if (/[0-9.-]/.test(reformatted[pos]!)) seen++;
              pos++;
            }
            input.setSelectionRange(pos, pos);
          });

          input.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            // ArrowUp/Down: increment/decrement value, clamped to min/max
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const cur = parseFloat(input.value.replace(/,/g, '')) || 0;
              const step = numberPrecision != null ? Math.pow(10, -numberPrecision) : 1;
              const delta = e.key === 'ArrowUp' ? step : -step;
              let next = cur + delta;
              if (numberPrecision != null) {
                next = parseFloat(next.toFixed(numberPrecision));
              }
              if (numberMin != null && next < numberMin) next = numberMin;
              if (numberMax != null && next > numberMax) next = numberMax;
              input.value = formatWithCommas(String(next));
              input.select();
              return;
            }
            if (['Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
                 'ArrowLeft', 'ArrowRight',
                 'Home', 'End'].includes(e.key)) return;
            if (/^[0-9.\-]$/.test(e.key)) {
              const text = input.value;
              const selStart = input.selectionStart ?? text.length;
              const selEnd = input.selectionEnd ?? text.length;
              const hasSelection = selStart !== selEnd;

              if (e.key === '.' && text.includes('.') && !hasSelection) { e.preventDefault(); return; }
              if (e.key === '-') {
                if (text.includes('-') && !hasSelection) { e.preventDefault(); return; }
                if (selStart !== 0) { e.preventDefault(); return; }
              }
              if (numberPrecision != null && /^[0-9]$/.test(e.key) && !hasSelection) {
                const dotIndex = text.indexOf('.');
                if (dotIndex !== -1 && selStart > dotIndex && text.length - dotIndex - 1 >= numberPrecision) {
                  e.preventDefault(); return;
                }
              }
              return;
            }
            e.preventDefault();
          });
        }

        // If the cell has a structured value/adornment input-box, anchor the
        // editor inside the value span so edge adornments stay visible.
        const inlineInputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
        const valueAnchor = inlineInputBox?.querySelector('.bg-input-box__value') as HTMLElement | null;
        if (valueAnchor) {
          const adornedBox = valueAnchor.closest('.bg-input-box--has-adornment') as HTMLElement | null;
          if (adornedBox) {
            input.style.width = '100%';
            input.style.minWidth = '0';
            input.style.textAlign = getComputedStyle(valueAnchor).textAlign || cellTextAlign;
          } else {
            input.style.width = `${Math.max(40, Math.min(72, value.length * 8 + 14))}px`;
            input.style.minWidth = '40px';
            input.style.textAlign = 'right';
          }
          input.style.height = '30px';
          valueAnchor.appendChild(input);
        } else {
          cellEl.appendChild(input);
        }

        let promotedToFloat = false;
        function maybePromoteInlineOverflow(): void {
          if (!inputEllipsisEnabled || promotedToFloat || !inlineInputBox || !document.body.contains(input)) return;
          if (input.scrollWidth <= input.clientWidth + 1) return;

          promotedToFloat = true;
          const selectionStart = input.selectionStart ?? input.value.length;
          const selectionEnd = input.selectionEnd ?? selectionStart;
          const nextValue = input.value;
          cleanupOutsideClick();
          input.remove();
          activeEditor = createTextInput(
            cellEl,
            nextValue,
            false,
            numberColumn,
            rowData,
            undefined,
            { start: selectionStart, end: selectionEnd },
          );
        }

        input.focus();

        if (cursorAtEnd) {
          input.setSelectionRange(value.length, value.length);
        } else {
          // `caretPositionFromPoint` doesn't resolve character offsets inside
          // <input> elements (always returns 0), so we measure via canvas to
          // land the caret at the clicked character.
          const clickX = clickEventRef?.clientX;
          const displayValue = input.value;
          const offset = clickX != null && displayValue.length > 0
            ? getTextOffsetFromClientX(displayValue, input.getBoundingClientRect(), window.getComputedStyle(input), clickX)
            : displayValue.length;
          input.setSelectionRange(offset, offset);
        }

        // Keyboard handling
        input.addEventListener('keydown', (e) => {
          handleEditorKeydown(e);
        });
        input.addEventListener('dblclick', () => {
          requestAnimationFrame(() => input.select());
        });
        const onPromoteCheck = () => {
          requestAnimationFrame(() => {
            maybePromoteInlineOverflow();
            if (promotedToFloat) input.removeEventListener('input', onPromoteCheck);
          });
        };
        input.addEventListener('input', onPromoteCheck);

        // Commit on click outside the cell
        let outsideClickActive = true;
        function cleanupOutsideClick(): void {
          if (!outsideClickActive) return;
          outsideClickActive = false;
          document.removeEventListener('mousedown', onOutsideClick, true);
          activeOutsideClickCleanup = null;
        }

        function onOutsideClick(e: MouseEvent): void {
          if (!outsideClickActive) return;
          if (cellEl.contains(e.target as Node)) return;
          if (handlePointerHandoff(cleanupOutsideClick, e, input)) return;
          cleanupOutsideClick();
          if (editingCell) {
            commitEdit();
          }
          // Don't clearSelection — let handlePointerDown select the clicked cell
        }
        setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);
        activeOutsideClickCleanup = cleanupOutsideClick;

        return input;
      }

      // -----------------------------------------------------------------------
      // Date input editor
      // -----------------------------------------------------------------------

      // -----------------------------------------------------------------------
      // Masked input editor (e.g. MM/YY, DD/MM/YYYY, HH:mm:ss)
      // -----------------------------------------------------------------------

      // Section validation rules keyed by label (case-sensitive: MM=month, mm=minutes).
      // autoPadFrom: first digit at or above this triggers "0X" auto-pad.
      function sectionValidation(label: string, _secLen: number): { min: number; max: number; autoPadFrom: number } | null {
        switch (label) {
          case 'MM': return { min: 1, max: 12, autoPadFrom: 2 };
          case 'DD': return { min: 1, max: 31, autoPadFrom: 4 };
          case 'HH': return { min: 0, max: 23, autoPadFrom: 3 };
          case 'mm': case 'ss': case 'SS': return { min: 0, max: 59, autoPadFrom: 6 };
          default: return null;
        }
      }

      function createMaskedInput(
        cellEl: HTMLElement,
        value: string,
        mask: string,
        clickEvent?: MouseEvent,
      ): HTMLInputElement {
        const inputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
        const anchorEl = inputBox ?? cellEl;
        const cellRect = anchorEl.getBoundingClientRect();
        const gridStyles = getComputedStyle(getGridContainer());
        const edBorderW = parseFloat(gridStyles.getPropertyValue('--bg-editor-border-width').trim() || '2');
        const edBg = gridStyles.getPropertyValue('--bg-editor-bg').trim() || '#fff';
        const edBorder = gridStyles.getPropertyValue('--bg-editor-border').trim() || gridStyles.getPropertyValue('--bg-active-border').trim() || '#1a73e8';
        const edRadius = gridStyles.getPropertyValue('--bg-editor-radius').trim() || '2px';
        const edShadow = gridStyles.getPropertyValue('--bg-editor-shadow').trim() || '0 2px 8px rgba(0,0,0,0.15)';

        const sectionLengths: number[] = [];
        const sectionLabels: string[] = [];
        const separators: { pos: number; char: string }[] = [];
        let currentSectionLength = 0;
        let currentSectionLabel = '';
        for (const ch of mask) {
          if (/[A-Za-z]/.test(ch)) {
            currentSectionLength += 1;
            currentSectionLabel += ch;
          } else {
            if (currentSectionLength > 0) {
              sectionLengths.push(currentSectionLength);
              sectionLabels.push(currentSectionLabel);
              currentSectionLength = 0;
              currentSectionLabel = '';
            }
            separators.push({ pos: sectionLengths.length, char: ch });
          }
        }
        if (currentSectionLength > 0) {
          sectionLengths.push(currentSectionLength);
          sectionLabels.push(currentSectionLabel);
        }

        // ── Section-based state ──────────────────────────────────────────
        // Each section independently holds its digits or is empty (shows label).
        // e.g. sectionValues = ['12', '25'] for "12/25", or ['', '25'] for "MM/25"
        const initialDigits = value.replace(/\D/g, '');
        const sectionValues: string[] = [];
        let digitOffset = 0;
        for (let i = 0; i < sectionLengths.length; i += 1) {
          const len = sectionLengths[i]!;
          const part = initialDigits.slice(digitOffset, digitOffset + len);
          sectionValues.push(part.length === len ? part : '');
          digitOffset += len;
        }
        let activeSectionIdx = 0;

        // Build the display string: filled sections show digits, empty show label
        function buildDisplayValue(): string {
          let result = '';
          for (let i = 0; i < sectionLengths.length; i += 1) {
            // Insert separators that come before this section
            for (const sep of separators) {
              if (sep.pos === i) result += sep.char;
            }
            result += sectionValues[i] || sectionLabels[i] || ''.padEnd(sectionLengths[i]!, '_');
          }
          // Trailing separators
          for (const sep of separators) {
            if (sep.pos === sectionLengths.length) result += sep.char;
          }
          return result;
        }

        // Get character range [start, end) of a section in the display string
        function getSectionRange(sectionIndex: number): { start: number; end: number } {
          let pos = 0;
          for (let i = 0; i < sectionLengths.length; i += 1) {
            for (const sep of separators) {
              if (sep.pos === i) pos += sep.char.length;
            }
            const len = sectionValues[i]
              ? sectionValues[i]!.length
              : (sectionLabels[i]?.length ?? sectionLengths[i]!);
            if (i === sectionIndex) return { start: pos, end: pos + len };
            pos += len;
          }
          return { start: 0, end: 0 };
        }

        function getSectionAtCursor(cursorPos: number): number {
          for (let i = sectionLengths.length - 1; i >= 0; i -= 1) {
            const range = getSectionRange(i);
            if (cursorPos >= range.start) return i;
          }
          return 0;
        }

        function syncInputDisplay(): void {
          input.value = buildDisplayValue();
          const range = getSectionRange(activeSectionIdx);
          input.setSelectionRange(range.start, range.end);
          syncDisplayLayer();
        }

        // Get the committed value (only digits from filled sections, joined by separator)
        function getCommitValue(): string {
          const allFilled = sectionValues.every((v) => v !== '');
          if (!allFilled) return '';
          return sectionValues.join('/');
        }

        // Capture cell's computed font so editor matches cell rendering
        const anchorComputed = getComputedStyle(anchorEl);

        // Create float box
        const floatBox = document.createElement('div');
        floatBox.className = 'bg-cell-editor-float';
        floatBox.style.cssText = `
          position: fixed; z-index: 200; box-sizing: border-box;
          top: ${cellRect.top}px; left: ${cellRect.left}px;
          min-width: ${cellRect.width}px;
          background: ${edBg};
          border: ${edBorderW}px solid ${edBorder};
          border-radius: ${edRadius};
          box-shadow: ${edShadow};
          height: ${cellRect.height}px;
          font-size: ${anchorComputed.fontSize};
          font-family: ${anchorComputed.fontFamily};
        `;

        // Display layer: spans with per-section coloring (digits = normal, labels = grey)
        const displayJustify = anchorComputed.textAlign === 'center'
          ? 'center'
          : (anchorComputed.textAlign === 'right' || anchorComputed.textAlign === 'end') ? 'flex-end' : 'flex-start';
        const displayLayer = document.createElement('div');
        displayLayer.style.cssText = `
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center;
          justify-content: ${displayJustify};
          font-family: ${anchorComputed.fontFamily};
          font-size: ${anchorComputed.fontSize};
          font-weight: ${anchorComputed.fontWeight};
          letter-spacing: ${anchorComputed.letterSpacing};
          padding: ${anchorComputed.padding};
          pointer-events: none;
          white-space: nowrap;
        `;

        const placeholderColor = getComputedStyle(cellEl).color;
        const sectionSpans: HTMLElement[] = [];

        function getSectionAtClientX(clientX: number): number {
          let closestSection = activeSectionIdx;
          let closestDistance = Infinity;

          for (let i = 0; i < sectionSpans.length; i += 1) {
            const span = sectionSpans[i];
            if (!span) continue;

            const rect = span.getBoundingClientRect();
            if (rect.width <= 0) continue;

            if (clientX >= rect.left && clientX <= rect.right) return i;

            const distance = clientX < rect.left
              ? rect.left - clientX
              : clientX - rect.right;
            if (distance < closestDistance) {
              closestDistance = distance;
              closestSection = i;
            }
          }

          return closestSection;
        }

        function syncDisplayLayer(): void {
          displayLayer.innerHTML = '';
          sectionSpans.length = 0;
          for (let i = 0; i < sectionLengths.length; i += 1) {
            // Separators before this section
            for (const sep of separators) {
              if (sep.pos === i) {
                const sepSpan = document.createElement('span');
                sepSpan.textContent = sep.char;
                sepSpan.style.color = placeholderColor;
                displayLayer.appendChild(sepSpan);
              }
            }
            const span = document.createElement('span');
            const filled = sectionValues[i];
            span.textContent = filled || sectionLabels[i] || '';
            span.style.color = filled ? 'inherit' : placeholderColor;
            sectionSpans[i] = span;
            displayLayer.appendChild(span);
          }
          // Trailing separators
          for (const sep of separators) {
            if (sep.pos === sectionLengths.length) {
              const sepSpan = document.createElement('span');
              sepSpan.textContent = sep.char;
              sepSpan.style.color = placeholderColor;
              displayLayer.appendChild(sepSpan);
            }
          }
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor bg-cell-editor--masked';
        input.value = buildDisplayValue();
        input.style.cssText = `
          position: relative; z-index: 1;
          width: 100%;
          height: ${cellRect.height - edBorderW * 2}px;
          border: none;
          outline: none;
          background: transparent;
          box-sizing: border-box;
          font-family: ${anchorComputed.fontFamily};
          font-size: ${anchorComputed.fontSize};
          font-weight: ${anchorComputed.fontWeight};
          letter-spacing: ${anchorComputed.letterSpacing};
          color: transparent;
          text-align: ${anchorComputed.textAlign};
          padding: ${anchorComputed.padding};
          caret-color: transparent;
        `;

        // All input goes through keydown — prevent browser from mutating the value
        input.addEventListener('beforeinput', (e) => { e.preventDefault(); });

        // Click on MM or YY → select that section
        input.addEventListener('mouseup', (e) => {
          activeSectionIdx = getSectionAtClientX(e.clientX);
          const range = getSectionRange(activeSectionIdx);
          input.setSelectionRange(range.start, range.end);
        });

        input.addEventListener('keydown', (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            handleEditorKeydown(e);
            return;
          }

          // Digit: type into active section
          if (/^\d$/.test(e.key)) {
            e.preventDefault();
            const secLen = sectionLengths[activeSectionIdx]!;
            const cur = sectionValues[activeSectionIdx] || '';
            const label = sectionLabels[activeSectionIdx] ?? '';
            const sv = sectionValidation(label, secLen);

            // If section is full, replace it (start fresh)
            let next = cur.length >= secLen ? e.key : cur + e.key;

            // Auto-pad: first digit already exceeds max tens → "0X" and advance
            if (sv && next.length === 1 && Number(next) >= sv.autoPadFrom) {
              next = `0${next}`;
            }
            // Validation: if completed value is out of range, auto-pad first
            // digit and spill the second into the next section
            if (sv && next.length >= 2) {
              const num = Number(next.slice(0, 2));
              if (num < sv.min || num > sv.max) {
                const spillDigit = next[1]!;
                sectionValues[activeSectionIdx] = `0${next[0]}`;
                if (activeSectionIdx < sectionLengths.length - 1) {
                  activeSectionIdx += 1;
                  sectionValues[activeSectionIdx] = spillDigit;
                }
                syncInputDisplay();
                return;
              }
            }

            sectionValues[activeSectionIdx] = next.slice(0, secLen);

            // Auto-advance to next section when current is full
            if (sectionValues[activeSectionIdx]!.length >= secLen && activeSectionIdx < sectionLengths.length - 1) {
              activeSectionIdx += 1;
            }

            syncInputDisplay();
            return;
          }

          // Backspace: clear active section, then move to previous
          if (e.key === 'Backspace') {
            e.preventDefault();
            if (sectionValues[activeSectionIdx]) {
              // Section has a value → clear it (show label placeholder)
              sectionValues[activeSectionIdx] = '';
            } else if (activeSectionIdx > 0) {
              // Section already empty → move to previous and clear it
              activeSectionIdx -= 1;
              sectionValues[activeSectionIdx] = '';
            }
            syncInputDisplay();
            return;
          }

          // Delete: clear active section
          if (e.key === 'Delete') {
            e.preventDefault();
            sectionValues[activeSectionIdx] = '';
            syncInputDisplay();
            return;
          }

          // ArrowLeft/Right: navigate between sections
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (activeSectionIdx > 0) activeSectionIdx -= 1;
            const range = getSectionRange(activeSectionIdx);
            input.setSelectionRange(range.start, range.end);
            return;
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (activeSectionIdx < sectionLengths.length - 1) activeSectionIdx += 1;
            const range = getSectionRange(activeSectionIdx);
            input.setSelectionRange(range.start, range.end);
            return;
          }

          // ArrowUp/Down: increment/decrement section value
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const secLen = sectionLengths[activeSectionIdx]!;
            const label = sectionLabels[activeSectionIdx] ?? '';
            const sv = sectionValidation(label, secLen);
            const cur = parseInt(sectionValues[activeSectionIdx] || '0', 10);
            const delta = e.key === 'ArrowUp' ? 1 : -1;
            let next = cur + delta;
            if (sv) {
              if (next > sv.max) next = sv.min;
              if (next < sv.min) next = sv.max;
            } else {
              const ceiling = Math.pow(10, secLen) - 1;
              if (next > ceiling) next = 0;
              if (next < 0) next = ceiling;
            }
            sectionValues[activeSectionIdx] = String(next).padStart(secLen, '0');
            syncInputDisplay();
            return;
          }

          e.preventDefault();
        });

        syncDisplayLayer();
        floatBox.appendChild(displayLayer);
        floatBox.appendChild(input);

        document.body.appendChild(floatBox);
        activeFloatBox = floatBox;

        const gridEl = cellEl.closest('.bg-grid') as HTMLElement | null;
        const editRow = cellEl.dataset.row;
        const editCol = cellEl.dataset.col;

        function getAnchorRect(): DOMRect | null {
          const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
          if (!currentCell) return null;
          const anchor = currentCell.querySelector('.bg-input-box') as HTMLElement ?? currentCell;
          return anchor.getBoundingClientRect();
        }

        function syncMaskedPosition(): void {
          const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
          const gr = gridEl?.getBoundingClientRect();
          if (!currentCell || !gr) { floatBox.style.visibility = 'hidden'; return; }
          const anchor = currentCell.querySelector('.bg-input-box') as HTMLElement ?? currentCell;
          const cr = anchor.getBoundingClientRect();
          const headerH = parseFloat(gridEl?.querySelector('.bg-grid__headers')?.getBoundingClientRect().height + '' || '0');
          const cellVisible = cr.bottom > (gr.top + headerH) && cr.top < gr.bottom && cr.right > gr.left && cr.left < gr.right;
          floatBox.style.visibility = cellVisible ? 'visible' : 'hidden';
          if (cellVisible) {
            floatBox.style.top = `${cr.top}px`;
            floatBox.style.left = `${cr.left}px`;
            floatBox.style.width = `${cr.width}px`;
          }
        }
        const unbindPositionSync = bindFloatingPositionSync(cellEl, syncMaskedPosition);
        syncMaskedPosition();

        requestAnimationFrame(() => {
          input.focus();
          // Determine which section to select first. An empty cell (all
          // sections blank, showing the placeholder e.g. "MM/YY") always
          // starts at section 0 so typing flows naturally left-to-right — a
          // user clicking anywhere on an empty mask expects "start from the
          // beginning", not mid-field. Filled cells honour the clicked X so
          // clicking "25" in "08/25" jumps straight to YY editing.
          const hasAnyValue = sectionValues.some((s) => s && s.length > 0);
          const initialSection = !hasAnyValue
            ? 0
            : clickEvent
              ? getSectionAtClientX(clickEvent.clientX)
              : getSectionAtCursor(input.selectionStart ?? 0);
          activeSectionIdx = initialSection;
          const range = getSectionRange(initialSection);
          input.setSelectionRange(range.start, range.end);
        });

        let maskedActive = true;
        function cleanupMasked(): void {
          if (!maskedActive) return;
          maskedActive = false;
          document.removeEventListener('mousedown', onMaskedOutsideClick, true);
          unbindPositionSync();
          activeOutsideClickCleanup = null;
        }
        function onMaskedOutsideClick(e: MouseEvent): void {
          if (!maskedActive) return;
          if (handlePointerHandoff(cleanupMasked, e, floatBox)) return;

          if (floatBox.contains(e.target as Node)) {
            const anchorRect = getAnchorRect();
            const insideAnchor = !!anchorRect &&
              e.clientX >= anchorRect.left &&
              e.clientX <= anchorRect.right &&
              e.clientY >= anchorRect.top &&
              e.clientY <= anchorRect.bottom;

            if (insideAnchor) return;
          }
          cleanupMasked();
          if (editingCell) commitEdit();
        }
        setTimeout(() => document.addEventListener('mousedown', onMaskedOutsideClick, true), 0);
        activeOutsideClickCleanup = cleanupMasked;

        // Return a shim whose .value returns the commit value (digits only, joined)
        const shim = document.createElement('input');
        Object.defineProperty(shim, 'value', {
          get: () => getCommitValue(),
        });
        return shim;
      }

      // -----------------------------------------------------------------------
      // Date input editor
      // -----------------------------------------------------------------------

      function createDateInput(
        cellEl: HTMLElement,
        value: string,
      ): HTMLInputElement {
        const inputBox = cellEl.querySelector('.bg-input-box') as HTMLElement | null;
        const anchorEl = inputBox ?? cellEl;
        const cellRect = anchorEl.getBoundingClientRect();
        const cellFont = getComputedStyle(anchorEl).font;
        const cellPadding = getComputedStyle(anchorEl).padding;

        // Create floating container (same pattern as text editor)
        const floatBox = document.createElement('div');
        floatBox.className = 'bg-cell-editor-float';
        const borderW = 2;
        floatBox.style.cssText = `
          position: fixed; z-index: 200; box-sizing: border-box;
          top: ${cellRect.top}px; left: ${cellRect.left}px;
          min-width: ${cellRect.width}px;
          background: #fff; border: ${borderW}px solid var(--bg-active-border, #1a73e8);
          border-radius: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        `;

        // Native date input
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'bg-cell-editor bg-cell-editor--date';
        input.style.cssText = `
          width: 100%; border: none; outline: none;
          font: ${cellFont}; padding: ${cellPadding};
          min-height: ${cellRect.height - borderW * 2}px;
          box-sizing: border-box; background: transparent;
          color: inherit;
        `;

        // Convert the value to YYYY-MM-DD format for the input
        if (value) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            input.value = d.toISOString().split('T')[0] ?? '';
          } else {
            input.value = value; // Try as-is (might already be YYYY-MM-DD)
          }
        }

        floatBox.appendChild(input);
        document.body.appendChild(floatBox);
        activeFloatBox = floatBox;

        const gridEl = cellEl.closest('.bg-grid') as HTMLElement | null;
        const editRow = cellEl.dataset.row;
        const editCol = cellEl.dataset.col;

        function getAnchorRect(): DOMRect | null {
          const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
          if (!currentCell) return null;
          const anchor = currentCell.querySelector('.bg-input-box') as HTMLElement ?? currentCell;
          return anchor.getBoundingClientRect();
        }

        function syncDatePosition(): void {
          const currentCell = gridEl?.querySelector(`.bg-cell[data-row="${editRow}"][data-col="${editCol}"]`) as HTMLElement | null;
          const gr = gridEl?.getBoundingClientRect();
          if (!currentCell || !gr) {
            floatBox.style.visibility = 'hidden';
            return;
          }

          const anchor = currentCell.querySelector('.bg-input-box') as HTMLElement ?? currentCell;
          const cr = anchor.getBoundingClientRect();
          const headerH = parseFloat(gridEl?.querySelector('.bg-grid__headers')?.getBoundingClientRect().height + '' || '0');
          const cellVisible = cr.bottom > (gr.top + headerH) && cr.top < gr.bottom && cr.right > gr.left && cr.left < gr.right;
          floatBox.style.visibility = cellVisible ? 'visible' : 'hidden';
          if (cellVisible) {
            floatBox.style.top = `${cr.top}px`;
            floatBox.style.left = `${cr.left}px`;
            floatBox.style.width = `${cr.width}px`;
          }
        }

        const unbindPositionSync = bindFloatingPositionSync(cellEl, syncDatePosition);
        syncDatePosition();
        input.focus();

        // Keyboard handling
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleEditorKeydown(e);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            handleEditorKeydown(e);
          } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            handleEditorKeydown(e);
          }
        });

        // Click outside to commit
        function onOutsideClick(ev: MouseEvent): void {
          if (handlePointerHandoff(cleanup, ev, floatBox)) return;

          if (floatBox.contains(ev.target as Node)) {
            const anchorRect = getAnchorRect();
            const insideAnchor = !!anchorRect &&
              ev.clientX >= anchorRect.left &&
              ev.clientX <= anchorRect.right &&
              ev.clientY >= anchorRect.top &&
              ev.clientY <= anchorRect.bottom;

            if (insideAnchor) return;
          }
          cleanup();
          if (editingCell) commitEdit();
        }
        setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);

        let active = true;
        function cleanup(): void {
          if (!active) return;
          active = false;
          unbindPositionSync();
          floatBox.remove();
          activeFloatBox = null;
          document.removeEventListener('mousedown', onOutsideClick, true);
          activeOutsideClickCleanup = null;
        }

        activeOutsideClickCleanup = cleanup;

        // Return a shim that acts like the text editor
        const editorShim = {
          get value() { return input.value; }, // Returns YYYY-MM-DD
          set value(v: string) { input.value = v; },
          focus() { input.focus(); },
          removeEventListener: input.removeEventListener.bind(input),
          addEventListener: input.addEventListener.bind(input),
          setSelectionRange() {},
          dispatchEvent: input.dispatchEvent.bind(input),
        } as unknown as HTMLInputElement;

        return editorShim;
      }

      // -----------------------------------------------------------------------
      // Dropdown editor
      // -----------------------------------------------------------------------

      function createDropdown(
        cellEl: HTMLElement,
        opts: DropdownOption[],
        currentValue: unknown,
        column?: ColumnDef,
      ): HTMLInputElement {
        activeDropdownOptions = opts;

        // Hidden input for focus and keyboard handling
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bg-cell-editor bg-cell-editor--dropdown-trigger';
        input.readOnly = true;

        const currentOpt = opts.find((o) => o.value === currentValue || String(o.value) === String(currentValue));
        input.value = currentOpt?.label ?? String(currentValue ?? '');

        // Badge columns: show badge pill in cell during edit mode
        const isBadge = column?.cellType === 'badge';
        const badgeOptions = isBadge ? column?.options as Array<{ label: string; value: unknown; color?: string; bg?: string }> | undefined : undefined;
        const badgeMatch = badgeOptions?.find(b => b.value === currentValue || String(b.value) === String(currentValue));

        if (badgeMatch) {
          // Render badge + chevron as the trigger instead of plain input
          input.style.cssText = 'position:absolute;opacity:0;width:0;height:0;pointer-events:none;';
          const badgeEl = document.createElement('span');
          badgeEl.className = 'bg-cell-editor--badge-trigger';
          badgeEl.style.cssText = `
            display:inline-flex;align-items:center;gap:6px;cursor:pointer;width:100%;height:100%;line-height:normal;
          `;
          const pill = document.createElement('span');
          pill.textContent = badgeMatch.label ?? String(currentValue);
          pill.style.cssText = `display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;color:${badgeMatch.color ?? '#666'};background:${badgeMatch.bg ?? '#f5f5f5'};`;
          const chevron = document.createElement('span');
          chevron.innerHTML = `<svg width="8" height="5" style="opacity:0.5"><path d="M0 0l4 5 4-5z" fill="currentColor"/></svg>`;
          chevron.style.cssText = 'margin-left:auto;display:inline-flex;align-items:center;';
          badgeEl.appendChild(pill);
          badgeEl.appendChild(chevron);
          badgeEl.addEventListener('mousedown', () => input.focus());
          cellEl.appendChild(badgeEl);
          cellEl.appendChild(input);
        } else {
          input.style.cssText = INPUT_CSS + `
            cursor: pointer;
            background: transparent;
            background-image: ${CHEVRON_SVG};
            background-repeat: no-repeat;
            background-position: right 6px center;
            padding-right: 20px;
            padding-left: ${(getComputedStyle(cellEl).paddingLeft) || '12px'};
            text-align: ${getComputedStyle(cellEl).textAlign};
          `;
          cellEl.appendChild(input);
        }

        input.focus();

        // Create the floating dropdown panel
        const rect = cellEl.getBoundingClientRect();
        const cellFont = getComputedStyle(cellEl).font;
        const panel = document.createElement('div');
        panel.className = 'bg-dropdown-panel';
        panel.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.bottom}px;
          min-width: ${rect.width}px;
          z-index: 100;
          background: var(--bg-dropdown-bg, #fff);
          border: 1px solid var(--bg-dropdown-border, #d0d0d0);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 4px 0;
          max-height: 200px;
          overflow-y: auto;
          font: ${cellFont}; line-height: normal;
        `;

        let selectedIndex = opts.findIndex((o) => o.value === currentValue || String(o.value) === String(currentValue));

        for (let i = 0; i < opts.length; i++) {
          const opt = opts[i]!;
          const item = document.createElement('div');
          item.className = 'bg-dropdown-item' + (i === selectedIndex ? ' bg-dropdown-item--selected' : '');
          item.style.cssText = `
            padding: 6px 12px;
            cursor: pointer;
            user-select: none;
            font: inherit;
            ${i === selectedIndex ? 'background: var(--bg-dropdown-selected-bg, #e8f0fe); font-weight: 500;' : ''}
          `;

          // Render badge pill inside dropdown item if column is badge type
          const badgeMatch = badgeOptions?.find(b => b.value === opt.value || String(b.value) === String(opt.value));
          if (badgeMatch) {
            const badge = document.createElement('span');
            badge.textContent = opt.label;
            badge.style.cssText = `display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;color:${badgeMatch.color ?? '#666'};background:${badgeMatch.bg ?? '#f5f5f5'};`;
            item.appendChild(badge);
          } else {
            item.textContent = opt.label;
          }
          item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--bg-dropdown-hover-bg, #f0f0f0)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = i === selectedIndex ? 'var(--bg-dropdown-selected-bg, #e8f0fe)' : '';
          });
          item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur from firing
            selectedIndex = i;
            input.value = opt.label;
            commitDropdown(i);
          });
          panel.appendChild(item);
        }

        document.body.appendChild(panel);
        activeDropdownPanel = panel;

        // Keyboard navigation in dropdown
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, opts.length - 1);
            highlightDropdownItem(panel, selectedIndex);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            highlightDropdownItem(panel, selectedIndex);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commitDropdown(selectedIndex);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelEdit();
          } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            commitDropdown(selectedIndex);
          }
        });

        input.addEventListener('blur', () => {
          setTimeout(() => {
            if (editingCell && activeDropdownPanel) {
              commitDropdown(selectedIndex);
            }
          }, 100);
        });

        return input;
      }

      function commitDropdown(selectedIndex: number): void {
        if (!activeDropdownOptions || !editingCell) return;
        const opt = activeDropdownOptions[selectedIndex];
        if (!opt) { cancelEdit(); return; }

        const position = editingCell;
        const prevValue = originalValue;
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];

        if (column?.field && opt.value !== prevValue) {
          ctx.grid.updateCell(position.rowIndex, column.id, opt.value);
        }

        cleanupEdit();
      }

      function highlightDropdownItem(panel: HTMLElement, index: number): void {
        const items = panel.querySelectorAll('.bg-dropdown-item');
        items.forEach((item, i) => {
          const el = item as HTMLElement;
          if (i === index) {
            el.classList.add('bg-dropdown-item--selected');
            el.style.background = 'var(--bg-dropdown-selected-bg, #e8f0fe)';
            el.style.fontWeight = '500';
            el.scrollIntoView({ block: 'nearest' });
          } else {
            el.classList.remove('bg-dropdown-item--selected');
            el.style.background = '';
            el.style.fontWeight = '';
          }
        });
      }

      // -----------------------------------------------------------------------
      // Autocomplete editor
      // -----------------------------------------------------------------------

      function createAutocomplete(
        cellEl: HTMLElement,
        opts: DropdownOption[],
        currentValue: unknown,
        column: ColumnDef,
      ): HTMLInputElement {
        activeDropdownOptions = opts;

        const allowCreate = !!(column.meta as Record<string, unknown> | undefined)?.allowCreate;
        const onCreateOption = (column.meta as Record<string, unknown> | undefined)?.onCreateOption as
          | ((value: string) => void)
          | undefined;

        // Cell metrics
        const rect = cellEl.getBoundingClientRect();
        const cellFont = getComputedStyle(cellEl).font;

        // Create panel
        const panel = document.createElement('div');
        panel.className = 'bg-dropdown-panel';
        panel.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          min-width: ${rect.width}px;
          z-index: 200;
          background: var(--bg-dropdown-bg, #fff);
          border: 1px solid var(--bg-dropdown-border, #d0d0d0);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          font: ${cellFont}; line-height: normal;
        `;

        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        // Start empty so all options are visible; current value is highlighted in the list
        searchInput.value = '';
        searchInput.style.cssText = `
          border: none;
          border-bottom: 1px solid #e0e0e0;
          padding: 8px 12px;
          width: 100%;
          outline: none;
          font: inherit;
          box-sizing: border-box;
        `;
        panel.appendChild(searchInput);

        // Options list container
        const listEl = document.createElement('div');
        listEl.style.cssText = `
          max-height: 200px;
          overflow-y: auto;
          padding: 4px 0;
        `;
        panel.appendChild(listEl);

        let highlightedIndex = -1;
        let filteredOpts: DropdownOption[] = [];
        let showCreateItem = false;
        let selectedValue: unknown = currentValue;

        function renderOptions(): void {
          const query = searchInput.value.toLowerCase().trim();
          filteredOpts = query
            ? opts.filter((o) => o.label.toLowerCase().includes(query))
            : [...opts];

          // Determine if "create new" should show
          const exactMatch = opts.some((o) => o.label.toLowerCase() === query);
          showCreateItem = allowCreate && query.length > 0 && !exactMatch;

          listEl.innerHTML = '';
          highlightedIndex = -1;

          for (let i = 0; i < filteredOpts.length; i++) {
            const opt = filteredOpts[i]!;
            const isSelected = opt.value === currentValue || String(opt.value) === String(currentValue);
            const item = document.createElement('div');
            item.className = 'bg-dropdown-item' + (isSelected ? ' bg-dropdown-item--selected' : '');
            item.textContent = opt.label;
            item.style.cssText = `
              padding: 6px 12px;
              cursor: pointer;
              user-select: none;
              font: inherit;
              ${isSelected ? 'background: var(--bg-dropdown-selected-bg, #e8f0fe); font-weight: 500;' : ''}
            `;
            item.addEventListener('mouseenter', () => {
              highlightedIndex = i;
              highlightAutocompleteItem(listEl, highlightedIndex);
            });
            item.addEventListener('mousedown', (e) => {
              e.preventDefault();
              selectOption(opt.value);
            });
            listEl.appendChild(item);
          }

          // "Create new" item
          if (showCreateItem) {
            const createItem = document.createElement('div');
            createItem.className = 'bg-dropdown-item bg-dropdown-item--create';
            createItem.textContent = `+ Create "${searchInput.value}"`;
            createItem.style.cssText = `
              padding: 6px 12px;
              cursor: pointer;
              user-select: none;
              font: inherit;
              color: var(--bg-active-border, #1a73e8);
              border-top: 1px solid #e0e0e0;
            `;
            createItem.addEventListener('mouseenter', () => {
              highlightedIndex = filteredOpts.length;
              highlightAutocompleteItem(listEl, highlightedIndex);
            });
            createItem.addEventListener('mousedown', (e) => {
              e.preventDefault();
              createNewOption();
            });
            listEl.appendChild(createItem);
          }
        }

        function totalCount(): number {
          return filteredOpts.length + (showCreateItem ? 1 : 0);
        }

        function selectOption(value: unknown): void {
          selectedValue = value;
          commitAutocomplete(value);
        }

        function createNewOption(): void {
          const text = searchInput.value;
          selectedValue = text;
          if (typeof onCreateOption === 'function') {
            onCreateOption(text);
          }
          commitAutocomplete(text);
        }

        function commitAutocomplete(value: unknown): void {
          if (!editingCell) return;
          const position = editingCell;
          const prevValue = originalValue;
          const state = ctx.grid.getState();
          const col = state.columns[position.colIndex];

          if (col?.field && value !== prevValue) {
            ctx.grid.updateCell(position.rowIndex, col.id, value);
          }

          cleanup();
          cleanupEdit();
        }

        function highlightAutocompleteItem(
          container: HTMLElement,
          index: number,
        ): void {
          const items = container.querySelectorAll('.bg-dropdown-item');
          items.forEach((item, i) => {
            const el = item as HTMLElement;
            if (i === index) {
              el.style.background = 'var(--bg-dropdown-hover-bg, #f0f0f0)';
              el.style.fontWeight = '500';
              el.scrollIntoView({ block: 'nearest' });
            } else {
              const isSelected =
                i < filteredOpts.length &&
                (filteredOpts[i]!.value === currentValue ||
                  String(filteredOpts[i]!.value) === String(currentValue));
              el.style.background = isSelected ? 'var(--bg-dropdown-selected-bg, #e8f0fe)' : '';
              el.style.fontWeight = isSelected ? '500' : '';
            }
          });
        }

        // Keyboard handling
        searchInput.addEventListener('keydown', (e) => {
          const total = totalCount();

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, total - 1);
            highlightAutocompleteItem(listEl, highlightedIndex);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
            highlightAutocompleteItem(listEl, highlightedIndex);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (highlightedIndex >= 0 && highlightedIndex < filteredOpts.length) {
              selectOption(filteredOpts[highlightedIndex]!.value);
            } else if (highlightedIndex === filteredOpts.length && showCreateItem) {
              createNewOption();
            } else if (filteredOpts.length > 0) {
              selectOption(filteredOpts[0]!.value);
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cleanup();
            cancelEdit();
          } else if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            if (highlightedIndex >= 0 && highlightedIndex < filteredOpts.length) {
              selectOption(filteredOpts[highlightedIndex]!.value);
            } else if (highlightedIndex === filteredOpts.length && showCreateItem) {
              createNewOption();
            } else if (filteredOpts.length > 0) {
              selectOption(filteredOpts[0]!.value);
            } else {
              cleanup();
              cancelEdit();
            }
            // Move to next cell after commit
            const pos = editingCell;
            if (pos) {
              const state = ctx.grid.getState();
              const nextCol = e.shiftKey
                ? Math.max(pos.colIndex - 1, 0)
                : Math.min(pos.colIndex + 1, state.columns.length - 1);
              setTimeout(() => {
                ctx.grid.setSelection({
                  active: { rowIndex: pos.rowIndex, colIndex: nextCol },
                  ranges: [{ startRow: pos.rowIndex, endRow: pos.rowIndex, startCol: nextCol, endCol: nextCol }],
                });
              }, 0);
            }
          }
        });

        // Filter on input
        searchInput.addEventListener('input', () => {
          renderOptions();
        });

        document.body.appendChild(panel);
        activeDropdownPanel = panel;

        // Initial render
        renderOptions();

        // Focus the search input
        searchInput.focus();
        searchInput.select();

        // Click outside to dismiss
        let active = true;
        function onOutsideClick(ev: MouseEvent): void {
          if (!active) return;
          if (panel.contains(ev.target as Node)) return;
          cleanup();
          if (editingCell) commitEdit();
        }
        setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);

        function cleanup(): void {
          if (!active) return;
          active = false;
          document.removeEventListener('mousedown', onOutsideClick, true);
        }

        // Return editor shim so commitEdit can read the value
        const editorShim = {
          get value() {
            return selectedValue != null ? String(selectedValue) : searchInput.value;
          },
          set value(v: string) { searchInput.value = v; },
          focus() { searchInput.focus(); },
          removeEventListener: searchInput.removeEventListener.bind(searchInput),
          addEventListener: searchInput.addEventListener.bind(searchInput),
          setSelectionRange() {},
          dispatchEvent: searchInput.dispatchEvent.bind(searchInput),
        } as unknown as HTMLInputElement;

        activeEditor = editorShim;
        return editorShim;
      }

      // -----------------------------------------------------------------------
      // Precision helper
      // -----------------------------------------------------------------------

      function getPrecision(column: ColumnDef, row?: unknown): number | undefined {
        if (typeof column.precision === 'function') return column.precision(row as never);
        if (typeof column.precision === 'number') return column.precision;
        return config.precision;
      }

      function getMin(column: ColumnDef, row?: unknown): number | undefined {
        if (typeof column.min === 'function') return column.min(row as never);
        return column.min;
      }

      function getMax(column: ColumnDef, row?: unknown): number | undefined {
        if (typeof column.max === 'function') return column.max(row as never);
        return column.max;
      }

      // -----------------------------------------------------------------------
      // Commit / Cancel
      // -----------------------------------------------------------------------

      function commitEdit(): boolean {
        if (!editingCell || !activeEditor) return false;

        // If dropdown is active, delegate to commitDropdown
        if (activeDropdownPanel) {
          const selectedItem = activeDropdownPanel.querySelector('.bg-dropdown-item--selected');
          const items = activeDropdownPanel.querySelectorAll('.bg-dropdown-item');
          let idx = 0;
          items.forEach((item, i) => { if (item === selectedItem) idx = i; });
          commitDropdown(idx);
          return true;
        }

        const position = editingCell;
        const prevValue = originalValue;
        const state = ctx.grid.getState();
        const column = state.columns[position.colIndex];
        const rowData = state.data[position.rowIndex];

        // Text input: parse based on cell type
        const newValue = activeEditor.value;
        const parsedValue = parseTextValue(newValue, column, prevValue, rowData);

        // Update grid data BEFORE cleanup
        if (column?.field && parsedValue !== prevValue) {
          ctx.grid.updateCell(position.rowIndex, column.id, parsedValue);
        }

        cleanupEdit();
        return true;
      }

      function parseTextValue(
        newValue: string,
        column: ColumnDef | undefined,
        prevValue: unknown,
        row?: unknown,
      ): unknown {
        if (!column) return newValue;

        // Custom valueParser takes priority over all built-in parsing
        if (column.valueParser) {
          try {
            const parsed = column.valueParser(newValue, row as never);
            return parsed !== undefined ? parsed : prevValue;
          } catch {
            return prevValue;
          }
        }

        const cellType = column.cellType;

        // BigInt: parse to BigInt, reject decimals
        if (cellType === 'bigint') {
          const cleaned = newValue.replace(/[^0-9\-]/g, '');
          if (cleaned === '' || cleaned === '-') return prevValue;
          try {
            return BigInt(cleaned);
          } catch {
            return prevValue;
          }
        }

        if (cellType === 'number' || cellType === 'currency') {
          const cleaned = newValue.replace(/[^0-9.\-]/g, '');
          if (cleaned === '' || cleaned === '-') return prevValue;
          const num = Number(cleaned);
          if (isNaN(num)) return prevValue;
          // Apply precision rounding if configured
          const prec = getPrecision(column, row);
          if (prec != null) {
            return Number(num.toFixed(prec));
          }
          return num;
        }
        if (cellType === 'percent') {
          const cleaned = newValue.replace(/[^0-9.\-]/g, '');
          if (cleaned === '' || cleaned === '-') return prevValue;
          const num = Number(cleaned);
          if (isNaN(num)) return prevValue;
          // Avoid floating point errors: 0.08 / 100 = 0.0008 not 0.0007999...
          const decimals = (newValue.split('.')[1] || '').length + 2;
          return Number((num / 100).toFixed(decimals));
        }
        if (cellType === 'date') {
          if (newValue.trim() === '') return prevValue;
          const d = new Date(newValue);
          return isNaN(d.getTime()) ? prevValue : newValue;
        }
        if (typeof prevValue === 'boolean') {
          const lower = newValue.toLowerCase().trim();
          if (['yes', 'y', 'true', '1'].includes(lower)) return true;
          if (['no', 'n', 'false', '0'].includes(lower)) return false;
          return prevValue;
        }
        if (typeof prevValue === 'number') {
          // Strip thousand separators ("27,000,000" → "27000000") so Number()
          // parses correctly; the inline editor maintains comma grouping
          // while editing.
          const num = Number(newValue.replace(/,/g, ''));
          return isNaN(num) ? prevValue : num;
        }
        return newValue;
      }

      function cancelEdit(): void {
        cleanupEdit();
      }

      function cleanupEdit(): void {
        // Clean up any active outside-click listener (masked input, etc.)
        if (activeOutsideClickCleanup) {
          activeOutsideClickCleanup();
          activeOutsideClickCleanup = null;
        }

        // Remove inline editor if present
        if (editingCell) {
          const position = editingCell;
          const cellEl = getCellElement(editingCell);
          if (cellEl) {
            const inlineEditor = cellEl.querySelector('.bg-cell-editor--inline');
            const valueAnchor = inlineEditor?.closest('.bg-input-box__value') as HTMLElement | null;
            if (inlineEditor) inlineEditor.remove();
            if (valueAnchor) {
              const state = ctx.grid.getState();
              const column = state.columns[position.colIndex];
              const hs = state.hierarchyState;
              const dataIndex = hs ? (hs.visibleRows[position.rowIndex] ?? position.rowIndex) : position.rowIndex;
              const rowData = state.data[dataIndex];
              if (column && rowData) {
                const value = column.valueGetter
                  ? column.valueGetter(rowData, dataIndex)
                  : column.field
                    ? (rowData as Record<string, unknown>)[column.field]
                    : originalValue;
                valueAnchor.textContent = stripInputAdornments(
                  getInputStyleDisplayText(column, rowData, value, position.rowIndex, position.colIndex),
                  resolveColumnPrefix(column, rowData),
                  resolveColumnSuffix(column, rowData),
                );
              } else {
                valueAnchor.textContent = originalValue != null ? String(originalValue) : '';
              }
            }
          }
        }

        // Remove dropdown panel if present
        if (activeDropdownPanel) {
          activeDropdownPanel.remove();
          activeDropdownPanel = null;
          activeDropdownOptions = null;
        }

        // Remove floating edit box if present
        if (activeFloatBox) {
          activeFloatBox.remove();
          activeFloatBox = null;
        }

        if (activeEditor) {
          activeEditor.removeEventListener('keydown', handleEditorKeydown);
          activeEditor.removeEventListener('blur', handleEditorBlur);
        }

        if (editingCell) {
          const cellEl = getCellElement(editingCell);
          if (cellEl) {
            cellEl.classList.remove('bg-cell--editing');
            cellEl.style.overflow = '';
            cellEl.style.zIndex = '';
          }
        }

        activeEditor = null;
        editingCell = null;
        originalValue = null;

        // Defer refresh so any in-progress pointer events can still find
        // their target cells (synchronous refresh destroys DOM during mousedown).
        // Guard: if a new edit has started by the time rAF fires, skip the
        // refresh — otherwise it would destroy the freshly-opened editor.
        requestAnimationFrame(() => {
          if (editingCell) return; // new edit already started, don't nuke it
          ctx.grid.refresh();
          // Show fill handle again
          const gc = getGridContainer();
          const fh = gc.querySelector('.bg-fill-handle') as HTMLElement | null;
          if (fh) fh.style.display = 'block';
          // Refocus the grid container so keyboard navigation resumes
          gc.focus();
        });
      }

      // -----------------------------------------------------------------------
      // Event handlers
      // -----------------------------------------------------------------------

      function handleEditorKeydown(e: KeyboardEvent): void {
        e.stopPropagation();

        if (e.key === 'Enter' && config.commitOn.includes('enter')) {
          e.preventDefault();
          const pos = editingCell;
          commitEdit();
          if (pos) {
            const state = ctx.grid.getState();
            const nextRow = Math.min(pos.rowIndex + 1, state.data.length - 1);
            ctx.grid.setSelection({
              active: { rowIndex: nextRow, colIndex: pos.colIndex },
              ranges: [{ startRow: nextRow, endRow: nextRow, startCol: pos.colIndex, endCol: pos.colIndex }],
            });
          }
        } else if (e.key === 'Tab' && config.commitOn.includes('tab')) {
          e.preventDefault();
          const pos = editingCell;
          commitEdit();
          if (pos) {
            const state = ctx.grid.getState();
            const nextCol = e.shiftKey
              ? Math.max(pos.colIndex - 1, 0)
              : Math.min(pos.colIndex + 1, state.columns.length - 1);
            ctx.grid.setSelection({
              active: { rowIndex: pos.rowIndex, colIndex: nextCol },
              ranges: [{ startRow: pos.rowIndex, endRow: pos.rowIndex, startCol: nextCol, endCol: nextCol }],
            });
          }
        } else if (e.key === 'Escape' && config.cancelOnEscape) {
          e.preventDefault();
          cancelEdit();
        }
      }

      function handleEditorBlur(): void {
        setTimeout(() => {
          if (editingCell) commitEdit();
        }, 100);
      }

      // -----------------------------------------------------------------------
      // API & bindings
      // -----------------------------------------------------------------------

      const api: EditingApi = {
        startEdit,
        commitEdit,
        cancelEdit,
        isEditing: () => editingCell !== null,
        getEditingCell: () => editingCell,
      };

      // Register triggers
      let clickEditFrame: number | null = null;

      if (config.editTrigger === 'dblclick') {
        ctx.on('cell:dblclick', (cell) => startEdit(cell));
      } else if (config.editTrigger === 'click') {
        ctx.on('cell:click', (cell, event) => {
          if (pendingClickEditHandoff && isSameCell(pendingClickEditHandoff, cell)) {
            pendingClickEditHandoff = null;
            return;
          }
          if (clickEditFrame !== null) cancelAnimationFrame(clickEditFrame);
          clickEditFrame = requestAnimationFrame(() => {
            clickEditFrame = null;
            // If already editing this exact cell, leave the editor alone —
            // re-running startEdit would commit + re-open and wipe any
            // selection set by a sibling cell:dblclick handler. The user
            // clicked inside the input; the input's native click handling
            // will move the caret on its own.
            if (editingCell && isSameCell(editingCell, cell)) return;
            startEdit(cell, undefined, event);
          });
        });
        // Double-click anywhere in the cell → select the editor's full
        // value (spreadsheet convention: click places the cursor, double-
        // click selects the whole number ready to be overwritten). Works
        // whether the cell is already being edited or not — the first
        // click opens the editor, then the second click (which makes it a
        // dblclick) selects all.
        ctx.on('cell:dblclick', (cell) => {
          // Cancel any pending cell:click rAF for the same cell so it
          // doesn't fire startEdit *after* the dblclick and undo our select.
          if (clickEditFrame !== null) {
            cancelAnimationFrame(clickEditFrame);
            clickEditFrame = null;
          }
          if (editingCell && isSameCell(editingCell, cell)) {
            const ae = activeEditor;
            if (ae && typeof (ae as HTMLInputElement).select === 'function') {
              (ae as HTMLInputElement).select();
            }
          } else {
            // Cell wasn't open — open it with full selection
            startEdit(cell);
            // startEdit places cursor via the click logic; override to
            // select-all after the editor settles.
            requestAnimationFrame(() => {
              const ae = activeEditor;
              if (ae && typeof (ae as HTMLInputElement).select === 'function') {
                (ae as HTMLInputElement).select();
              }
            });
          }
        });
      }

      const unbindEnter = ctx.registerKeyBinding({
        key: 'Enter',
        priority: 10,
        handler: (event, cell) => {
          if (event.key !== 'Enter') return false; // defense-in-depth
          if (editingCell) return false; // let the editor's own keydown handle it
          if (cell) { startEdit(cell); return true; }
          return false;
        },
      });

      const unbindEscape = config.cancelOnEscape
        ? ctx.registerKeyBinding({
            key: 'Escape',
            priority: 10,
            handler: () => {
              if (editingCell) { cancelEdit(); return true; }
              return false;
            },
          })
        : undefined;

      // Type-to-edit: any printable character starts editing with that keystroke.
      // Always active regardless of editTrigger (standard spreadsheet behavior).
      const unbindType = ctx.registerKeyBinding({
        key: '*',
        priority: -1,
        handler: (event, cell) => {
          if (editingCell || !cell) return false;
          if (event.key.length !== 1) return false;
          if (event.ctrlKey || event.altKey || event.metaKey) return false;
          // Don't intercept typing in inputs, textareas, or contenteditable elements
          const tag = (event.target as HTMLElement)?.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
          if ((event.target as HTMLElement)?.isContentEditable) return false;
          const kbState = ctx.grid.getState();
          const column = kbState.columns[cell.colIndex];
          if (!column) return false;
          if (column.editable === false) return false;
          if (typeof column.editable === 'function') {
            const kbHs = kbState.hierarchyState;
            const di = kbHs ? (kbHs.visibleRows[cell.rowIndex] ?? cell.rowIndex) : cell.rowIndex;
            const rd = kbState.data[di];
            if (!rd || !column.editable(rd, column)) return false;
          }
          startEdit(cell, event.key);
          return true;
        },
      });

      ctx.expose(api);

      return () => {
        if (clickEditFrame !== null) cancelAnimationFrame(clickEditFrame);
        if (pendingClickEditHandoffFrame !== null) cancelAnimationFrame(pendingClickEditHandoffFrame);
        unbindEnter();
        unbindEscape?.();
        unbindType();
        closeDisplaySelectPanel();
        if (editingCell) cancelEdit();
      };
    },
  };
}
