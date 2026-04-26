const cols = [{ field: 'name', // @better-grid/migrate: review — cell → cellRenderer (container, ctx) => void
cellRenderer: info => info.getValue() }];
