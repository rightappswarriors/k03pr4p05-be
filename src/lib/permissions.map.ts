// lib/permissions.map.ts
import { requireAuth, requireControlPermission, requirePagePermission } from "../middleware/auth.middleware.js";
import { Context } from "./types.js";
export const PAGE_PERMISSIONS = {
  //Dashboard
  dashboard: {
    view: (ctx: Context) => requirePagePermission(ctx, 'dashboardPage', 'canView')
  },
  // Sales Order
  salesOrder: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'salesOrderPage',   'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'salesOrderPage',   'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'salesOrderPage',   'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'salesOrderPage',   'canDelete'),
  },
  // Kompra Order
  kompraOrder: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'kompraOrderPage',  'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'kompraOrderPage',  'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'kompraOrderPage',  'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'kompraOrderPage',  'canDelete'),
  },
  // Finance
  finance: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'financePage',      'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'financePage',      'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'financePage',      'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'financePage',      'canDelete'),
  },
  // Inventory
  inventory: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'inventoryPage',    'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'inventoryPage',    'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'inventoryPage',    'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'inventoryPage',    'canDelete'),
  },
  // Restock Scheduling
  restockScheduling: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'restockSchedulingPage', 'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'restockSchedulingPage', 'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'restockSchedulingPage', 'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'restockSchedulingPage', 'canDelete'),
  },
  // Discount
  discount: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'discountPage',     'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'discountPage',     'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'discountPage',     'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'discountPage',     'canDelete'),
  },
  // Audit Log
  auditLog: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'auditLogPage',     'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'auditLogPage',     'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'auditLogPage',     'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'auditLogPage',     'canDelete'),
  },
  // HR
  hr: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'hrPage',           'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'hrPage',           'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'hrPage',           'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'hrPage',           'canDelete'),
  },
  // Sales Analytics
  salesAnalytics: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'salesAnalyticsPage', 'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'salesAnalyticsPage', 'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'salesAnalyticsPage', 'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'salesAnalyticsPage', 'canDelete'),
  },
  // Master File
  masterFile: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'masterFilePage',   'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'masterFilePage',   'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'masterFilePage',   'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'masterFilePage',   'canDelete'),
  },
  // Branch & Outlet (parent page)
  branchAndOutlet: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'branchAndOutletPage', 'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'branchAndOutletPage', 'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'branchAndOutletPage', 'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'branchAndOutletPage', 'canDelete'),
  },
  // Outlet (child of branchAndOutletPage)
  outlet: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'outletPage',       'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'outletPage',       'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'outletPage',       'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'outletPage',       'canDelete'),
  },
  // Branch (child of branchAndOutletPage)
  branch: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'branchPage',       'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'branchPage',       'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'branchPage',       'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'branchPage',       'canDelete'),
  },
  // Outlet Inventory (child of branchAndOutletPage)
  outletInventory: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'outletInventoryPage', 'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'outletInventoryPage', 'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'outletInventoryPage', 'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'outletInventoryPage', 'canDelete'),
  },
  // POS Terminal (child of inventoryPage)
  posTerminal: {
    view:   (ctx: Context) => requirePagePermission(ctx, 'posTerminalPage',  'canView'),
    create: (ctx: Context) => requirePagePermission(ctx, 'posTerminalPage',  'canCreate'),
    edit:   (ctx: Context) => requirePagePermission(ctx, 'posTerminalPage',  'canEdit'),
    delete: (ctx: Context) => requirePagePermission(ctx, 'posTerminalPage',  'canDelete'),
  },
} as const;

// Control permissions map
export const CONTROL_PERMISSIONS = {
  approveDiscount:    (ctx: Context) => requireControlPermission(ctx, 'approveDiscount'),
  cancelOrder:        (ctx: Context) => requireControlPermission(ctx, 'cancelOrder'),
  voidTransaction:    (ctx: Context) => requireControlPermission(ctx, 'voidTransaction'),
  approveRestock:     (ctx: Context) => requireControlPermission(ctx, 'approveRestock'),
  manageUsers:        (ctx: Context) => requireControlPermission(ctx, 'manageUsers'),
  managePermissions:  (ctx: Context) => requireControlPermission(ctx, 'managePermissions'),
} as const;

// lib/permissions.map.ts
export function requireAny(
  ctx: Context,
  ...checks: ((ctx: Context) => void)[]
) {
  requireAuth(ctx);
  if (ctx.user?.role === "OWNER") return;

  const passed = checks.some(check => {
    try { check(ctx); return true; }
    catch { return false; }
  });

  if (!passed) {
    throw new Error('Access denied: insufficient permissions');
  }
}