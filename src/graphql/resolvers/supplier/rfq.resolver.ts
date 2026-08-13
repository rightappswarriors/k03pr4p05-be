// GraphQL resolvers for Supplier RFQ Inbox & Negotiation
import { extendType, nonNull, intArg, arg, list, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { SupplierRFQService } from '../../../services/supplierRFQService.js';

const service = new SupplierRFQService();

// ─── Queries ──────────────────────────────────────────────────────────────────

export const SupplierRfqQuery = extendType({
    type: 'Query',
    definition(t) {
        // List RFQs for supplier inbox
        t.nonNull.list.nonNull.field('supplierInboxRFQs', {
            type: 'RequestForQuotation',
            args: {
                supplierOrgId: nonNull(intArg()),
                status: arg({ type: 'RfqStatus' }),
                search: stringArg(),
                unreadOnly: arg({ type: 'Boolean' }),
                dateFrom: arg({ type: 'DateTime' }),
                dateTo: arg({ type: 'DateTime' }),
            },
            resolve: async (_, args, ctx) => {
                requireAuth(ctx);
                const user = ctx.user!;
                if (user.orgId !== args.supplierOrgId) {
                    throw new Error('Unauthorized: supplierOrgId does not match user organization');
                }
                return service.getSupplierInbox(args.supplierOrgId, {
                    status: args.status ?? undefined,
                    search: args.search ?? undefined,
                    unreadOnly: args.unreadOnly ?? false,
                    dateFrom: args.dateFrom ?? undefined,
                    dateTo: args.dateTo ?? undefined,
                });
            },
        });

        // Get full RFQ detail (conversation + offers + buyer + product)
        t.nullable.field('supplierRFQDetails', {
            type: 'RequestForQuotation',
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                const user = ctx.user!;
                const result = await service.getRFQDetails(id, user.orgId);

                // Mark as read when viewing
                const conversationId = result.Conversation?.id;
                if (conversationId) {
                    await service.markRead(conversationId, user.orgId).catch(() => {});
                }

                return result;
            },
        });
    },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const SupplierRfqMutation = extendType({
    type: 'Mutation',
    definition(t) {
        // Reply to RFQ — creates a conversation message
        t.nonNull.field('replyToRFQ', {
            type: 'ConversationMessage',
            args: {
                input: nonNull(arg({ type: 'ReplyToRFQInput' })),
            },
            resolve: async (_, { input }, ctx) => {
                requireAuth(ctx);
                const user = ctx.user!;
                const rfq = await service.getRFQDetails(input.rfqId, user.orgId);
                if (!rfq.Conversation) {
                    throw new Error('RFQ has no conversation');
                }
                return service.reply(
                    rfq.Conversation.id,
                    user.orgId,
                    input.message,
                    input.attachments ?? [],
                    input.clientMessageId ?? undefined,
                );
            },
        });

        // Send counter offer
        t.nonNull.field('counterOfferRFQ', {
            type: 'NegotiationOffer',
            args: {
                input: nonNull(arg({ type: 'CounterOfferInput' })),
            },
            resolve: async (_, { input }, ctx) => {
                requireAuth(ctx);
                const user = ctx.user!;
                const rfq = await service.getRFQDetails(input.rfqId, user.orgId);
                if (!rfq.Conversation) {
                    throw new Error('RFQ has no conversation');
                }
                return service.counterOffer(rfq.Conversation.id, user.orgId, {
                    quantity: input.quantity,
                    unitPrice: input.unitPrice,
                    deliveryDate: input.deliveryDate ?? undefined,
                    minimumOrderQuantity: input.minimumOrderQuantity ?? undefined,
                    estimatedLeadTime: input.estimatedLeadTime ?? undefined,
                    validUntil: input.validUntil ?? undefined,
                    notes: input.notes ?? undefined,
                });
            },
        });

        // Accept negotiation → supplier confirms agreement → RFQ moves to WAITING_SUPPLIER_CONFIRMATION
        t.nonNull.field('acceptNegotiation', {
            type: 'RequestForQuotation',
            args: {
                input: nonNull(arg({ type: 'AcceptNegotiationInput' })),
            },
            resolve: async (_, { input }, ctx) => {
                requireAuth(ctx);
                const user = ctx.user!;
                await service.getRFQDetails(input.rfqId, user.orgId); // ownership check
                return service.confirmSupplierAgreement(input.rfqId, user.orgId);
            },
        });

        // Reject negotiation
        t.nonNull.field('rejectNegotiation', {
            type: 'RequestForQuotation',
            args: {
                input: nonNull(arg({ type: 'RejectNegotiationInput' })),
            },
            resolve: async (_, { input }, ctx) => {
                requireAuth(ctx);
                const user = ctx.user!;
                await service.getRFQDetails(input.rfqId, user.orgId); // ownership check
                return service.rejectNegotiation(
                    input.rfqId,
                    user.orgId,
                    input.reason ?? undefined,
                );
            },
        });

        // Create Purchase Order (single RFQ) — supplier initiates PO after confirmation
        t.nonNull.field('createPurchaseOrder', {
            type: 'CreatePurchaseOrderOutput',
            args: {
                rfqId: nonNull(stringArg()),
                deliveryDate: nonNull(arg({ type: 'DateTime' })),
                driverName: stringArg(),
                driverContact: stringArg(),
            },
            resolve: async (_, args, ctx) => {
                requireAuth(ctx);
                const user = ctx.user!;
                await service.getRFQDetails(args.rfqId, user.orgId); // ownership check
                const result = await service.createPurchaseOrder(
                    args.rfqId,
                    user.orgId,
                    args.deliveryDate,
                    args.driverName ?? undefined,
                    args.driverContact ?? undefined,
                );
                return { success: true, poNumber: result.po.poNumber, purchaseOrder: result.po };
            },
        });

        // Mark RFQ conversation as read
        t.nonNull.boolean('markRFQRead', {
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                const user = ctx.user!;
                const rfq = await service.getRFQDetails(id, user.orgId);
                if (!rfq.Conversation) {
                    throw new Error('RFQ has no conversation');
                }
                await service.markRead(rfq.Conversation.id, user.orgId);
                return true;
            },
        });
    },
});
