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
import { extendType, nonNull, stringArg, intArg, list, arg, booleanArg, floatArg } from 'nexus';
import { sendEmail } from '../../../services/email/email.service.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
export const SupplierMutation = extendType({
    type: 'Mutation',
    definition(t) {
        // Register supplier (without authentication - public endpoint)
        t.field('registerSupplier', {
            type: 'SupplierProfile',
            args: {
                companyName: nonNull(stringArg()),
                contactPerson: nonNull(stringArg()),
                email: nonNull(stringArg()),
                phone: nonNull(stringArg()),
                productCategories: nonNull(list(nonNull(stringArg()))),
                taxId: stringArg(),
                businessRegNumber: stringArg(),
                businessDocuments: list(stringArg()),
                address: stringArg(),
                city: stringArg(),
                province: stringArg(),
                zipCode: stringArg(),
            },
            async resolve(_, args, ctx) {
                // Check if email already exists
                const existing = await prisma.supplierProfile.findUnique({
                    where: { email: args.email }
                });
                if (existing) {
                    throw new Error('A supplier registration with this email already exists');
                }
                // Create the supplier profile
                const profile = await prisma.supplierProfile.create({
                    data: {
                        companyName: args.companyName,
                        contactPerson: args.contactPerson,
                        email: args.email,
                        phone: args.phone,
                        productCategories: args.productCategories,
                        taxId: args.taxId ?? null,
                        businessRegNumber: args.businessRegNumber ?? null,
                        businessDocuments: args.businessDocuments ?? [],
                        address: args.address ?? null,
                        city: args.city ?? null,
                        province: args.province ?? null,
                        zipCode: args.zipCode ?? null,
                    }
                });
                // Notify admins of new registration
                const adminUsers = await prisma.user.findMany({
                    where: { role: 'ADMIN' }
                });
                if (adminUsers.length > 0) {
                    await Promise.all(adminUsers.map(admin => sendEmail({
                        to: admin.email,
                        from: 'noreply@yourdomain.com',
                        subject: 'New Supplier Registration',
                        html: `
                  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <h2>New Supplier Registration</h2>
                    <p>A new supplier has registered and is pending approval:</p>
                    <ul>
                      <li><strong>Company:</strong> ${args.companyName}</li>
                      <li><strong>Contact:</strong> ${args.contactPerson}</li>
                      <li><strong>Email:</strong> ${args.email}</li>
                    </ul>
                    <p>Please review the registration in the admin panel.</p>
                  </div>
                `,
                    })));
                }
                return profile;
            },
        });
        // Approve supplier - creates User record
        t.field('approveSupplier', {
            type: 'SupplierProfile',
            args: {
                supplierId: nonNull(intArg()),
                orgId: nonNull(intArg()),
            },
            async resolve(_, { supplierId, orgId }, ctx) {
                requireAuth(ctx);
                const admin = ctx.user;
                if (admin?.role !== 'ADMIN') {
                    throw new Error('Only ADMIN can approve suppliers');
                }
                const profile = await prisma.supplierProfile.findUnique({
                    where: { id: supplierId }
                });
                if (!profile) {
                    throw new Error('Supplier profile not found');
                }
                if (profile.status === 'APPROVED') {
                    throw new Error('Supplier already approved');
                }
                // Generate random password
                const tempPassword = Math.random().toString(36).slice(-12);
                return await prisma.$transaction(async (tx) => {
                    // Create User record with SUPPLIER role
                    const user = await tx.user.create({
                        data: {
                            fullname: profile.contactPerson,
                            username: `supplier_${profile.id}`,
                            email: profile.email,
                            password: tempPassword, // Will be hashed by auth service
                            role: 'SUPPLIER',
                            orgId: orgId,
                            approvalStatus: 'APPROVED',
                        }
                    });
                    // Update profile with userId and status
                    await tx.supplierProfile.update({
                        where: { id: supplierId },
                        data: {
                            status: 'APPROVED',
                            userId: user.id,
                            reviewedBy: admin.userId,
                            reviewedAt: new Date(),
                        }
                    });
                    // Notify supplier of approval
                    await sendEmail({
                        to: profile.email,
                        from: 'noreply@yourdomain.com',
                        subject: 'Supplier Application Approved',
                        html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2>Application Approved!</h2>
                <p>Your supplier registration has been approved.</p>
                <p>You can now log in with your email and the following temporary password:</p>
                <p><strong>${tempPassword}</strong></p>
                <p>Please change your password after logging in.</p>
              </div>
            `,
                    });
                    return tx.supplierProfile.findUnique({ where: { id: supplierId } });
                });
            },
        });
        // Reject supplier
        t.field('rejectSupplier', {
            type: 'SupplierProfile',
            args: {
                supplierId: nonNull(intArg()),
                reason: stringArg(),
            },
            async resolve(_, { supplierId, reason }, ctx) {
                requireAuth(ctx);
                const admin = ctx.user;
                if (admin?.role !== 'ADMIN') {
                    throw new Error('Only ADMIN can reject suppliers');
                }
                const profile = await prisma.supplierProfile.findUnique({
                    where: { id: supplierId }
                });
                if (!profile) {
                    throw new Error('Supplier profile not found');
                }
                await prisma.supplierProfile.update({
                    where: { id: supplierId },
                    data: {
                        status: 'REJECTED',
                        rejectionReason: reason ?? null,
                        reviewedBy: admin.userId,
                        reviewedAt: new Date(),
                    }
                });
                // Notify supplier of rejection
                if (profile.email) {
                    await sendEmail({
                        to: profile.email,
                        from: 'noreply@yourdomain.com',
                        subject: 'Supplier Application Update',
                        html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2>Application Status Update</h2>
                <p>Your supplier registration has been reviewed.</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                <p>You may re-apply or contact support for more information.</p>
              </div>
            `,
                    });
                }
                return prisma.supplierProfile.findUnique({ where: { id: supplierId } });
            },
        });
        // Called when supplier opens the portal — marks as acknowledged
        t.field('supplierAcknowledgeOrder', {
            type: 'SupplierOrder',
            args: {
                token: nonNull(stringArg()),
            },
            async resolve(_, { token }) {
                const order = await prisma.supplierOrder.findUnique({ where: { supplierToken: token } });
                if (!order)
                    throw new Error('Invalid token');
                if (new Date() > order.tokenExpiresAt)
                    throw new Error('Token expired');
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
                if (!order)
                    throw new Error('Invalid token');
                if (new Date() > order.tokenExpiresAt)
                    throw new Error('Token expired');
                if (order.status === 'delivered' || order.status === 'cancelled') {
                    throw new Error('Order already finalised');
                }
                const newStatus = action === 'send' ? 'sent' : 'cancelled';
                // Update each order item with supplier's response
                if (action === 'send') {
                    await Promise.all(items.map((inp) => prisma.supplierOrderItem.update({
                        where: { id: inp.orderItemId },
                        data: {
                            deliveredQty: inp.deliveredQty,
                            expiryStartDate: inp.expiryStartDate,
                            expiryEndDate: inp.expiryEndDate,
                            exactExpiryDate: inp.exactExpiryDate,
                        },
                    })));
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
                    ${updatedOrder.items.map(i => `<li>${i.item.name}: ${i.deliveredQty} units</li>`).join('')}
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
        t.field('requestSupplierWithdrawal', {
            type: 'Withdrawal',
            args: {
                amount: nonNull(floatArg()),
                payoutMethodId: nonNull(intArg()),
            },
            async resolve(_, { amount, payoutMethodId }, ctx) {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                const wallet = await prisma.wallet.findFirst({ where: { orgId } });
                if (!wallet)
                    throw new Error('Wallet not found');
                const payoutMethod = await prisma.payoutMethod.findFirst({ where: { id: payoutMethodId, orgId, deletedAt: null } });
                if (!payoutMethod)
                    throw new Error('Payout method not found');
                if (amount <= 0)
                    throw new Error('Amount must be greater than zero');
                if (amount > wallet.balance - wallet.heldBalance)
                    throw new Error('Insufficient available balance');
                return prisma.withdrawal.create({
                    data: {
                        walletId: wallet.id,
                        payoutMethodId: payoutMethod.id,
                        amount,
                        status: 'PENDING',
                        requestedById: Number(ctx.user?.userId ?? 0),
                    },
                    include: { payoutMethod: true },
                });
            },
        });
        t.field('createSupplierPayoutMethod', {
            type: 'PayoutMethod',
            args: {
                type: nonNull(arg({ type: 'PayoutMethodType' })),
                accountName: nonNull(stringArg()),
                maskedAccountNumber: nonNull(stringArg()),
                bankName: stringArg(),
                isDefault: booleanArg(),
            },
            async resolve(_, { type, accountName, maskedAccountNumber, bankName, isDefault }, ctx) {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                return prisma.payoutMethod.create({
                    data: {
                        orgId,
                        type,
                        accountName,
                        maskedAccountNumber,
                        bankName: bankName ?? null,
                        isDefault: isDefault ?? false,
                    },
                });
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
                if (!order)
                    throw new Error('Order not found');
                if (order.status !== 'sent')
                    throw new Error('Order is not in sent status');
                await prisma.$transaction(async (tx) => {
                    for (const inp of items) {
                        const orderItem = order.items.find((oi) => oi.id === inp.orderItemId);
                        if (!orderItem)
                            continue;
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
