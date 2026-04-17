// src/services/notification.service.ts
import { prisma } from '../lib/prisma.js';
import { sendToUser } from "../lib/ws.js";
export const createNotification = async (data) => {
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
    sendToUser(data.notifyUserId, {
        type: "NOTIFICATION",
        payload: {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            outletId: notification.outletId,
            itemId: notification.itemId,
            createdAt: notification.createdAt,
        },
    });
    return notification;
};
export const getNotifications = async (orgId, limit = 20) => {
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
export const markAsRead = async (id) => {
    return prisma.notification.update({
        where: { id },
        data: { isRead: true },
    });
};
export const markAllAsRead = async (orgId) => {
    return prisma.notification.updateMany({
        where: { orgId, isRead: false },
        data: { isRead: true },
    });
};
export const getUnreadCount = async (orgId) => {
    return prisma.notification.count({
        where: { orgId, isRead: false },
    });
};
