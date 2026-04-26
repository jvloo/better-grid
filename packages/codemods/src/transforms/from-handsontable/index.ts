import type { Transform, JSCodeshift } from 'jscodeshift';

const KEY_RENAMES: Record<string, string> = {
  data: 'field',         // column-level only — top-level `data` is unchanged
  title: 'headerName',
  editor: 'cellEditor',
  className: 'cellClass',
};

const TYPE_RENAMES: Record<string, string> = {
  numeric: 'number',
  date: 'date',
  checkbox: 'boolean',
  dropdown: 'select',
  autocomplete: 'autocomplete',
};

const EDITOR_RENAMES: Record<string, string> = {
  numeric: 'number',
  text: 'text',
  select: 'select',
  date: 'date',
  autocomplete: 'autocomplete',
};

function addFlag(j: JSCodeshift, node: { comments?: unknown[] }, reason: string): void {
  const comment = j.commentLine(` @better-grid/migrate: review — ${reason}`, true, false);
  node.comments = [...(node.comments ?? []), comment as unknown as object];
}

function isInColumnObject(p: { parentPath?: { parentPath?: { parentPath?: { node: { type: string; key?: { name?: string } } } } } }): boolean {
  // Best-effort: a `data:` property is a column-level field rename ONLY when
  // the containing object literal sits inside a `columns: [ ... ]` array.
  // Walk up: Property → ObjectExpression → ArrayExpression → Property(key:'columns')
  let cur = p.parentPath;
  for (let i = 0; i < 6 && cur; i++) {
    const node = cur.node as { type?: string; key?: { name?: string } };
    if (node?.type === 'Property' && node.key?.name === 'columns') return true;
    cur = (cur as { parentPath?: typeof cur }).parentPath;
  }
  return false;
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  root.find(j.Property).forEach((p) => {
    if (p.node.key.type !== 'Identifier') return;
    const name = (p.node.key as { name: string }).name;

    // `type: 'numeric'|'date'|'checkbox'|'dropdown'` (column-level) → cellType
    if (name === 'type') {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'string' && TYPE_RENAMES[v.value as string]) {
        (p.node.key as { name: string }).name = 'cellType';
        v.value = TYPE_RENAMES[v.value as string];
      }
      return;
    }

    // `editor: 'X'` → cellEditor: 'X' (with mapping)
    if (name === 'editor') {
      const v = p.node.value as { type: string; value?: unknown };
      (p.node.key as { name: string }).name = 'cellEditor';
      if (v.type === 'Literal' && typeof v.value === 'string' && EDITOR_RENAMES[v.value as string]) {
        v.value = EDITOR_RENAMES[v.value as string];
      }
      return;
    }

    // `validator: fn` → `rules: [{ validate: fn }]`
    if (name === 'validator') {
      (p.node.key as { name: string }).name = 'rules';
      const fn = p.node.value as never;
      p.node.value = j.arrayExpression([
        j.objectExpression([j.property('init', j.identifier('validate'), fn)]),
      ]);
      return;
    }

    // `readOnly: true` → `editable: false` (invert the boolean)
    if (name === 'readOnly') {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'boolean') {
        (p.node.key as { name: string }).name = 'editable';
        v.value = !(v.value as boolean);
      }
      return;
    }

    // `data: 'amount'` → `field: 'amount'` ONLY when inside columns array
    if (name === 'data' && isInColumnObject(p as never)) {
      (p.node.key as { name: string }).name = 'field';
      return;
    }

    // `className: 'red'` → `cellClass: () => 'red'`
    if (name === 'className') {
      const v = p.node.value as { type: string; value?: unknown };
      if (v.type === 'Literal' && typeof v.value === 'string') {
        const className = v.value as string;
        (p.node.key as { name: string }).name = 'cellClass';
        p.node.value = j.arrowFunctionExpression([], j.literal(className));
        return;
      }
    }

    // `fixedColumnsLeft: N` → flag (needs grouping into frozen.left)
    if (name === 'fixedColumnsLeft' || name === 'fixedRowsTop' || name === 'fixedRowsBottom') {
      const target = name === 'fixedColumnsLeft' ? 'frozen.left'
        : name === 'fixedRowsTop' ? 'frozen.top'
        : 'pinned.bottom';
      addFlag(j, p.node, `'${name}' -> '${target}' (nested rename — needs object grouping)`);
      return;
    }

    // `afterChange` → `onCellChange`
    if (name === 'afterChange') {
      (p.node.key as { name: string }).name = 'onCellChange';
      return;
    }

    // `renderer: function(...)` → flag
    if (name === 'renderer') {
      addFlag(j, p.node, 'renderer(instance, td, …) → cellRenderer (container, ctx) — Handsontable shape differs');
      (p.node.key as { name: string }).name = 'cellRenderer';
      return;
    }

    // Plain key renames: title → headerName
    if (name === 'title') {
      (p.node.key as { name: string }).name = KEY_RENAMES[name];
      return;
    }
  });

  return root.toSource({ quote: 'single' });
};

export default transform;
