import { enumType, objectType, inputObjectType } from 'nexus';
export const AuditActionEnum = enumType({
    name: 'AuditAction',
    members: ['CREATE', 'EDIT', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE', 'STATUS_CHANGE']
});
export const PageType = objectType({
    name: 'Page',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('key');
        t.nonNull.string('label');
        t.nullable.string('parentKey');
        t.nonNull.int('sortOrder');
    }
});
export const PositionPermissionType = objectType({
    name: 'PositionPermission',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('positionId');
        t.nonNull.string('pageId');
        t.nonNull.boolean('canView');
        t.nonNull.boolean('canCreate');
        t.nonNull.boolean('canEdit');
        t.nonNull.boolean('canDelete');
        t.field('position', {
            type: 'Position',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.position.findUnique({
                    where: { id: parent.positionId }
                });
            }
        });
        t.field('page', {
            type: 'Page',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.page.findUnique({
                    where: { id: parent.pageId }
                });
            }
        });
    }
});
export const UserPermissionOverrideType = objectType({
    name: 'UserPermissionOverride',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('userId');
        t.nonNull.string('pageId');
        t.nullable.boolean('canView');
        t.nullable.boolean('canCreate');
        t.nullable.boolean('canEdit');
        t.nullable.boolean('canDelete');
        t.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user.findUnique({
                    where: { id: parent.userId }
                });
            }
        });
        t.field('page', {
            type: 'Page',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.page.findUnique({
                    where: { id: parent.pageId }
                });
            }
        });
    }
});
export const PositionControlPermissionType = objectType({
    name: 'PositionControlPermission',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('positionId');
        t.nonNull.string('controlKey');
        t.nonNull.boolean('isAllowed');
        t.field('position', {
            type: 'Position',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.position.findUnique({
                    where: { id: parent.positionId }
                });
            }
        });
    }
});
export const AuditLogType = objectType({
    name: 'AuditLogType',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('orgId');
        t.nonNull.int('userId');
        t.nonNull.string('pageKey');
        t.nonNull.field('action', { type: 'AuditAction' });
        t.nullable.string('recordId');
        t.nullable.string('recordType');
        t.nullable.json('oldValue');
        t.nullable.json('newValue');
        t.nullable.string('ipAddress');
        t.nullable.string('userAgent');
        t.nonNull.dateTime('createdAt');
        t.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user.findUnique({
                    where: { id: parent.userId }
                });
            }
        });
    }
});
export const DiscountAuditType = objectType({
    name: 'DiscountAuditType',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('orgId');
        t.nonNull.int('userId');
        t.nullable.string('customerId');
        t.nullable.string('oscaGovId');
        t.nullable.int('itemId');
        t.nullable.int('transactionId');
        t.nullable.string('salesOrderId');
        t.nullable.int('kompraOrderId');
        t.nullable.string('customItemName');
        t.nonNull.field('discountType', { type: 'DiscountType' });
        t.nonNull.float('discountAmount');
        t.nullable.float('eligibleAmount');
        t.nullable.float('runningWeeklyBnpcTotal');
        t.nonNull.boolean('isVoided');
        t.nullable.dateTime('voidedAt');
        t.nullable.string('voidReason');
        t.nonNull.dateTime('createdAt');
        t.nonNull.string('transactionType', {
            resolve: (parent) => {
                if (parent.transactionId)
                    return 'Transaction';
                if (parent.salesOrderId)
                    return 'SalesOrder';
                if (parent.kompraOrderId)
                    return 'KompraOrder';
                return 'Unknown';
            }
        });
        t.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.user.findUnique({
                    where: { id: parent.userId }
                });
            }
        });
        t.field('item', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                if (!parent.itemId)
                    return null;
                return ctx.prisma.item.findUnique({
                    where: { id: parent.itemId }
                });
            }
        });
    }
});
export const DiscountStatusType = objectType({
    name: 'DiscountStatus',
    definition(t) {
        t.nullable.string('customerId');
        t.nullable.string('oscaGovId');
        t.nonNull.float('weeklyCapUsed');
        t.nonNull.float('eligibleAmountUsed');
        t.nonNull.float('capRemaining');
        t.nonNull.float('purchaseRemaining');
        t.nonNull.boolean('bnpcDiscountApplied');
        t.nonNull.boolean('capManuallyReached');
        t.nonNull.dateTime('lastResetDate');
    }
});
export const DiscountAuditFiltersInput = inputObjectType({
    name: 'DiscountAuditFiltersInput',
    definition(t) {
        t.nullable.string('customerId');
        t.nullable.string('oscaGovId');
        t.nullable.int('itemId');
        t.nullable.field('discountType', { type: 'DiscountType' });
        t.nullable.string('transactionType');
        t.nullable.boolean('isVoided');
        t.nullable.dateTime('dateFrom');
        t.nullable.dateTime('dateTo');
    }
});
export const PermissionInput = inputObjectType({
    name: 'PermissionInput',
    definition(t) {
        t.nonNull.string('pageId');
        t.nonNull.boolean('canView');
        t.nonNull.boolean('canCreate');
        t.nonNull.boolean('canEdit');
        t.nonNull.boolean('canDelete');
    }
});
export const PositionInput = inputObjectType({
    name: 'PositionInput',
    definition(t) {
        t.nonNull.string('name');
        t.nullable.string('description');
    }
});
export const AuditLogFiltersInput = inputObjectType({
    name: 'AuditLogFiltersInput',
    definition(t) {
        t.nullable.int('userId');
        t.nullable.field('action', { type: 'AuditAction' });
        t.nullable.string('pageKey');
        t.nullable.dateTime('dateFrom');
        t.nullable.dateTime('dateTo');
    }
});
export const PaginationInput = inputObjectType({
    name: 'PaginationInput',
    definition(t) {
        t.nullable.int('page');
        t.nullable.int('pageSize');
    }
});
