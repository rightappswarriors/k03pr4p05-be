import { extendType, nonNull, stringArg, intArg, nullable, list, arg, inputObjectType } from 'nexus'
import { PrismaClient } from '@prisma/client'
import { sendNewPONotificationEmail, sendPOStatusEmail } from '../../../services/email/kompraSupplier.email.js'
import { sendToOrg, sendToConversation } from '../../../lib/ws.js'
import { requireAuth } from '../../../middleware/auth.middleware.js'

export const POLineItemInput = inputObjectType({
  name: 'POLineItemInput',
  definition(t) {
    t.nonNull.string('supplierItemId')
    t.nonNull.int('qty')
  },
})

function generatePONumber(): string {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `PO-${datePart}-${rand}`
}

// ─── Ensure PO conversation (get-or-create, idempotent) ─────────────────────────
// Creates a dedicated ORDER conversation for the PO if one does not exist yet.
// Returns the conversationId — reused by createPurchaseOrder and startPOConversation.
async function ensurePOConversation(
  client: PrismaClient,
  po: {
    id: string
    poNumber: string
    supplierOrgId: number
    buyerOrgId?: number | null
    agentId?: string | null
    totalAmount: number
    vatAmount: number
    lineItems: { id: string }[]
  },
): Promise<string> {
  const existing = await client.purchaseOrder.findUnique({
    where: { id: po.id },
    select: { conversationId: true },
  })
  if (existing?.conversationId) {
    return existing.conversationId
  }

  const conv = await client.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        poId: po.id,
        type: 'ORDER',
        ConversationParticipant: {
          create: [
            { agentId: po.agentId, role: 'AGENT' },
            { organizationId: po.supplierOrgId, role: 'SUPPLIER' },
          ],
        },
      },
    })

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { conversationId: conversation.id },
    })

    await tx.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        senderOrgId: po.supplierOrgId,
        message: `Purchase Order ${po.poNumber} has been created.`,
        type: 'ORDER_CREATED',
        metadata: {
          event: 'po_created',
          poId: po.id,
          poNumber: po.poNumber,
          buyerOrgId: po.buyerOrgId,
          totalAmount: po.totalAmount,
          vatAmount: po.vatAmount,
          itemCount: po.lineItems.length,
        },
      },
    })

    return conversation
  })

  return conv.id
}

export const PurchaseOrderMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('createPurchaseOrder', {
      type: 'PurchaseOrder',
      args: {
        supplierOrgId: nonNull(intArg()),
        buyerOrgId: nonNull(intArg()),
        outletId: nonNull(intArg()),
        notes: nullable(stringArg()),
        requestedDate: nullable(arg({ type: 'DateTime' })),
        lineItems: nonNull(list(nonNull(arg({ type: 'POLineItemInput' })))),
      },
      resolve: async (_, { supplierOrgId, buyerOrgId, outletId, notes, requestedDate, lineItems }, ctx) => {
        const poNumber = generatePONumber()

        let totalAmount = 0
        let vatAmount = 0
        const enrichedLines: Array<{ supplierItemId: string; qty: number; unitPrice: number; subtotal: number }> = []

        for (const li of lineItems) {
          const item = await ctx.prisma.supplierItem.findUniqueOrThrow({
            where: { id: li.supplierItemId },
            include: { priceTiers: { orderBy: { minQty: 'desc' } } },
          })

          let unitPrice = item.unitPrice
          for (const tier of item.priceTiers) {
            if (li.qty >= tier.minQty) {
              unitPrice = tier.price
              break
            }
          }

          const subtotal = unitPrice * li.qty
          const vat = item.isVatExempt ? 0 : subtotal * item.vatRate
          totalAmount += subtotal + vat
          vatAmount += vat
          enrichedLines.push({ supplierItemId: li.supplierItemId, qty: li.qty, unitPrice, subtotal })
        }

        const po = await ctx.prisma.purchaseOrder.create({
          data: {
            poNumber,
            supplierOrgId,
            buyerOrgId,
            outletId,
            notes,
            requestedDate,
            totalAmount,
            vatAmount,
            lineItems: { create: enrichedLines },
          },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            supplierOrg: true,
            outlet: true,
          },
        })

        const supplierUser = await ctx.prisma.user.findFirst({
          where: { organizationId: supplierOrgId },
          select: { email: true },
        })
        if (supplierUser?.email) {
          sendNewPONotificationEmail(
            supplierUser.email,
            poNumber,
            po.buyerOrg.name,
            totalAmount
          ).catch(() => {})
        }

        // Create the PO conversation (idempotent — no-op if already linked)
        const convId = await ensurePOConversation(ctx.prisma, {
          id: po.id,
          poNumber,
          supplierOrgId,
          buyerOrgId,
          totalAmount,
          vatAmount,
          lineItems: po.lineItems,
        })

        // Notify the buyer org that a new PO was placed
        sendToOrg(buyerOrgId, 'purchaseOrder:created' as any, {
          poId: po.id,
          poNumber,
          buyerOrgId,
          supplierOrgId,
        })
        sendToConversation(convId, 'conversation:newMessage' as any, {
          conversationId: convId,
          poId: po.id,
          poNumber,
          senderOrgId: supplierOrgId,
          message: `Purchase Order ${poNumber} has been created.`,
          type: 'ORDER_CREATED',
          createdAt: new Date().toISOString(),
          metadata: { event: 'po_created', poId: po.id, poNumber, totalAmount, vatAmount },
        })

        return po
      },
    })

    t.nonNull.field('acceptPO', {
      type: 'PurchaseOrder',
      args: {
        id: nonNull(stringArg()),
        scheduledDate: nonNull(arg({ type: 'DateTime' })),
        driverName: nullable(stringArg()),
        driverContact: nullable(stringArg()),
      },
      resolve: async (_, { id, scheduledDate, driverName, driverContact }, ctx) => {
        const po = await ctx.prisma.purchaseOrder.update({
          where: { id },
          data: {
            status: 'ACCEPTED',
            delivery: {
              create: {
                scheduledDate,
                driverName,
                driverContact,
                status: 'SCHEDULED',
              },
            },
          },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            supplierOrg: true,
            outlet: true,
          },
        })

        const buyerUser = await ctx.prisma.user.findFirst({
          where: { organizationId: po.buyerOrgId },
          select: { email: true },
        })
        if (buyerUser?.email) {
          sendPOStatusEmail(buyerUser.email, po.poNumber, 'ACCEPTED').catch(() => {})
        }

        // Emit realtime events for PO acceptance
        sendToOrg(po.buyerOrgId, 'purchaseOrder:accepted' as any, { poId: po.id, poNumber: po.poNumber })
        if (po.conversationId) {
          sendToConversation(po.conversationId, 'conversation:newMessage' as any, {
            conversationId: po.conversationId,
            poId: po.id,
            poNumber: po.poNumber,
            type: 'PO_ACCEPTED',
            message: `Purchase Order ${po.poNumber} has been accepted.`,
            createdAt: new Date().toISOString(),
            metadata: { event: 'po_accepted', poId: po.id, poNumber: po.poNumber },
          })
        }

        return po
      },
    })

    t.nonNull.field('rejectPO', {
      type: 'PurchaseOrder',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        const po = await ctx.prisma.purchaseOrder.update({
          where: { id },
          data: { status: 'REJECTED' },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            supplierOrg: true,
            outlet: true,
          },
        })

        const buyerUser = await ctx.prisma.user.findFirst({
          where: { organizationId: po.buyerOrgId },
          select: { email: true },
        })
        if (buyerUser?.email) {
          sendPOStatusEmail(buyerUser.email, po.poNumber, 'REJECTED').catch(() => {})
        }

        // Emit realtime events for PO rejection
        sendToOrg(po.buyerOrgId, 'purchaseOrder:rejected' as any, { poId: po.id, poNumber: po.poNumber })
        if (po.conversationId) {
          sendToConversation(po.conversationId, 'conversation:newMessage' as any, {
            conversationId: po.conversationId,
            poId: po.id,
            poNumber: po.poNumber,
            type: 'PO_REJECTED',
            message: `Purchase Order ${po.poNumber} has been rejected.`,
            createdAt: new Date().toISOString(),
            metadata: { event: 'po_rejected', poId: po.id, poNumber: po.poNumber },
          })
        }

        return po
      },
    })
  },
})

// ─── Send message in PO conversation ──────────────────────────────────────

export const SendPoMessageInput = inputObjectType({
  name: 'SendPoMessageInput',
  definition(t) {
    t.nonNull.string('poId');
    t.nonNull.string('message');
    t.list.string('attachments');
    t.string('clientMessageId');
  },
})

export const SendPoMessageMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('sendPoMessage', {
      type: 'ConversationMessage',
      args: {
        input: nonNull(arg({ type: 'SendPoMessageInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        requireAuth(ctx);
        const user = ctx.user!;

        // Verify the supplier has access to this PO
        const po = await ctx.prisma.purchaseOrder.findUniqueOrThrow({
          where: { id: input.poId, supplierOrgId: user.orgId },
          select: { conversationId: true },
        });

        if (!po.conversationId) {
          throw new Error('PO has no conversation');
        }

        const msg = await ctx.prisma.conversationMessage.create({
          data: {
            conversationId: po.conversationId,
            senderOrgId: user.orgId,
            message: input.message,
            type: 'TEXT',
            attachments: input.attachments ?? [],
            ...(input.clientMessageId ? { metadata: { clientMessageId: input.clientMessageId } } : {}),
          },
          include: {
            Agent: true,
            Organization: true,
          },
        });

        // Emit realtime event to the PO conversation room
        sendToConversation(po.conversationId, 'conversation:newMessage', {
          id: msg.id,
          conversationId: po.conversationId,
          senderOrgId: user.orgId,
          message: msg.message,
          type: msg.type,
          createdAt: msg.createdAt.toISOString(),
          attachments: msg.attachments,
        });

        return msg;
      },
    })
  },
})

// ─── PO receipt upload ──────────────────────────────────────────────────────

export const SendPoReceiptInput = inputObjectType({
  name: 'SendPoReceiptInput',
  definition(t) {
    t.nonNull.string('poId')
    t.string('receiptId')
    t.nonNull.float('totalAmount')
    t.nonNull.string('paymentMethod')
    t.string('paymentReference')
    t.nullable.field({ type: 'DateTime', name: 'paidAt' })
    t.string('pdfUrl')
  },
})

export const PoReceiptMutation = extendType({
  type: 'Mutation',
  definition(t) {
    // Scenario B: start a conversation on an existing PO (idempotent)
    t.nullable.field('startPOConversation', {
      type: 'Conversation',
      args: {
        poId: nonNull(stringArg()),
      },
      resolve: async (_, { poId }, ctx) => {
        requireAuth(ctx)
        const user = ctx.user!
        const po = await ctx.prisma.purchaseOrder.findUniqueOrThrow({
          where: { id: poId, supplierOrgId: user.orgId },
          select: {
            id: true,
            poNumber: true,
            supplierOrgId: true,
            buyerOrgId: true,
            agentId: true,
            totalAmount: true,
            vatAmount: true,
            lineItems: { select: { id: true } },
          },
        })
        const convId = await ensurePOConversation(ctx.prisma, {
          id: po.id,
          poNumber: po.poNumber,
          supplierOrgId: po.supplierOrgId,
          buyerOrgId: po.buyerOrgId,
          agentId: po.agentId,
          totalAmount: po.totalAmount,
          vatAmount: po.vatAmount,
          lineItems: po.lineItems,
        })
        sendToConversation(convId, 'conversation:newMessage' as any, {
          conversationId: convId,
          poId: po.id,
          senderOrgId: user.orgId,
          message: `Conversation started for Purchase Order ${po.poNumber}.`,
          type: 'ORDER_CREATED',
          createdAt: new Date().toISOString(),
          metadata: { event: 'conversation_started', poId: po.id, poNumber: po.poNumber },
        })
        return ctx.prisma.conversation.findUnique({ where: { id: convId } })
      },
    })

    // Scenario C: upload a receipt snapshot and post RECEIPT_UPLOADED event
    t.nonNull.field('sendPoReceipt', {
      type: 'PurchaseOrder',
      args: {
        input: nonNull(arg({ type: 'SendPoReceiptInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        requireAuth(ctx)
        const user = ctx.user!
        const po = await ctx.prisma.purchaseOrder.findUniqueOrThrow({
          where: { id: input.poId, supplierOrgId: user.orgId },
          select: {
            id: true,
            poNumber: true,
            supplierOrgId: true,
            buyerOrgId: true,
            agentId: true,
            totalAmount: true,
            vatAmount: true,
            conversationId: true,
            lineItems: { select: { id: true } },
          },
        })

        // Ensure conversation exists (Scenario B fallback)
        let convId = po.conversationId
        if (!convId) {
          convId = await ensurePOConversation(ctx.prisma, {
            id: po.id,
            poNumber: po.poNumber,
            supplierOrgId: po.supplierOrgId,
            buyerOrgId: po.buyerOrgId,
            agentId: po.agentId,
            totalAmount: po.totalAmount,
            vatAmount: po.vatAmount,
            lineItems: po.lineItems,
          })
        }

        const receiptId = input.receiptId ?? `RCPT-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const receiptSnapshot = JSON.stringify({
          receiptId,
          totalAmount: input.totalAmount,
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference ?? null,
          paidAt: input.paidAt ?? new Date().toISOString(),
          pdfUrl: input.pdfUrl ?? null,
        })

        const updatedPO = await ctx.prisma.purchaseOrder.update({
          where: { id: po.id },
          data: {
            receiptSnapshot: receiptSnapshot,
            paymentStatus: 'PAID',
          },
          include: {
            lineItems: { include: { supplierItem: { include: { priceTiers: true } } } },
            delivery: true,
            buyerOrg: true,
            supplierOrg: true,
          },
        })

        // Post RECEIPT_UPLOADED system message in the PO conversation
        const receiptUrl = input.pdfUrl ?? null
        await ctx.prisma.conversationMessage.create({
          data: {
            conversationId: convId!,
            senderOrgId: user.orgId,
            message: `Receipt ${receiptId} has been uploaded for Purchase Order ${po.poNumber}.`,
            type: 'RECEIPT_UPLOADED',
            metadata: {
              event: 'receipt_uploaded',
              poId: po.id,
              poNumber: po.poNumber,
              receiptId,
              totalAmount: input.totalAmount,
              paymentMethod: input.paymentMethod,
              receiptUrl,
              paidAt: input.paidAt ?? new Date().toISOString(),
            },
          },
        })

        sendToConversation(convId!, 'conversation:newMessage' as any, {
          conversationId: convId!,
          poId: po.id,
          senderOrgId: user.orgId,
          message: `Receipt ${receiptId} has been uploaded for Purchase Order ${po.poNumber}.`,
          type: 'RECEIPT_UPLOADED',
          createdAt: new Date().toISOString(),
          metadata: {
            event: 'receipt_uploaded',
            poId: po.id,
            poNumber: po.poNumber,
            receiptId,
            totalAmount: input.totalAmount,
            paymentMethod: input.paymentMethod,
            receiptUrl,
          },
        })
        sendToOrg(po.buyerOrgId, 'purchaseOrder:receiptUploaded' as any, {
          poId: po.id,
          poNumber: po.poNumber,
        })

        return updatedPO
      },
    })
  },
})
