// graphql/resolvers/notification/notification.type.ts
import { objectType, extendType, nonNull, intArg, arg } from "nexus";
import * as notificationService from "../../services/notification.service.js";
import { requireAuth, requireRole } from "../../middleware/auth.middleware.js";

export const NotificationType = objectType({
    name: "Notification",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("orgId");
        t.nullable.int("outletId");
        t.nullable.int("itemId");
        t.nonNull.string("type");
        t.nonNull.string("title");
        t.nonNull.string("message");
        t.nonNull.boolean("isRead");
        t.nonNull.string("createdAt");
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

export const NotificationQuery = extendType({
    type: "Query",
    definition(t) {
        t.nonNull.list.nonNull.field("getNotifications", {
            type: "Notification",
            args: { limit: intArg() },
            async resolve(_, { limit }, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER", "MANAGER"]);
                return notificationService.getNotifications(
                    ctx.user.orgId,
                    limit ?? 20
                );
            },
        });

        t.nonNull.int("getUnreadCount", {
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                requireRole(ctx, ["ADMIN", "OWNER", "MANAGER"]);
                return notificationService.getUnreadCount(ctx.user.orgId);
            },
        });
    },
});

export const NotificationMutation = extendType({
    type: "Mutation",
    definition(t) {
        t.nonNull.field("markNotificationRead", {
            type: "Notification",
            args: { id: nonNull(intArg()) },
            async resolve(_, { id }, ctx) {
                requireAuth(ctx);
                return notificationService.markAsRead(id);
            },
        });

        t.nonNull.boolean("markAllNotificationsRead", {
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                await notificationService.markAllAsRead(ctx.user.orgId);
                return true;
            },
        });
    },
});