import { objectType } from 'nexus';
export const SupplierDashboardActivityPoint = objectType({
    name: 'SupplierDashboardActivityPoint',
    definition(t) {
        t.nonNull.string('period');
        t.nonNull.int('orderCount');
        t.nonNull.int('deliveryCount');
    },
});
export const SupplierDashboardPurchaseOrder = objectType({
    name: 'SupplierDashboardPurchaseOrder',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('poNumber');
        t.nonNull.string('buyerName');
        t.nonNull.float('totalAmount');
        t.nonNull.string('status');
        t.nullable.string('deliveryDate');
    },
});
export const SupplierDashboardDelivery = objectType({
    name: 'SupplierDashboardDelivery',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('poNumber');
        t.nonNull.string('buyerName');
        t.nonNull.string('status');
        t.nonNull.string('scheduledDate');
        t.nullable.string('driverName');
    },
});
export const SupplierDashboardNotification = objectType({
    name: 'SupplierDashboardNotification',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('title');
        t.nonNull.string('message');
        t.nonNull.string('createdAt');
        t.nonNull.boolean('isRead');
    },
});
export const SupplierDashboardStats = objectType({
    name: 'SupplierDashboardStats',
    definition(t) {
        // Retail supply-order pipeline (Organization ↔ Organization PurchaseOrder flow)
        t.nonNull.int('newPOs');
        t.nonNull.int('pendingDeliveries');
        t.nonNull.int('fulfilledToday');
        t.nonNull.float('duePayments');
        // Mandate marketplace (Agent ↔ Organization MandateOffer flow)
        t.nonNull.int('openMandatesCount'); // open mandates matching this supplier's catalog units
        t.nonNull.int('myPendingMandateOffers'); // offers I've submitted, awaiting the agent's decision
        t.nonNull.int('myAcceptedMandateOffers'); // offers the agent accepted (to be funded/settled)
        // Catalog + Wallet
        t.nonNull.int('catalogItemCount');
        t.nonNull.float('walletBalance');
        t.nonNull.float('walletHeldBalance'); // 0 until Phase 3 escrow ships; field exists now for forward compat
        // Dashboard read model. Financial revenue is settled supplier net, never wallet balance.
        t.nonNull.float('totalRevenue');
        t.nonNull.int('purchaseOrderCount');
        t.nonNull.int('purchaseOrdersInProgress');
        t.nonNull.int('deliveryCount');
        t.nonNull.int('deliveriesInProgress');
        t.nonNull.int('activeCatalogItemCount');
        t.nonNull.int('inactiveCatalogItemCount');
        t.nonNull.list.nonNull.field('orderActivity', { type: 'SupplierDashboardActivityPoint' });
        t.nonNull.list.nonNull.field('recentPurchaseOrders', { type: 'SupplierDashboardPurchaseOrder' });
        t.nonNull.list.nonNull.field('recentDeliveries', { type: 'SupplierDashboardDelivery' });
        t.nonNull.list.nonNull.field('notifications', { type: 'SupplierDashboardNotification' });
    },
});
