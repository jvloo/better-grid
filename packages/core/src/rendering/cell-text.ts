export const CELL_TEXT_CLASS = 'bg-cell__text';

export function renderCellText(cell: HTMLElement, text: string): void {
  const span = document.createElement('span');
  span.className = CELL_TEXT_CLASS;
  span.textContent = text;
  cell.replaceChildren(span);
}

export function normalizeCellTextNodes(cell: HTMLElement): void {
  for (const child of Array.from(cell.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE) continue;
    if (!child.textContent) continue;

    const span = document.createElement('span');
    span.className = CELL_TEXT_CLASS;
    span.textContent = child.textContent;
    child.replaceWith(span);
  }
}
