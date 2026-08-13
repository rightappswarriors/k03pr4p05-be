// lib/permissions.map.ts
import { requireAuth, requireControlPermission, requirePagePermission } from "../middleware/auth.middleware.js";
export const PAGE_PERMISSIONS = {
    //Retailer
    //Dashboard
    dashboard: {
        view: (ctx) => requirePagePermission(ctx, 'dashboardPage', 'canView')
    },
    // Sales Order
    salesOrder: {
        view: (ctx) => requirePagePermission(ctx, 'salesOrderPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'salesOrderPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'salesOrderPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'salesOrderPage', 'canDelete'),
    },
    // Kompra Order
    kompraOrder: {
        view: (ctx) => requirePagePermission(ctx, 'kompraOrderPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'kompraOrderPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'kompraOrderPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'kompraOrderPage', 'canDelete'),
    },
    // Finance
    finance: {
        view: (ctx) => requirePagePermission(ctx, 'financePage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'financePage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'financePage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'financePage', 'canDelete'),
    },
    // Inventory
    inventory: {
        view: (ctx) => requirePagePermission(ctx, 'inventoryPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'inventoryPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'inventoryPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'inventoryPage', 'canDelete'),
    },
    // Restock Scheduling
    restockScheduling: {
        view: (ctx) => requirePagePermission(ctx, 'restockSchedulingPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'restockSchedulingPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'restockSchedulingPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'restockSchedulingPage', 'canDelete'),
    },
    // Discount
    discount: {
        view: (ctx) => requirePagePermission(ctx, 'discountPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'discountPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'discountPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'discountPage', 'canDelete'),
    },
    // Audit Log
    auditLog: {
        view: (ctx) => requirePagePermission(ctx, 'auditLogPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'auditLogPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'auditLogPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'auditLogPage', 'canDelete'),
    },
    // HR
    hr: {
        view: (ctx) => requirePagePermission(ctx, 'hrPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'hrPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'hrPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'hrPage', 'canDelete'),
    },
    // Sales Analytics
    salesAnalytics: {
        view: (ctx) => requirePagePermission(ctx, 'salesAnalyticsPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'salesAnalyticsPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'salesAnalyticsPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'salesAnalyticsPage', 'canDelete'),
    },
    // Master File
    masterFile: {
        view: (ctx) => requirePagePermission(ctx, 'masterFilePage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'masterFilePage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'masterFilePage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'masterFilePage', 'canDelete'),
    },
    // Branch & Outlet (parent page)
    branchAndOutlet: {
        view: (ctx) => requirePagePermission(ctx, 'branchAndOutletPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'branchAndOutletPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'branchAndOutletPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'branchAndOutletPage', 'canDelete'),
    },
    // Outlet (child of branchAndOutletPage)
    outlet: {
        view: (ctx) => requirePagePermission(ctx, 'outletPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'outletPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'outletPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'outletPage', 'canDelete'),
    },
    // Branch (child of branchAndOutletPage)
    branch: {
        view: (ctx) => requirePagePermission(ctx, 'branchPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'branchPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'branchPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'branchPage', 'canDelete'),
    },
    // Outlet Inventory (child of branchAndOutletPage)
    outletInventory: {
        view: (ctx) => requirePagePermission(ctx, 'outletInventoryPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'outletInventoryPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'outletInventoryPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'outletInventoryPage', 'canDelete'),
    },
    // POS Terminal (child of inventoryPage)
    posTerminal: {
        view: (ctx) => requirePagePermission(ctx, 'posTerminalPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'posTerminalPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'posTerminalPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'posTerminalPage', 'canDelete'),
    },
    admin: {
        view: (ctx) => requirePagePermission(ctx, 'adminPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'adminPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'adminPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'adminPage', 'canDelete'),
    },
    // SUPPLIER
    verification: {
        view: (ctx) => requirePagePermission(ctx, 'verificationPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'verificationPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'verificationPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'verificationPage', 'canDelete')
    }
};
// Control permissions map
export const CONTROL_PERMISSIONS = {
    approveDiscount: (ctx) => requireControlPermission(ctx, 'approveDiscount'),
    cancelOrder: (ctx) => requireControlPermission(ctx, 'cancelOrder'),
    voidTransaction: (ctx) => requireControlPermission(ctx, 'voidTransaction'),
    approveRestock: (ctx) => requireControlPermission(ctx, 'approveRestock'),
    manageUsers: (ctx) => requireControlPermission(ctx, 'manageUsers'),
    managePermissions: (ctx) => requireControlPermission(ctx, 'managePermissions'),
};
// lib/permissions.map.ts
export function requireAny(ctx, ...checks) {
    requireAuth(ctx);
    if (ctx.user?.role === "OWNER")
        return;
    const passed = checks.some(check => {
        try {
            check(ctx);
            return true;
        }
        catch {
            return false;
        }
    });
    if (!passed) {
        throw new Error('Access denied: insufficient permissions');
    }
}
