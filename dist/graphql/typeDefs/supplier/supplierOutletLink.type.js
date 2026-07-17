import { enumType, inputObjectType, objectType } from 'nexus';
export const SupplierLinkStatus = enumType({
    name: 'SupplierLinkStatus',
    members: ['SUGGESTED', 'REQUESTED', 'PENDING', 'ACCEPTED', 'ACTIVE', 'PAUSED', 'BLOCKED', 'ARCHIVED'],
});
export const SupplierLinkWorkspace = objectType({
    name: 'SupplierLinkWorkspace',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('supplierOrgId');
        t.nonNull.int('outletId');
        t.nonNull.field('status', { type: 'SupplierLinkStatus' });
        t.nonNull.boolean('isApproved');
        t.nullable.string('assignedAgentName');
        t.nullable.string('preferredWarehouseId');
        t.nullable.string('deliveryInstructions');
        t.nullable.string('receivingHours');
        t.nullable.string('creditTerms');
        t.nullable.string('notes');
        t.nullable.dateTime('linkedAt');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nonNull.string('organizationName');
        t.nullable.string('organizationLogo');
        t.nullable.float('rating');
        t.nonNull.float('revenue');
        t.nonNull.int('orders');
        t.nonNull.float('outstanding');
        t.nonNull.int('openMandates');
        t.nonNull.int('unreadMessages');
        t.nullable.dateTime('lastActivity');
    },
});
export const UpdateSupplierLinkInput = inputObjectType({
    name: 'UpdateSupplierLinkInput',
    definition(t) {
        t.nonNull.string('id');
        t.nullable.field('status', { type: 'SupplierLinkStatus' });
        t.nullable.string('assignedAgentId');
        t.nullable.string('preferredWarehouseId');
        t.nullable.string('deliveryInstructions');
        t.nullable.string('receivingHours');
        t.nullable.string('creditTerms');
        t.nullable.string('notes');
    },
});
export const SupplierOutletLink = objectType({
    name: 'SupplierOutletLink',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('supplierOrgId');
        t.nonNull.int('outletId');
        // Legacy field retained for backwards compatibility
        t.nonNull.boolean('isApproved');
        t.nonNull.field('status', {
            type: 'SupplierLinkStatus',
        });
        t.nullable.string('assignedAgentId');
        t.nullable.string('preferredWarehouseId');
        t.nullable.string('deliveryInstructions');
        t.nullable.string('receivingHours');
        t.nullable.string('creditTerms');
        t.nullable.string('notes');
        t.nullable.dateTime('linkedAt');
        t.nullable.dateTime('pausedAt');
        t.nullable.dateTime('archivedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nonNull.field('supplierOrg', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.supplierOutletLink
                .findUnique({ where: { id: parent.id } })
                .supplierOrg(),
        });
        t.nonNull.field('outlet', {
            type: 'Outlet',
            resolve: (parent, _, ctx) => ctx.prisma.supplierOutletLink
                .findUnique({ where: { id: parent.id } })
                .outlet(),
        });
        t.nullable.field('assignedAgent', {
            type: 'Agent',
            resolve: (parent, _, ctx) => {
                if (!parent.assignedAgentId)
                    return null;
                return ctx.prisma.supplierOutletLink
                    .findUnique({ where: { id: parent.id } })
                    .assignedAgent();
            },
        });
    },
});
