import { objectType } from 'nexus';
export const SupplierDashboardStats = objectType({
    name: 'SupplierDashboardStats',
    definition(t) {
        t.nonNull.int('newPOs');
        t.nonNull.int('pendingDeliveries');
        t.nonNull.int('fulfilledToday');
        t.nonNull.float('duePayments');
    },
});
