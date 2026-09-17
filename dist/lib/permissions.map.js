// lib/permissions.map.ts
import { hasPrivilegedPageAccess, requireAuth, requireControlPermission, requirePagePermission } from "../middleware/auth.middleware.js";
export const SUPPLIER_PAGE_KEYS = {
    dashboard: 'supplierDashboardPage',
    rfq: 'supplierRFQPage',
    purchaseOrders: 'supplierPurchaseOrderPage',
    deliveries: 'supplierDeliveriesPage',
    orderTimeline: 'supplierOrderTimelinePage',
    products: 'supplierProductsPage',
    categories: 'supplierCategoriesPage',
    pricing: 'supplierPricingPage',
    inventory: 'supplierInventoryPage',
    wallet: 'supplierWalletPage',
    transactions: 'supplierTransactionsPage',
    withdrawals: 'supplierWithdrawalsPage',
    payoutMethods: 'supplierPayoutMethodsPage',
    feeHistory: 'supplierFeeHistoryPage',
    employees: 'supplierEmployeesPage',
    branches: 'supplierBranchesPage',
    links: 'supplierLinksPage',
    notifications: 'supplierNotificationsPage',
    analytics: 'supplierAnalyticsPage',
    security: 'supplierSecurityPage',
    settings: 'supplierSettingsPage',
};
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
    notifications: {
        view: (ctx) => requirePagePermission(ctx, 'notificationsPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'notificationsPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'notificationsPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'notificationsPage', 'canDelete'),
    },
    feeConfig: {
        view: (ctx) => requirePagePermission(ctx, 'feeConfigPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'feeConfigPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'feeConfigPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'feeConfigPage', 'canDelete'),
    },
    // SUPPLIER
    verification: {
        view: (ctx) => requirePagePermission(ctx, 'verificationPage', 'canView'),
        create: (ctx) => requirePagePermission(ctx, 'verificationPage', 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, 'verificationPage', 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, 'verificationPage', 'canDelete')
    },
    supplierDashboard: pagePermission(SUPPLIER_PAGE_KEYS.dashboard),
    supplierRfq: pagePermission(SUPPLIER_PAGE_KEYS.rfq),
    supplierPurchaseOrders: pagePermission(SUPPLIER_PAGE_KEYS.purchaseOrders),
    supplierDeliveries: pagePermission(SUPPLIER_PAGE_KEYS.deliveries),
    supplierOrderTimeline: pagePermission(SUPPLIER_PAGE_KEYS.orderTimeline),
    supplierProducts: pagePermission(SUPPLIER_PAGE_KEYS.products),
    supplierCategories: pagePermission(SUPPLIER_PAGE_KEYS.categories),
    supplierPricing: pagePermission(SUPPLIER_PAGE_KEYS.pricing),
    supplierInventory: pagePermission(SUPPLIER_PAGE_KEYS.inventory),
    supplierWallet: pagePermission(SUPPLIER_PAGE_KEYS.wallet),
    supplierTransactions: pagePermission(SUPPLIER_PAGE_KEYS.transactions),
    supplierWithdrawals: pagePermission(SUPPLIER_PAGE_KEYS.withdrawals),
    supplierPayoutMethods: pagePermission(SUPPLIER_PAGE_KEYS.payoutMethods),
    supplierFeeHistory: pagePermission(SUPPLIER_PAGE_KEYS.feeHistory),
    supplierEmployees: pagePermission(SUPPLIER_PAGE_KEYS.employees),
    supplierBranches: pagePermission(SUPPLIER_PAGE_KEYS.branches),
    supplierLinks: pagePermission(SUPPLIER_PAGE_KEYS.links),
    supplierNotifications: pagePermission(SUPPLIER_PAGE_KEYS.notifications),
    supplierAnalytics: pagePermission(SUPPLIER_PAGE_KEYS.analytics),
    supplierSecurity: pagePermission(SUPPLIER_PAGE_KEYS.security),
    supplierSettings: pagePermission(SUPPLIER_PAGE_KEYS.settings),
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
    if (hasPrivilegedPageAccess(ctx))
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
        throw new Error('You do not have permission to perform this action.');
    }
}
function pagePermission(pageKey) {
    return {
        view: (ctx) => requirePagePermission(ctx, pageKey, 'canView'),
        create: (ctx) => requirePagePermission(ctx, pageKey, 'canCreate'),
        edit: (ctx) => requirePagePermission(ctx, pageKey, 'canEdit'),
        delete: (ctx) => requirePagePermission(ctx, pageKey, 'canDelete'),
    };
}
