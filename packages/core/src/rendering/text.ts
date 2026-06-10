export function renderTextContent(cell: HTMLElement, text: string): void {
  const span = document.createElement('span');
  span.className = 'bg-cell__text';
  span.textContent = text;
  cell.replaceChildren(span);
}

export function normalizeDirectTextContent(cell: HTMLElement): void {
  if (cell.childElementCount > 0) return;

  const text = cell.textContent ?? '';
  if (text === '') return;

  renderTextContent(cell, text);
}
