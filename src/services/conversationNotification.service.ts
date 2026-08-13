import { NotificationType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface ConversationNotificationInput {
  conversationId: string;
  senderId: string | number;
  recipientAgentId: string;
  recipientUserId?: number | null;
  notificationType: NotificationType;
  message: string;
}

const notificationTitles: Record<NotificationType, string> = {
  OUTLET_LOW_STOCK: 'Low stock alert',
  ORG_CRITICAL_STOCK: 'Critical stock alert',
  NEW_TRANSACTION: 'New message from Agent Request For Quotation',
  RFQ_RECEIVED: 'RFQ received',
  COUNTER_OFFER: 'Counter Offer Received',
  NEGOTIATION_ACCEPTED: 'Negotiation accepted',
  NEGOTIATION_REJECTED: 'Negotiation rejected',
  PURCHASE_ORDER_CREATED: 'Purchase Order Created',
};

function warnInDevelopment(message: string, context: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[ConversationNotification] ${message}`, context);
  }
}

/**
 * Delivers a best-effort convenience notification for a persisted conversation event.
 * Conversation messages are deliberately not written here: notification failures must
 * never affect the canonical conversation record.
 */
export async function sendConversationNotification(
  input: ConversationNotificationInput,
): Promise<{ delivered: boolean }> {
  const { conversationId, senderId, recipientAgentId, recipientUserId, notificationType, message } = input;

  if (recipientUserId == null) {
    warnInDevelopment('Skipped notification because the recipient agent has no user target.', {
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
      select: { Agent: { select: { organizationId: true } } },
    });
    const recipientOrgId = participant?.Agent?.organizationId;

    if (recipientOrgId == null) {
      warnInDevelopment('Skipped notification because the recipient agent has no organization inbox.', {
        conversationId,
        senderId,
        recipientAgentId,
        recipientUserId,
        notificationType,
      });
      return { delivered: false };
    }

    await prisma.notification.create({
      data: {
        orgId: recipientOrgId,
        type: notificationType,
        title: notificationTitles[notificationType],
        message,
        isRead: false,
      },
    });

    return { delivered: true };
  } catch (error) {
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
