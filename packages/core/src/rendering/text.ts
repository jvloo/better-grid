export function renderCellText(cell: HTMLElement, value: unknown): void {
  const span = document.createElement('span');
  span.className = 'bg-cell__text';
  span.textContent = value != null ? String(value) : '';
  cell.replaceChildren(span);
}
