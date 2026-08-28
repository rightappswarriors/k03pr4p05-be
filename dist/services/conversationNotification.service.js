import { prisma } from '../lib/prisma.js';
import { sendToOrg, sendToUser } from '../lib/ws.js';
const notificationTitles = {
    OUTLET_LOW_STOCK: 'Low stock alert',
    ORG_CRITICAL_STOCK: 'Critical stock alert',
    NEW_TRANSACTION: 'New message from Agent Request For Quotation',
    RFQ_RECEIVED: 'RFQ received',
    COUNTER_OFFER: 'Counter Offer Received',
    NEGOTIATION_ACCEPTED: 'Negotiation accepted',
    NEGOTIATION_REJECTED: 'Negotiation rejected',
    PURCHASE_ORDER_CREATED: 'Purchase Order Created',
};
function warnInDevelopment(message, context) {
    if (process.env.NODE_ENV === 'development') {
        console.warn(`[ConversationNotification] ${message}`, context);
    }
}
/**
 * Delivers a best-effort convenience notification for a persisted conversation event.
 * Conversation messages are deliberately not written here: notification failures must
 * never affect the canonical conversation record.
 */
export async function sendConversationNotification(input) {
    const { conversationId, senderId, recipientAgentId, recipientUserId, notificationType, message } = input;
    if (recipientAgentId == null) {
        warnInDevelopment('Skipped notification because no recipient agent was specified.', {
            conversationId,
            senderId,
            recipientAgentId,
            notificationType,
        });
        return { delivered: false };
    }
    try {
        const participant = await prisma.conversationParticipant.findFirst({
            where: { conversationId, agentId: recipientAgentId },
            select: { Agent: { select: { organizationId: true, id: true } } },
        });
        const recipientOrgId = participant?.Agent?.organizationId;
        // Per architecture rule: an Agent may exist without an organization.
        // agentId is the primary recipient identity. If the agent has no org,
        // orgId is left null but the notification is still created and delivered.
        const notification = await prisma.notification.create({
            data: {
                orgId: recipientOrgId ?? null,
                agentId: recipientAgentId,
                type: notificationType,
                title: notificationTitles[notificationType],
                conversationId,
                message,
                isRead: false,
            },
        });
        // Realtime delivery — prefer direct agent targeting, fall back to org room
        if (recipientUserId != null) {
            sendToUser(recipientUserId, "notification:new", {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                conversationId,
                agentId: recipientAgentId,
                orgId: recipientOrgId ?? null,
                createdAt: notification.createdAt,
            });
        }
        if (recipientOrgId != null) {
            sendToOrg(recipientOrgId, "notification:new", {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                conversationId,
                agentId: recipientAgentId,
                orgId: recipientOrgId,
                createdAt: notification.createdAt,
            });
        }
        return { delivered: true };
    }
    catch (error) {
        warnInDevelopment('Notification delivery failed after the conversation event was committed.', {
            conversationId,
            senderId,
            recipientAgentId,
            recipientUserId,
            notificationType,
            error: error instanceof Error ? error.message : String(error),
        });
        return { delivered: false };
    }
}
