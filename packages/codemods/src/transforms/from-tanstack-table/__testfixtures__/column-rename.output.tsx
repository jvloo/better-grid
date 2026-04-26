const cols = [
  { field: 'amount', headerName: 'Amount' },
  { valueGetter: row => row.x + row.y, headerName: 'Sum' },
];
