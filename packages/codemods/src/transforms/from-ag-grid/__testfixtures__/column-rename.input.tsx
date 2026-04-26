const columns = [
  { field: 'name', headerName: 'Name' },
  {
    field: 'status',
    headerName: 'Status',
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: ['open', 'closed'] },
  },
];
