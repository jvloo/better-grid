import type { Transform, JSCodeshift } from 'jscodeshift';

const TYPE_RENAMES: Record<string, string> = {
  number: 'number',
  date: 'date',
  singleSelect: 'select',
  boolean: 'boolean',
};

function addFlag(j: JSCodeshift, node: { comments?: unknown[] }, reason: string): void {
  const comment = j.commentLine(` @better-grid/migrate: review — ${reason}`, true, false);
  node.comments = [...(node.comments ?? []), comment as unknown as object];
}

function unwrapParamsObject(
  j: JSCodeshift,
  root: ReturnType<JSCodeshift>,
  propName: string,
  fieldName: string,
): void {
  root.find(j.Property, { key: { name: propName } }).forEach((p) => {
    const arrow = p.node.value as { type: string; params?: Array<{ type: string; properties?: Array<{ type: string; key?: { name?: string } }> }> };
    if (arrow.type !== 'ArrowFunctionExpression' && arrow.type !== 'FunctionExpression') return;
    const params = arrow.params;
    if (!params || params.length !== 1 || params[0].type !== 'ObjectPattern') return;
    const objPattern = params[0];
    const fieldProp = objPattern.properties?.find(
      (q) => (q.type === 'Property' || q.type === 'ObjectProperty') && q.key?.name === fieldName,
    );
    if (!fieldProp) return;
    arrow.params = [j.identifier(fieldName) as never];
  });
}

const transform: Transform = (file, api) => {
  const j = api.jscodeshift;
  const root = j(file.source);

  // 1) `type: 'number'|'date'|'singleSelect'|'boolean'` → `cellType: 'X'`
  root.find(j.Property, { key: { name: 'type' } }).forEach((p) => {
    const v = p.node.value as { type: string; value?: unknown };
    if (v.type === 'Literal' && typeof v.value === 'string' && TYPE_RENAMES[v.value as string]) {
      (p.node.key as { name: string }).name = 'cellType';
      v.value = TYPE_RENAMES[v.value as string];
    }
  });

  // 2) Unwrap MUI's params object pattern in valueGetter / valueFormatter / valueParser
  unwrapParamsObject(j, root, 'valueGetter', 'row');
  unwrapParamsObject(j, root, 'valueFormatter', 'value');
  unwrapParamsObject(j, root, 'valueParser', 'value');

  // 3) `pinnedRows` → `pinned` (JSX attr + object literal)
  root.find(j.JSXAttribute, { name: { name: 'pinnedRows' } }).forEach((p) => {
    (p.node.name as { name: string }).name = 'pinned';
  });
  root.find(j.Property, { key: { name: 'pinnedRows' } }).forEach((p) => {
    (p.node.key as { name: string }).name = 'pinned';
  });

  // 4) Flag renderCell / renderEditCell / renderHeader
  for (const fnName of ['renderCell', 'renderEditCell', 'renderHeader']) {
    root.find(j.Property, { key: { name: fnName } }).forEach((p) => {
      addFlag(j, p.node, `${fnName} JSX → DOM port required`);
    });
  }

  // 5) `cellClassName: 'red'` (string) → `cellClass: () => 'red'`
  root.find(j.Property, { key: { name: 'cellClassName' } }).forEach((p) => {
    const v = p.node.value as { type: string; value?: unknown };
    if (v.type === 'Literal' && typeof v.value === 'string') {
      const className = v.value as string;
      (p.node.key as { name: string }).name = 'cellClass';
      p.node.value = j.arrowFunctionExpression([], j.literal(className));
    }
  });

  return root.toSource({ quote: 'single' });
};

export default transform;
