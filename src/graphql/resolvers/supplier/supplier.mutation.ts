// graphql/supplier/supplier.mutation.js
/*import { extendType, nonNull, stringArg, intArg } from "nexus";
import {
  requireAuth,
  requireRole,
} from "../../../middleware/auth.middleware.js";
import * as supplierService from "../../../services/supplier.service.js";

export const SupplierMutation = extendType({
  type: "Mutation",
  definition(t) {
    // Create supplier
    t.field("createSupplier", {
      type: "Supplier",
      args: {
        name: nonNull(stringArg()),
        address: stringArg(),
        zipCode: stringArg(),
        contactNumber: nonNull(stringArg()),
        contactName: nonNull(stringArg()),
        faxNumber: stringArg(),
        tinNumber: stringArg(),
      },
      async resolve(_, args, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await supplierService.createSupplier(args);
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error creating supplier:", error);
          throw new Error("Failed to create supplier.");
        }
      },
    });

    // Update supplier
    t.field("updateSupplier", {
      type: "Supplier",
      args: {
        id: nonNull(intArg()),
        name: stringArg(),
        address: stringArg(),
        zipCode: stringArg(),
        contactNumber: stringArg(),
        contactName: stringArg(),
        faxNumber: stringArg(),
        tinNumber: stringArg(),
      },
      async resolve(_, { id, ...data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          return await supplierService.updateSupplier(id, data);
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error updating supplier:", error);
          throw new Error("Failed to update supplier.");
        }
      },
    });

    // Delete supplier
    t.boolean("deleteSupplier", {
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN"]);

        try {
          await supplierService.deleteSupplier(id);
          return true;
        } catch (error) {
          if (error.code === "P2025") {
            throw new Error("Supplier not found.");
          }
          if (process.env.NODE_ENV === "development") console.error("Error deleting supplier:", error);
          throw new Error("Failed to delete supplier.");
        }
      },
    });
  },
});
*/

// rai-pos-backend/src/graphql/resolvers/supplier/supplier.mutation.ts
import { extendType, nonNull, stringArg, intArg, list, arg } from 'nexus';
import { sendEmail } from '../../../services/email/email.service.js';
import { prisma } from '../../../lib/prisma.js';

export const SupplierMutation = extendType({
  type: 'Mutation',
  definition(t) {

    // Called when supplier opens the portal — marks as acknowledged
    t.field('supplierAcknowledgeOrder', {
      type: 'SupplierOrder',
      args: {
        token: nonNull(stringArg()),
      },
      async resolve(_, { token }) {
        const order = await prisma.supplierOrder.findUnique({ where: { supplierToken: token } });
        if (!order) throw new Error('Invalid token');
        if (new Date() > order.tokenExpiresAt) throw new Error('Token expired');

        return prisma.supplierOrder.update({
          where: { id: order.id },
          data: { status: 'acknowledged' },
        });
      },
    });

    // Supplier fills in qty + expiry per item, then either sends or cancels
    t.field('supplierSubmitOrder', {
      type: 'SupplierOrder',
      args: {
        token: nonNull(stringArg()),
        action: nonNull(stringArg()), // 'send' | 'cancel'
        items: nonNull(list(nonNull(arg({ type: 'SupplierOrderItemInput' })))),
        message: stringArg(),
      },
      async resolve(_, { token, action, items, message }) {
        const order = await prisma.supplierOrder.findUnique({
          where: { supplierToken: token },
          include: { items: { include: { item: true } } },
        });
        if (!order) throw new Error('Invalid token');
        if (new Date() > order.tokenExpiresAt) throw new Error('Token expired');
        if (order.status === 'delivered' || order.status === 'cancelled') {
          throw new Error('Order already finalised');
        }

        const newStatus = action === 'send' ? 'sent' : 'cancelled';

        // Update each order item with supplier's response
        if (action === 'send') {
          await Promise.all(
            items.map((inp) =>
              prisma.supplierOrderItem.update({
                where: { id: inp.orderItemId },
                data: {
                  deliveredQty: inp.deliveredQty,
                  expiryStartDate: inp.expiryStartDate,
                  expiryEndDate: inp.expiryEndDate,
                  exactExpiryDate: inp.exactExpiryDate,
                },
              })
            )
          );
        }

        const updatedOrder = await prisma.supplierOrder.update({
          where: { id: order.id },
          data: {
            status: newStatus,
            supplierMessage: message ?? null,
          },
          include: { items: { include: { item: true } } },
        });

        // Find the user who owns this org to notify (get owner of org's branch/outlet)
        // You'll need to adjust this to your auth context — for now we fetch org owner
        const orgOwner = await prisma.user.findFirst({
          where: { orgId: order.orgId, role: 'ADMIN' },
        });

        if (orgOwner?.email) {
          const statusText = action === 'send' ? 'dispatched your order' : 'cancelled the order';
          await sendEmail({
            to: orgOwner.email,
            from: 'noreply@yourdomain.com',
            subject: action === 'send'
              ? 'Your restock order has been dispatched'
              : 'Restock order cancelled by supplier',
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2>${action === 'send' ? 'Order Dispatched' : 'Order Cancelled'}</h2>
                <p>The supplier has ${statusText}.</p>
                ${message ? `<p><strong>Supplier message:</strong> ${message}</p>` : ''}
                ${action === 'send' ? `
                  <h3>Items being sent:</h3>
                  <ul>
                    ${updatedOrder.items.map(i =>
                      `<li>${i.item.name}: ${i.deliveredQty} units</li>`
                    ).join('')}
                  </ul>
                  <p>Please confirm delivery in the app when items arrive.</p>
                ` : ''}
              </div>
            `,
          });
        }

        // TODO: push notification to the user here via Expo Push
        // await sendPushNotification(orgOwner.pushToken, { ... })

        return updatedOrder;
      },
    });

    // User confirms delivery — this is the final step that updates actual stock
    t.field('confirmDelivery', {
      type: 'SupplierOrder',
      args: {
        orderId: nonNull(intArg()),
        items: nonNull(list(nonNull(arg({ type: 'SupplierOrderItemInput' })))),
      },
      async resolve(_, { orderId, items }, ctx) {
        // requireAuth(ctx); requireRole(ctx, ['ADMIN', 'MANAGER']);

        const order = await prisma.supplierOrder.findUnique({
          where: { id: orderId },
          include: { items: { include: { item: true } } },
        });
        if (!order) throw new Error('Order not found');
        if (order.status !== 'sent') throw new Error('Order is not in sent status');

        await prisma.$transaction(async (tx) => {
          for (const inp of items) {
            const orderItem = order.items.find((oi) => oi.id === inp.orderItemId);
            if (!orderItem) continue;

            const confirmedQty = inp.deliveredQty; // user enters actual received qty

            // 1. Update confirmedQty on the order item
            await tx.supplierOrderItem.update({
              where: { id: inp.orderItemId },
              data: { confirmedQty },
            });

            // 2. Increment the Item's stock
            await tx.item.update({
              where: { id: orderItem.itemId },
              data: { stock: { increment: confirmedQty } },
            });

            // 3. Create a StockBatch for FEFO tracking
            await tx.stockBatch.create({
              data: {
                itemId: orderItem.itemId,
                orgId: order.orgId,
                orderId: order.id,
                quantity: confirmedQty,
                remainingQty: confirmedQty,
                expiryStartDate: inp.expiryStartDate ?? orderItem.expiryStartDate,
                expiryEndDate: inp.expiryEndDate ?? orderItem.expiryEndDate,
                exactExpiryDate: inp.exactExpiryDate ?? orderItem.exactExpiryDate,
              },
            });

            // 4. Update the Item's expiry fields to reflect the latest batch
            await tx.item.update({
              where: { id: orderItem.itemId },
              data: {
                expiryStartDate: inp.expiryStartDate ?? orderItem.expiryStartDate,
                expiryEndDate: inp.expiryEndDate ?? orderItem.expiryEndDate,
                exactExpiryDate: inp.exactExpiryDate ?? orderItem.exactExpiryDate,
              },
            });
          }

          // 5. Mark order as delivered
          await tx.supplierOrder.update({
            where: { id: orderId },
            data: { status: 'delivered' },
          });
        });

        // Notify supplier that their order was received by the client.
        await sendEmail({
          to: order.supplierEmail,
          from: 'noreply@yourdomain.com',
          subject: `Order #${order.id} Confirmed Received`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <h2>Order Received</h2>
              <p>Your order (ID: ${order.id}) has been marked as <strong>delivered</strong> by the customer.</p>
              <p>Thank you for fulfilling the delivery.</p>
            </div>
          `,
        });

        return prisma.supplierOrder.findUnique({ where: { id: orderId } });
      },
    });
  },
});