const cols = [
  { accessorKey: 'amount', header: 'Amount' },
  { accessorFn: row => row.x + row.y, header: 'Sum' },
];
