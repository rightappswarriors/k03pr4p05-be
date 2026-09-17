import { enumType, inputObjectType, objectType } from 'nexus';
export const SupplierLinkStatus = enumType({
    name: 'SupplierLinkStatus',
    members: ['SUGGESTED', 'REQUESTED', 'PENDING', 'ACCEPTED', 'ACTIVE', 'PAUSED', 'BLOCKED', 'ARCHIVED', 'APPROVED', 'REJECTED', 'DISABLED'],
});
export const SupplierLinkSortField = enumType({
    name: 'SupplierLinkSortField',
    members: ['REQUESTED_AT', 'STATUS', 'RETAILER_NAME', 'OUTLET_NAME'],
});
export const SupplierLinkSortDirection = enumType({
    name: 'SupplierLinkSortDirection',
    members: ['ASC', 'DESC'],
});
export const SupplierLinkRetailerOrganization = objectType({
    name: 'SupplierLinkRetailerOrganization',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('name');
        t.nullable.string('profileImage');
        t.nullable.string('location');
        t.nullable.string('contactNumber');
    },
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
        t.nonNull.dateTime('requestedAt');
        t.nullable.dateTime('approvedAt');
        t.nullable.dateTime('rejectedAt');
        t.nullable.dateTime('disabledAt');
        t.nullable.int('requestedById');
        t.nullable.int('reviewedById');
        t.nonNull.string('requestDirection');
        t.nonNull.string('supplierName');
        t.nullable.string('supplierProfileImage');
        t.nullable.string('supplierLocation');
        t.nonNull.string('outletName');
        t.nullable.string('outletAddress');
        t.nonNull.string('retailerOrganizationName');
        t.nullable.string('retailerProfileImage');
        t.nullable.string('retailerLocation');
        t.nullable.string('retailerContactNumber');
        t.nonNull.field('retailerOrganization', { type: 'SupplierLinkRetailerOrganization' });
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
export const SupplierLinkSummary = objectType({
    name: 'SupplierLinkSummary',
    definition(t) {
        t.nonNull.int('activeRetailers');
        t.nonNull.int('pendingRequests');
        t.nonNull.int('rejectedRequests');
        t.nonNull.int('disabledLinks');
    },
});
export const SupplierLinkPage = objectType({
    name: 'SupplierLinkPage',
    definition(t) {
        t.nonNull.list.nonNull.field('items', { type: 'SupplierLinkWorkspace' });
        t.nonNull.int('total');
        t.nonNull.int('page');
        t.nonNull.int('pageSize');
        t.nonNull.field('summary', { type: 'SupplierLinkSummary' });
    },
});
export const SupplierLinkOutletOption = objectType({
    name: 'SupplierLinkOutletOption',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('name');
        t.nullable.string('address');
    },
});
export const SupplierLinkDirectoryEntry = objectType({
    name: 'SupplierLinkDirectoryEntry',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('name');
        t.nullable.string('profileImage');
        t.nullable.string('location');
        t.nullable.string('contactNumber');
        t.nullable.string('relationshipId');
        t.nullable.field('relationshipStatus', { type: 'SupplierLinkStatus' });
    },
});
export const SupplierLinkDirectoryPage = objectType({
    name: 'SupplierLinkDirectoryPage',
    definition(t) {
        t.nonNull.list.nonNull.field('items', { type: 'SupplierLinkDirectoryEntry' });
        t.nonNull.list.nonNull.field('outlets', { type: 'SupplierLinkOutletOption' });
        t.nonNull.int('total');
        t.nonNull.int('page');
        t.nonNull.int('pageSize');
    },
});
export const SupplierBusinessProfileMetrics = objectType({
    name: 'SupplierBusinessProfileMetrics',
    definition(t) {
        t.nullable.float('overallRating');
        t.nonNull.int('reviewCount');
        t.nonNull.int('activeProducts');
        t.nonNull.int('successfulOrders');
        t.nonNull.int('eligibleTerminalOrders');
        t.nullable.float('orderCompletionRate');
        t.nonNull.int('completedDeliveries');
        t.nonNull.int('eligibleTerminalDeliveries');
        t.nullable.float('deliveryCompletionRate');
    },
});
export const SupplierBusinessProductPreview = objectType({
    name: 'SupplierBusinessProductPreview',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('name');
        t.nullable.string('image');
        t.nonNull.string('unit');
        t.nonNull.int('moq');
        t.nullable.string('category');
    },
});
export const RegisteredSupplierProfile = objectType({
    name: 'RegisteredSupplierProfile',
    definition(t) {
        t.nonNull.int('id');
        t.nonNull.string('name');
        t.nullable.string('profileImage');
        t.nullable.string('bannerImage');
        t.nullable.string('location');
        t.nullable.string('contactNumber');
        t.nullable.string('bio');
        t.nonNull.field('verificationStatus', { type: 'OrgVerificationStatus' });
        t.nonNull.dateTime('memberSince');
        t.nullable.string('relationshipId');
        t.nullable.field('relationshipStatus', { type: 'SupplierLinkStatus' });
        t.nullable.int('outletId');
        t.nullable.string('outletName');
        t.nonNull.list.nonNull.string('categories');
        t.nonNull.list.nonNull.field('productPreview', { type: 'SupplierBusinessProductPreview' });
        t.nonNull.field('metrics', { type: 'SupplierBusinessProfileMetrics' });
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
        t.nonNull.dateTime('requestedAt');
        t.nullable.dateTime('approvedAt');
        t.nullable.dateTime('rejectedAt');
        t.nullable.dateTime('disabledAt');
        t.nullable.int('requestedById');
        t.nullable.int('reviewedById');
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
