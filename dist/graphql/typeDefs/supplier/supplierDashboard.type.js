import { objectType } from 'nexus';
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
    },
});
