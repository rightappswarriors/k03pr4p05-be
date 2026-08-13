/**import { Parser } from 'json2csv';
import { stringify } from 'csv-stringify/sync';

export interface InventoryExportRow {
  itemId: number;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  unitCost: number;
  sellingPrice: number;
  status: string;
  branch?: string;
  outlet?: string;
}

export interface InventoryImportRow {
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  unitCost: number;
  sellingPrice: number;
  status?: string;
}

export interface CsvImportResult {
  success: boolean;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export function generateInventoryCsvTemplate(): string {
  const headers = [
    'itemCode',
    'itemName',
    'category',
    'unit',
    'quantity',
    'reorderLevel',
    'reorderQuantity',
    'unitCost',
    'sellingPrice',
    'status',
  ];

  const sampleData = [
    {
      itemCode: 'SKU001',
      itemName: 'Product Name',
      category: 'Category Name',
      unit: 'PCS',
      quantity: 100,
      reorderLevel: 20,
      reorderQuantity: 50,
      unitCost: 50.0,
      sellingPrice: 100.0,
      status: 'ACTIVE',
    },
  ];

  return stringify([headers, ...sampleData.map((row) => Object.values(row))]);
}

export function generateInventoryExportCsv(data: InventoryExportRow[]): string {
  const csvOutput = stringify(
    data.map((item) => ({
      'Item Code': item.itemCode,
      'Item Name': item.itemName,
      Category: item.category,
      Unit: item.unit,
      Quantity: item.quantity,
      'Reorder Level': item.reorderLevel,
      'Reorder Quantity': item.reorderQuantity,
      'Unit Cost': item.unitCost,
      'Selling Price': item.sellingPrice,
      Status: item.status,
      Branch: item.branch || '',
      Outlet: item.outlet || '',
    })),
    {
      header: true,
    }
  );

  return csvOutput;
}

export function validateImportRow(
  row: Record<string, any>,
  rowIndex: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!row.itemCode || !row.itemCode.toString().trim()) {
    errors.push('Item Code is required');
  }

  if (!row.itemName || !row.itemName.toString().trim()) {
    errors.push('Item Name is required');
  }

  if (!row.category || !row.category.toString().trim()) {
    errors.push('Category is required');
  }

  if (!row.unit || !row.unit.toString().trim()) {
    errors.push('Unit is required');
  }

  const quantity = Number(row.quantity);
  if (isNaN(quantity) || quantity < 0) {
    errors.push('Quantity must be a non-negative number');
  }

  const unitCost = Number(row.unitCost);
  if (isNaN(unitCost) || unitCost < 0) {
    errors.push('Unit Cost must be a non-negative number');
  }

  const sellingPrice = Number(row.sellingPrice);
  if (isNaN(sellingPrice) || sellingPrice < 0) {
    errors.push('Selling Price must be a non-negative number');
  }

  const validStatus = ['ACTIVE', 'INACTIVE'];
  if (row.status && !validStatus.includes(row.status.toUpperCase())) {
    errors.push(`Status must be one of: ${validStatus.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}
**/