// graphql/resolvers/notification/notification.type.ts
import { objectType, extendType, nonNull, intArg, arg, enumType } from "nexus";
import * as notificationService from "../../services/notification.service.js";
import { requireAuth, requireRole } from "../../middleware/auth.middleware.js";
import { PAGE_PERMISSIONS } from "../../lib/permissions.map.js";

function notificationAccountContext(ctx: any, requested?: notificationService.NotificationAccountContext | null): notificationService.NotificationAccountContext {
    if (requested) return requested;
    if (ctx.user?.role === 'ADMIN') return 'ADMIN';
    return ctx.user?.orgRoles?.includes('SUPPLIER') ? 'SUPPLIER' : 'RETAIL';
}

function requireNotificationScope(ctx: any, requested: notificationService.NotificationAccountContext | null | undefined, action: 'view' | 'edit'): notificationService.NotificationRecipientScope {
    requireAuth(ctx);
    const accountContext = notificationAccountContext(ctx, requested);
    if (accountContext === 'ADMIN') {
        requireRole(ctx, ['ADMIN']);
        return { recipientAudience: 'PLATFORM_ADMIN', orgId: null };
    }
    const orgId = Number(ctx.user?.orgId);
    if (!Number.isInteger(orgId) || orgId < 1) throw new Error('An authenticated organization is required.');
    if (accountContext === 'SUPPLIER') {
        if (!ctx.user?.orgRoles?.includes('SUPPLIER')) throw new Error('Resource not found.');
        PAGE_PERMISSIONS.supplierNotifications[action](ctx);
    } else {
        if (!ctx.user?.orgRoles?.includes('SELLER')) throw new Error('Resource not found.');
        PAGE_PERMISSIONS.notifications[action](ctx);
    }
    return { recipientAudience: 'ACCOUNT', orgId };
}

export const NotificationAccountContextEnum = enumType({ name: 'NotificationAccountContext', members: ['SUPPLIER', 'RETAIL', 'ADMIN'] });
export const NotificationFilterEnum = enumType({ name: 'NotificationFilter', members: ['ALL', 'UNREAD', 'ORDERS', 'PAYMENTS', 'DELIVERY', 'RFQ', 'MESSAGES', 'FINANCE', 'SUPPLIER_LINKS', 'SYSTEM'] });

export const NotificationType = objectType({
    name: "Notification",
    definition(t) {
        t.nonNull.int("id");
        t.nullable.int("orgId");
        t.nullable.int("outletId");
        t.nullable.int("itemId");
        t.nonNull.string("title");
        t.nonNull.string("message");
        t.nonNull.boolean("isRead");
        t.nonNull.string("createdAt", { resolve: (parent) => parent.createdAt instanceof Date ? parent.createdAt.toISOString() : String(parent.createdAt) });
        t.nonNull.field("type", {
            type: "NotificationType"
        });
        t.nonNull.string('category', { resolve: (parent) => notificationService.categorizeNotification(parent) });
        t.nullable.string('conversationId');
        t.nullable.string('referenceType');
        t.nullable.string('referenceId');
        t.nullable.field("outlet", {
            type: "Outlet",
            resolve: (parent, _, ctx) =>
                parent.outletId
                    ? ctx.prisma.outlet.findUnique({ where: { id: parent.outletId } })
                    : null,
        });
        t.nullable.field("item", {
            type: "Item",
            resolve: (parent, _, ctx) =>
                parent.itemId
                    ? ctx.prisma.item.findUnique({ where: { id: parent.itemId } })
                    : null,
        });
    },
});
export const NotificationPage = objectType({
    name: 'NotificationPage',
    definition(t) {
        t.nonNull.list.nonNull.field('items', { type: 'Notification' });
        t.nonNull.int('total');
        t.nonNull.int('unreadCount');
        t.nonNull.int('page');
        t.nonNull.int('pageSize');
        t.nonNull.boolean('hasNextPage');
    },
});
export const NotificationTypeEnum = enumType({
    name: "NotificationType",
    members: [
        "OUTLET_LOW_STOCK",
        "ORG_CRITICAL_STOCK",
        "NEW_TRANSACTION",
        "RFQ_RECEIVED",
        "COUNTER_OFFER",
        "NEGOTIATION_ACCEPTED",
        "NEGOTIATION_REJECTED",
        "PURCHASE_ORDER_CREATED"
    ]
})

export const NotificationQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.field('notificationPage', {
            type: 'NotificationPage',
            args: {
                accountContext: nonNull(arg({ type: 'NotificationAccountContext' })),
                filter: arg({ type: 'NotificationFilter' }),
                page: intArg(),
                pageSize: intArg(),
            },
            resolve(_, { accountContext, filter, page, pageSize }, ctx) {
                const scope = requireNotificationScope(ctx, accountContext as notificationService.NotificationAccountContext, 'view');
                return notificationService.getNotificationPage(scope, (filter ?? 'ALL') as notificationService.NotificationFilter, page ?? 1, pageSize ?? 20);
            },
        });

        t.nonNull.int('notificationUnreadCount', {
            args: { accountContext: nonNull(arg({ type: 'NotificationAccountContext' })) },
            resolve(_, { accountContext }, ctx) {
                return notificationService.getScopedUnreadCount(requireNotificationScope(ctx, accountContext as notificationService.NotificationAccountContext, 'view'));
            },
        });

        t.nonNull.list.nonNull.field("getNotifications", {
            type: "Notification",
            args: { limit: intArg() },
            async resolve(_, { limit }, ctx) {
                const scope = requireNotificationScope(ctx, null, 'view');
                return (await notificationService.getNotificationPage(scope, 'ALL', 1, limit ?? 20)).items;
            },
        });

        t.nonNull.int("getUnreadCount", {
            async resolve(_, __, ctx) {
                return notificationService.getScopedUnreadCount(requireNotificationScope(ctx, null, 'view'));
            },
        });
    },
});

export const NotificationMutation = extendType({
    type: "Mutation",
    definition(t) {
        t.nonNull.field("markNotificationRead", {
            type: "Notification",
            args: { id: nonNull(intArg()), accountContext: arg({ type: 'NotificationAccountContext' }) },
            async resolve(_, { id, accountContext }, ctx) {
                return notificationService.markScopedNotificationRead(requireNotificationScope(ctx, accountContext as notificationService.NotificationAccountContext | null, 'edit'), id);
            },
        });

        t.nonNull.boolean("markAllNotificationsRead", {
            args: { accountContext: arg({ type: 'NotificationAccountContext' }) },
            async resolve(_, { accountContext }, ctx) {
                await notificationService.markAllScopedNotificationsRead(requireNotificationScope(ctx, accountContext as notificationService.NotificationAccountContext | null, 'edit'));
                return true;
            },
        });
    },
});
