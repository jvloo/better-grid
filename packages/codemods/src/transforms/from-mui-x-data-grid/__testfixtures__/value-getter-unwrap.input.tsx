const cols = [{
  field: 'sum',
  valueGetter: ({ row }) => row.x + row.y,
  valueFormatter: ({ value }) => `$${value}`,
}];
