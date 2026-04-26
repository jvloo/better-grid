import type { Transform, JSCodeshift } from 'jscodeshift';

const KEY_RENAMES: Record<string, string> = {
  prop: 'field',
  name: 'headerName',
  size: 'width',
  minSize: 'minWidth',
  maxSize: 'maxWidth',
  source: 'data',
  pinnedTopSource: 'pinned.top',
  pinnedBottomSource: 'pinned.bottom',
  editor: 'cellEditor',
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

    // pinnedTopSource → flag (nested grouping)
    if (name === 'pinnedTopSource' || name === 'pinnedBottomSource') {
      addFlag(j, p.node, `'${name}' -> '${KEY_RENAMES[name]}' (nested rename — needs object grouping)`);
      return;
    }

    // readonly:true → editable:false
    if (name === 'readonly') {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'boolean') {
        (p.node.key as { name: string }).name = 'editable';
        v.value = !(v.value as boolean);
      }
      return;
    }

    // pin:'colPinStart' → flag (Better Grid uses frozen.left numerically)
    if (name === 'pin') {
      addFlag(j, p.node, `pin: '<position>' → frozen.left/right numeric (manual conversion)`);
      return;
    }

    // range:true → selection:{ mode: 'range' }
    if (name === 'range') {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'boolean' && v.value === true) {
        (p.node.key as { name: string }).name = 'selection';
        p.node.value = j.objectExpression([
          j.property('init', j.identifier('mode'), j.literal('range')),
        ]);
      }
      return;
    }

    // resize:true → flag (Better Grid uses features=['resize'])
    if (name === 'resize') {
      addFlag(j, p.node, `resize → features: ['resize'] (move to features array)`);
      return;
    }

    // cellTemplate → flag
    if (name === 'cellTemplate') {
      addFlag(j, p.node, 'cellTemplate (h, props) → cellRenderer (container, ctx) — RevoGrid uses h(); Better Grid uses DOM');
      return;
    }

    if (KEY_RENAMES[name]) {
      (p.node.key as { name: string }).name = KEY_RENAMES[name];
    }
  });

  return root.toSource({ quote: 'single' });
};

export default transform;
