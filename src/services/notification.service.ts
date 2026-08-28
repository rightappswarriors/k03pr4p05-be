// src/services/notification.service.ts
// for the items
import { prisma } from '../lib/prisma.js';
import { sendToUser, sendToOrg } from "../lib/ws.js";


export const createNotification = async (data: {
    orgId: number;
    outletId?: number;
    itemId?: number;
    type: "OUTLET_LOW_STOCK" | "ORG_CRITICAL_STOCK" | "NEW_TRANSACTION" | "RFQ_RECEIVED" | "COUNTER_OFFER" | "NEGOTIATION_ACCEPTED" | "NEGOTIATION_REJECTED" | "PURCHASE_ORDER_CREATED";
    title: string;
    message: string;
    notifyUserId: number; // owner/manager to notify via WS
}) => {
    const notification = await prisma.notification.create({
        data: {
            orgId: data.orgId,
            outletId: data.outletId ?? null,
            itemId: data.itemId ?? null,
            type: data.type,
            title: data.title,
            message: data.message,
        },
    });

    // Send real-time via WebSocket
    sendToUser(data.notifyUserId, "notification:new", {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        outletId: notification.outletId,
        itemId: notification.itemId,
        createdAt: notification.createdAt,
    });

    return notification;
};

export const getNotifications = async (orgId: number, limit = 20) => {
    return prisma.notification.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            outlet: { select: { id: true, name: true } },
            item: { select: { id: true, name: true } },
        },
    });
};

export const markAsRead = async (id: number) => {
    return prisma.notification.update({
        where: { id },
        data: { isRead: true },
    });
};

export const markAllAsRead = async (orgId: number) => {
    return prisma.notification.updateMany({
        where: { orgId, isRead: false },
        data: { isRead: true },
    });
};

export const getUnreadCount = async (orgId: number) => {
    return prisma.notification.count({
        where: { orgId, isRead: false },
    });
};

/**
 * Mark all unread notifications for a given conversation as read for a specific
 * organization. Authorization-safe: only notifications belonging to the given
 * orgId are updated. Emits a realtime "notification:read" event to the org room.
 *
 * Per architecture rule, notifications related to a conversation have both
 * agentId and conversationId. To mark only a specific agent's notifications
 * as read (e.g. a supplier agent viewing their conversation), pass the optional
 * agentId — this prevents one agent's read state from affecting another's.
 */
export const markConversationNotificationsRead = async (
    conversationId: string,
    orgId: number,
    agentId?: string | null,
): Promise<number> => {
    const { count } = await prisma.notification.updateMany({
        where: {
            conversationId,
            orgId,
            ...(agentId ? { agentId } : {}),
            isRead: false,
        },
        data: { isRead: true },
    });

    if (count > 0) {
        sendToOrg(orgId, "notification:read", { conversationId, agentId: agentId ?? null });
    }

    return count;
};