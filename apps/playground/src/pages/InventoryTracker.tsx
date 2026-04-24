import { useMemo, useState, useCallback } from 'react';
import { useGrid } from '@better-grid/react';
import type { ColumnDef } from '@better-grid/core';
import { formatting, editing, sorting, filtering, cellRenderers, validation, clipboard, undoRedo, exportPlugin } from '@better-grid/plugins';
import '@better-grid/core/styles.css';
import { IconButton, ExportIcon } from './_toolbar-icons';

interface StockRow {
  sku: string;
  name: string;
  category: string;
  supplier: string;
  warehouse: string;
  unit: string;
  unitCost: number;
  quantity: number;
  reorderLevel: number;
  leadDays: number;
  lastRestock: string;
  nextRestock: string;
  status: { text: string; tooltip: string; type: 'info' | 'warning' | 'error' };
  stockLevel: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const rng = seededRandom(321);
const categories = ['Electronics', 'Mechanical', 'Consumables', 'Packaging', 'Raw Materials', 'Safety'];
const suppliers = ['Acme Corp', 'GlobalTech', 'PrimeParts', 'FastSupply', 'QualityFirst'];
const warehouses = ['WH-A (Main)', 'WH-B (East)', 'WH-C (West)'];
const units = ['pcs', 'kg', 'boxes', 'rolls', 'pallets'];
const items = [
  'PCB Board Rev3', 'Capacitor 100uF', 'Resistor 10K Pack', 'LED Strip 5m', 'USB-C Connector',
  'Bearing 608ZZ', 'Steel Rod 12mm', 'Servo Motor MG996', 'Fan 80mm DC', 'Heat Shrink Kit',
  'Solder Wire 0.8mm', 'Flux Pen', 'Thermal Paste', 'Cable Ties 200mm', 'Zip Lock Bag M',
  'Bubble Wrap Roll', 'Cardboard Box A4', 'Foam Sheet 10mm', 'Copper Wire 1mm', 'Aluminum Sheet 2mm',
  'Safety Goggles', 'Gloves Nitrile L', 'ESD Wrist Strap', 'Fire Extinguisher', 'First Aid Kit',
];

const initialData: StockRow[] = items.map((name, i) => {
  const quantity = Math.round(rng() * 500);
  const reorderLevel = Math.round(rng() * 100 + 20);
  const ratio = quantity / Math.max(reorderLevel * 3, 1);
  const stockLevel = Math.min(1, Math.max(0, ratio));
  const isLow = quantity <= reorderLevel;
  const isOut = quantity === 0;
  const lastDate = new Date(2026, 0, 1 + Math.floor(rng() * 80));
  const leadDays = Math.round(rng() * 20 + 3);
  const nextDate = new Date(lastDate.getTime() + leadDays * 2 * 86400000);
  return {
    sku: `SKU-${String(i + 1).padStart(4, '0')}`,
    name,
    category: categories[Math.floor(rng() * categories.length)]!,
    supplier: suppliers[Math.floor(rng() * suppliers.length)]!,
    warehouse: warehouses[Math.floor(rng() * warehouses.length)]!,
    unit: units[Math.floor(rng() * units.length)]!,
    unitCost: Math.round((rng() * 150 + 0.5) * 100) / 100,
    quantity,
    reorderLevel,
    leadDays,
    lastRestock: lastDate.toISOString().slice(0, 10),
    nextRestock: nextDate.toISOString().slice(0, 10),
    status: isOut
      ? { text: 'Out of stock', tooltip: 'Urgent reorder required', type: 'error' as const }
      : isLow
        ? { text: 'Low stock', tooltip: `Only ${quantity} left (reorder at ${reorderLevel})`, type: 'warning' as const }
        : { text: 'In stock', tooltip: `${quantity} units available`, type: 'info' as const },
    stockLevel,
  };
});

export function InventoryTracker() {
  const [data, setData] = useState(initialData);

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      { id: 'sku', header: 'SKU', width: 90, sortable: true },
      { id: 'name', header: 'Item Name', width: 170, sortable: true, required: true },
      { id: 'category', header: 'Category', width: 110, sortable: true,
        cellType: 'badge',
        options: categories.map(c => ({ label: c, value: c, color: '#333', bg: '#f0f0f0' })),
      },
      { id: 'supplier', header: 'Supplier', width: 110, sortable: true,
        cellEditor: 'dropdown', options: suppliers,
      },
      { id: 'warehouse', header: 'Warehouse', width: 110, sortable: true,
        cellEditor: 'dropdown', options: warehouses,
      },
      { id: 'unit', header: 'Unit', width: 70, align: 'center' },
      { id: 'unitCost', header: 'Unit Cost', width: 90, cellType: 'currency', precision: 2, sortable: true },
      { id: 'quantity', header: 'Qty', width: 70, align: 'right', sortable: true,
        rules: [{ validate: (v) => (v as number) >= 0 || 'Cannot be negative' }],
        cellStyle: (value) => {
          const v = value as number;
          if (v === 0) return { color: '#c62828', fontWeight: '600' };
          if (v <= 30) return { color: '#e65100' };
          return undefined;
        },
      },
      { id: 'reorderLevel', header: 'Reorder At', width: 85, align: 'right', sortable: true },
      { id: 'stockLevel', header: 'Stock Level', width: 120, cellType: 'progress', sortable: true },
      { id: 'status', header: 'Status', width: 110, cellType: 'tooltip' },
      { id: 'leadDays', header: 'Lead (d)', width: 75, align: 'right', sortable: true },
      { id: 'lastRestock', header: 'Last Restock', width: 110, cellType: 'date', sortable: true },
      { id: 'nextRestock', header: 'Next Restock', width: 110, cellType: 'date', sortable: true },
    ],
    [],
  );

  const plugins = useMemo(
    () => [
      formatting({ locale: 'en-US', currencyCode: 'USD' }),
      editing({ editTrigger: 'dblclick' }),
      sorting(),
      filtering(),
      validation({ validateOn: 'commit' }),
      cellRenderers(),
      clipboard(),
      undoRedo({ maxHistory: 50 }),
      exportPlugin({ filename: 'inventory-report' }),
    ],
    [],
  );

  const { grid, containerRef } = useGrid<StockRow>({
    data,
    columns,
    plugins,
    frozenLeftColumns: 5,
    freezeClip: { minVisible: 2 },
    selection: { mode: 'range', fillHandle: true },
    onDataChange: (changes) => {
      setData(prev => {
        const next = [...prev];
        for (const c of changes) next[c.rowIndex] = c.row as StockRow;
        return next;
      });
    },
  });

  const handleExport = useCallback(() => grid.plugins.export?.exportToCsv(), [grid]);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Inventory Tracker</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton title="Export" onClick={handleExport}><ExportIcon /></IconButton>
        </div>
      </div>
      <p style={{ marginBottom: 8, color: '#666', lineHeight: 1.5 }}>
        Warehouse stock management with conditional styling, progress bars, and tooltips. Hover &ldquo;Status&rdquo; for details.
        Drag the freeze clip handle to adjust frozen columns.
      </p>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#999', lineHeight: 1.5 }}>
        <strong>Plugins:</strong> formatting, editing, sorting, filtering, validation, cellRenderers, clipboard, undoRedo, export &bull;
        <strong> Core:</strong> frozenLeftColumns, freezeClip, fillHandle, cellStyle (conditional)
      </div>

      <div
        ref={containerRef}
        style={{
          height: 560,
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
        }}
      />
    </div>
  );
}
