// rai-pos-backend/src/graphql/typeDefs/supplierOrder.type.ts
import { enumType, inputObjectType, objectType } from 'nexus';
export const SupplierOrderStatusEnum = enumType({
    name: 'SupplierOrderStatus',
    members: ['pending', 'acknowledged', 'sent', 'delivered', 'cancelled'],
});
export const SupplierOrderItemType = objectType({
    name: 'SupplierOrderItem',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('orderId');
        t.nonNull.int('itemId');
        t.nonNull.float('requestedQty');
        t.nullable.float('deliveredQty');
        t.nullable.float('confirmedQty');
        t.nullable.dateTime('expiryStartDate');
        t.nullable.dateTime('expiryEndDate');
        t.nullable.dateTime('exactExpiryDate');
        t.nonNull.field('item', {
            type: 'Item',
            resolve: (parent, _, ctx) => ctx.prisma.supplierOrderItem.findUnique({ where: { id: parent.id } }).item(),
        });
    },
});
export const SupplierOrderType = objectType({
    name: 'SupplierOrder',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.int('orgId');
        t.nullable.int('scheduleId');
        t.nonNull.string('supplierEmail');
        t.nonNull.field('status', { type: 'SupplierOrderStatus' });
        t.nullable.string('supplierMessage');
        t.nullable.string('userMessage');
        t.nonNull.dateTime('expectedArrival');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nonNull.list.nonNull.field('items', {
            type: 'SupplierOrderItem',
            resolve: (parent, _, ctx) => ctx.prisma.supplierOrder.findUnique({ where: { id: parent.id } }).items(),
        });
    },
});
// Input for supplier submitting their response
export const SupplierOrderItemInput = inputObjectType({
    name: 'SupplierOrderItemInput',
    definition(t) {
        t.nonNull.int('orderItemId');
        t.nonNull.float('deliveredQty');
        t.nullable.field('expiryStartDate', { type: 'DateTime' });
        t.nullable.field('expiryEndDate', { type: 'DateTime' });
        t.nullable.field('exactExpiryDate', { type: 'DateTime' });
    },
});
