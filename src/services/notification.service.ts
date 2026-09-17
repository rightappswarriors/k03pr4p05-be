// src/services/notification.service.ts
// for the items
import { prisma } from '../lib/prisma.js';
import { sendToUser, sendToOrg, sendToRole } from "../lib/ws.js";

export type NotificationAccountContext = 'SUPPLIER' | 'RETAIL' | 'ADMIN';
export type NotificationCategory = 'ORDERS' | 'PAYMENTS' | 'DELIVERY' | 'RFQ' | 'MESSAGES' | 'FINANCE' | 'SUPPLIER_LINKS' | 'SYSTEM';
export type NotificationFilter = 'ALL' | 'UNREAD' | NotificationCategory;
export type NotificationRecipientScope = { recipientAudience: 'ACCOUNT'; orgId: number } | { recipientAudience: 'PLATFORM_ADMIN'; orgId: null };

type BusinessNotificationData = {
    orgId: number;
    outletId?: number | null;
    conversationId?: string | null;
    type: "NEW_TRANSACTION" | "PURCHASE_ORDER_CREATED";
    title: string;
    message: string;
    referenceType?: string | null;
    referenceId?: string | null;
};

const CATEGORY_TERMS: Record<NotificationCategory, string[]> = {
    ORDERS: ['purchase order', 'order accepted', 'order declined', 'order created'],
    PAYMENTS: ['payment', 'refund'],
    DELIVERY: ['delivery', 'dispatch', 'in transit'],
    RFQ: ['rfq', 'quotation', 'counter offer', 'negotiation'],
    MESSAGES: ['message', 'conversation', 'chat'],
    FINANCE: ['withdrawal', 'payout', 'settlement', 'wallet', 'escrow'],
    SUPPLIER_LINKS: ['supplier link', 'supplier connection', 'link request'],
    SYSTEM: ['system', 'verification', 'account review', 'low stock', 'critical stock'],
};

const REFERENCE_CATEGORY: Record<string, NotificationCategory> = {
    PAYMENT: 'PAYMENTS',
    PAYMENT_TRANSACTION: 'PAYMENTS',
    DELIVERY: 'DELIVERY',
    RFQ: 'RFQ',
    CONVERSATION: 'MESSAGES',
    WITHDRAWAL: 'FINANCE',
    SETTLEMENT: 'FINANCE',
    PAYOUT: 'FINANCE',
    SUPPLIER_LINK: 'SUPPLIER_LINKS',
};

export function categorizeNotification(notification: { type?: string | null; title?: string | null; message?: string | null; referenceType?: string | null }): NotificationCategory {
    const referenceCategory = notification.referenceType ? REFERENCE_CATEGORY[notification.referenceType] : undefined;
    if (referenceCategory) return referenceCategory;
    if (['RFQ_RECEIVED', 'COUNTER_OFFER', 'NEGOTIATION_ACCEPTED', 'NEGOTIATION_REJECTED'].includes(notification.type ?? '')) return 'RFQ';
    if (notification.type === 'PURCHASE_ORDER_CREATED') return 'ORDERS';
    if (['OUTLET_LOW_STOCK', 'ORG_CRITICAL_STOCK'].includes(notification.type ?? '')) return 'SYSTEM';
    const text = `${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();
    for (const category of ['PAYMENTS', 'DELIVERY', 'RFQ', 'MESSAGES', 'FINANCE', 'SUPPLIER_LINKS', 'ORDERS', 'SYSTEM'] as NotificationCategory[]) {
        if (CATEGORY_TERMS[category].some((term) => text.includes(term))) return category;
    }
    if (notification.referenceType === 'PURCHASE_ORDER') return 'ORDERS';
    return 'SYSTEM';
}

function categoryWhere(category: NotificationCategory) {
    const referenceTypes = Object.entries(REFERENCE_CATEGORY).filter(([, value]) => value === category).map(([key]) => key);
    const typeMap: Partial<Record<NotificationCategory, string[]>> = {
        ORDERS: ['PURCHASE_ORDER_CREATED'],
        RFQ: ['RFQ_RECEIVED', 'COUNTER_OFFER', 'NEGOTIATION_ACCEPTED', 'NEGOTIATION_REJECTED'],
        SYSTEM: ['OUTLET_LOW_STOCK', 'ORG_CRITICAL_STOCK'],
    };
    const OR: any[] = [];
    if (referenceTypes.length) OR.push({ referenceType: { in: referenceTypes } });
    if (typeMap[category]?.length) OR.push({ type: { in: typeMap[category] } });
    for (const term of CATEGORY_TERMS[category]) {
        OR.push({ title: { contains: term, mode: 'insensitive' } }, { message: { contains: term, mode: 'insensitive' } });
    }
    return { OR };
}

export const persistBusinessNotification = async (client: any, data: BusinessNotificationData) => {
    const identity = {
        orgId: data.orgId,
        outletId: data.outletId ?? null,
        conversationId: data.conversationId ?? null,
        type: data.type,
        title: data.title,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
    };
    const existing = await client.notification.findFirst({ where: identity });
    if (existing) return { notification: existing, created: false };

    const notification = await client.notification.create({
        data: { ...identity, message: data.message },
    });
    return { notification, created: true };
};

export const publishBusinessNotification = (notification: any) => {
    if (!notification?.orgId) return;
    sendToOrg(notification.orgId, "notification:new", {
        id: notification.id,
        recipientAudience: 'ACCOUNT',
        type: notification.type,
        title: notification.title,
        message: notification.message,
        outletId: notification.outletId,
        conversationId: notification.conversationId,
        referenceType: notification.referenceType,
        referenceId: notification.referenceId,
        category: categorizeNotification(notification),
        isRead: notification.isRead,
        createdAt: notification.createdAt,
    });
};

export const persistPlatformAdminNotification = async (client: any, data: { type: "NEW_TRANSACTION" | "PURCHASE_ORDER_CREATED"; title: string; message: string; referenceType?: string | null; referenceId?: string | null }) => {
    const identity = {
        recipientAudience: 'PLATFORM_ADMIN' as const,
        orgId: null,
        type: data.type,
        title: data.title,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
    };
    const existing = await client.notification.findFirst({ where: identity });
    if (existing) return { notification: existing, created: false };
    return { notification: await client.notification.create({ data: { ...identity, message: data.message } }), created: true };
};

export const publishPlatformAdminNotification = (notification: any) => {
    if (!notification || notification.recipientAudience !== 'PLATFORM_ADMIN') return;
    sendToRole('ADMIN', 'notification:new', {
        id: notification.id,
        recipientAudience: 'PLATFORM_ADMIN',
        type: notification.type,
        title: notification.title,
        message: notification.message,
        referenceType: notification.referenceType,
        referenceId: notification.referenceId,
        category: categorizeNotification(notification),
        isRead: notification.isRead,
        createdAt: notification.createdAt,
    });
};

export const getNotificationPage = async (scope: NotificationRecipientScope, filter: NotificationFilter = 'ALL', pageValue = 1, pageSizeValue = 20) => {
    const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
    const pageSize = Number.isInteger(pageSizeValue) && pageSizeValue > 0 ? Math.min(pageSizeValue, 50) : 20;
    const scopeWhere = scope.recipientAudience === 'PLATFORM_ADMIN'
        ? { recipientAudience: 'PLATFORM_ADMIN' as const, orgId: null }
        : { recipientAudience: 'ACCOUNT' as const, orgId: scope.orgId };
    const where: any = {
        ...scopeWhere,
        deletedAt: null,
        ...(filter === 'UNREAD' ? { isRead: false } : {}),
        ...(!['ALL', 'UNREAD'].includes(filter) ? categoryWhere(filter as NotificationCategory) : {}),
    };
    const [items, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { ...scopeWhere, deletedAt: null, isRead: false } }),
    ]);
    return { items, total, unreadCount, page, pageSize, hasNextPage: page * pageSize < total };
};

export const getScopedUnreadCount = (scope: NotificationRecipientScope) => prisma.notification.count({
    where: scope.recipientAudience === 'PLATFORM_ADMIN'
        ? { recipientAudience: 'PLATFORM_ADMIN', orgId: null, deletedAt: null, isRead: false }
        : { recipientAudience: 'ACCOUNT', orgId: scope.orgId, deletedAt: null, isRead: false },
});

export const markScopedNotificationRead = async (scope: NotificationRecipientScope, id: number) => {
    const scopeWhere = scope.recipientAudience === 'PLATFORM_ADMIN'
        ? { recipientAudience: 'PLATFORM_ADMIN' as const, orgId: null }
        : { recipientAudience: 'ACCOUNT' as const, orgId: scope.orgId };
    const existing = await prisma.notification.findFirst({ where: { id, ...scopeWhere, deletedAt: null } });
    if (!existing) throw new Error('Resource not found.');
    if (!existing.isRead) {
        await prisma.notification.updateMany({ where: { id, ...scopeWhere, isRead: false }, data: { isRead: true } });
        if (scope.recipientAudience === 'PLATFORM_ADMIN') sendToRole('ADMIN', 'notification:read', { id });
        else sendToOrg(scope.orgId, 'notification:read', { id });
    }
    return { ...existing, isRead: true };
};

export const markAllScopedNotificationsRead = async (scope: NotificationRecipientScope) => {
    const scopeWhere = scope.recipientAudience === 'PLATFORM_ADMIN'
        ? { recipientAudience: 'PLATFORM_ADMIN' as const, orgId: null }
        : { recipientAudience: 'ACCOUNT' as const, orgId: scope.orgId };
    const { count } = await prisma.notification.updateMany({ where: { ...scopeWhere, deletedAt: null, isRead: false }, data: { isRead: true } });
    if (count > 0) {
        if (scope.recipientAudience === 'PLATFORM_ADMIN') sendToRole('ADMIN', 'notification:read', { all: true });
        else sendToOrg(scope.orgId, 'notification:read', { all: true });
    }
    return count;
};


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
