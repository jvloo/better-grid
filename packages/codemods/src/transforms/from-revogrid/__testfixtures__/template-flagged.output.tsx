const cols = [{ field: 'name', // @better-grid/migrate: review — cellTemplate (h, props) → cellRenderer (container, ctx) — RevoGrid uses h(); Better Grid uses DOM
cellTemplate: (h, props) => h('div', null, props.value) }];
