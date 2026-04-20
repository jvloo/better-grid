// Styled <select> helper shared across FSBT + DM demos so every dropdown
// (Escalation, Growth Rate, Frequency, …) is visually identical to the
// input-box cells around it. Pattern: `editable: false` on the column so
// the editing plugin's dropdown wrap is disabled, then a custom
// cellRenderer that builds one of these selects.

/**
 * Inline CSS that matches `.bg-input-box` sizing so a native <select>
 * visually sits in the same vertical slot as nearby input cells:
 * 30px tall, #F8F8F8 fill, 4px radius, subtle shadow, custom SVG chevron.
 * `appearance:none` strips the native OS arrow so the chevron we draw
 * via background-image takes over.
 */
export const DROPDOWN_BOX_STYLE =
  'height:30px;background:#F8F8F8;border:none;border-radius:4px;' +
  'box-shadow:0 1px 2px 0 rgba(16,24,40,0.05);font-size:12px;color:#101828;' +
  'box-sizing:border-box;padding:0 22px 0 8px;cursor:pointer;' +
  'appearance:none;-webkit-appearance:none;' +
  'background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'><path d=\'M1 1l4 4 4-4\' stroke=\'%23667085\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/></svg>");' +
  'background-repeat:no-repeat;background-position:right 8px center;' +
  'width:100%;';

export interface DropdownOption<V extends string = string> {
  value: V;
  label: string;
}

/**
 * Build a styled <select> element wired to an `onChange` callback. Use this
 * inside a column's `cellRenderer` to render an immediately-interactive
 * dropdown (one click opens options, no edit-mode step).
 *
 * Typical usage:
 * ```ts
 * cellRenderer: (container, ctx) => {
 *   container.innerHTML = '';
 *   if (ctx.row.parentId === null) return;
 *   const select = buildStyledSelect(OPTIONS, ctx.row.value, (next) => {
 *     const idx = rowsRef.current.findIndex(r => r.id === ctx.row.id);
 *     gridRef.current?.updateCell(idx, 'value', next);
 *   });
 *   container.appendChild(select);
 * }
 * ```
 */
export function buildStyledSelect<V extends string>(
  options: ReadonlyArray<DropdownOption<V>>,
  currentValue: V | string,
  onChange: (nextValue: V) => void,
): HTMLSelectElement {
  const select = document.createElement('select');
  select.style.cssText = DROPDOWN_BOX_STYLE;
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === currentValue) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => onChange(select.value as V));
  return select;
}

/**
 * Apply the flex layout a compound-cell container needs before appending
 * the styled <select>. Preserves the grid's absolute positioning.
 */
export function prepareDropdownContainer(container: HTMLElement): void {
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.padding = '0 8px';
}
