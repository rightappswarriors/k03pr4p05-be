/*/ graphql/supplier/supplier.query.js
import { extendType, intArg, nonNull } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import * as supplierService from "../../../services/supplier.service.js";

export const SupplierQuery = extendType({
  type: "Query",
  definition(t) {
    // Get all suppliers
    t.list.field("getSuppliers", {
      type: "Supplier",
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        return await supplierService.getSuppliers();
      },
    });

    // Get supplier by ID
    t.field("getSupplierById", {
      type: "Supplier",
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER"]);
        return await supplierService.getSupplierById(id);
      },
    });
  },
});
*/
// rai-pos-backend/src/graphql/resolvers/supplier/supplier.query.ts
import { extendType, nonNull, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
export const SupplierQuery = extendType({
    type: 'Query',
    definition(t) {
        t.field('getSupplierOrder', {
            type: 'SupplierOrder',
            args: { token: nonNull(stringArg()) },
            async resolve(_, { token }, ctx) {
                const order = await ctx.prisma.supplierOrder.findUnique({
                    where: { supplierToken: token },
                    include: { items: { include: { item: true } } },
                });
                if (!order)
                    throw new Error('Invalid or expired link');
                if (new Date() > order.tokenExpiresAt)
                    throw new Error('This link has expired');
                return order;
            },
        });
        t.field('supplierWalletSummary', {
            type: 'Wallet',
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId } });
                if (!wallet)
                    throw new Error('Wallet not found');
                return wallet;
            },
        });
        t.list.field('supplierFinanceTransactions', {
            type: 'WalletLedgerEntry',
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId } });
                if (!wallet)
                    return [];
                return ctx.prisma.walletLedgerEntry.findMany({
                    where: { walletId: wallet.id },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                });
            },
        });
        t.list.field('supplierFinanceWithdrawals', {
            type: 'Withdrawal',
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId } });
                if (!wallet)
                    return [];
                return ctx.prisma.withdrawal.findMany({
                    where: { walletId: wallet.id },
                    orderBy: { requestedAt: 'desc' },
                    include: { payoutMethod: true },
                });
            },
        });
        t.list.field('supplierFinancePayoutMethods', {
            type: 'PayoutMethod',
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                return ctx.prisma.payoutMethod.findMany({ where: { orgId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
            },
        });
        t.list.field('supplierFinanceFeeHistory', {
            type: 'WalletLedgerEntry',
            async resolve(_, __, ctx) {
                requireAuth(ctx);
                const orgId = Number(ctx.user?.orgId);
                const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId } });
                if (!wallet)
                    return [];
                return ctx.prisma.walletLedgerEntry.findMany({
                    where: { walletId: wallet.id, sourceType: { in: ['PLATFORM_FEE', 'SUBSCRIPTION_FEE'] } },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                });
            },
        });
    },
});
