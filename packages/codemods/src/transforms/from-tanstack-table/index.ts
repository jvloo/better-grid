import type { Transform, JSCodeshift } from 'jscodeshift';

const KEY_RENAMES: Record<string, string> = {
  accessorKey: 'field',
  accessorFn: 'valueGetter',
  enableSorting: 'sortable',
  size: 'width',
  minSize: 'minWidth',
  maxSize: 'maxWidth',
};

function addFlag(j: JSCodeshift, node: { comments?: unknown[] }, reason: string): void {
  const comment = j.commentLine(` @better-grid/migrate: review — ${reason}`, true, false);
  node.comments = [...(node.comments ?? []), comment as unknown as object];
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  root.find(j.Property).forEach((p) => {
    if (p.node.key.type !== 'Identifier') return;
    const name = (p.node.key as { name: string }).name;

    if (name === 'header') {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'string') {
        // String header → headerName
        (p.node.key as { name: string }).name = 'headerName';
      } else {
        // Function/JSX header → flag + rename key (renderer reshape needed)
        (p.node.key as { name: string }).name = 'headerRenderer';
        addFlag(j, p.node, 'header function/JSX → headerRenderer (container, ctx) => void');
      }
      return;
    }

    if (name === 'cell') {
      // Always flag — TanStack cell takes (info) → JSX; Better Grid cellRenderer takes (container, ctx)
      addFlag(j, p.node, 'cell → cellRenderer (container, ctx) => void');
      (p.node.key as { name: string }).name = 'cellRenderer';
      return;
    }

    if (KEY_RENAMES[name]) {
      (p.node.key as { name: string }).name = KEY_RENAMES[name];
    }
  });

  return root.toSource({ quote: 'single' });
};

export default transform;
