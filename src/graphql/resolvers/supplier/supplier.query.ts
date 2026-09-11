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
import { arg, extendType, floatArg, intArg, nonNull, nullable, objectType, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';

const supplierFinanceEnvironment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';

export const SupplierTransactionPage = objectType({ name: 'SupplierTransactionPage', definition(t) { t.nonNull.list.nonNull.field('items', { type: 'SupplierTransaction' }); t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('limit'); t.nonNull.int('totalPages'); } });
export const SupplierTransaction = objectType({ name: 'SupplierTransaction', definition(t) { t.nonNull.int('id'); t.nonNull.string('label'); t.nonNull.string('direction'); t.nonNull.string('statusLabel'); t.nonNull.string('referenceType'); t.nullable.string('reference'); t.nonNull.float('amount'); t.nonNull.float('balanceAfter'); t.nonNull.string('sourceType'); t.nonNull.string('environment'); t.nonNull.dateTime('createdAt'); t.nullable.string('linkedPoNumber'); t.nullable.int('linkedWithdrawalId'); } });
export const SupplierFeeHistoryPage = objectType({ name: 'SupplierFeeHistoryPage', definition(t) { t.nonNull.list.nonNull.field('items', { type: 'SupplierFeeHistory' }); t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('limit'); t.nonNull.int('totalPages'); } });
export const SupplierFeeHistory = objectType({ name: 'SupplierFeeHistory', definition(t) { t.nonNull.string('settlementId'); t.nonNull.string('poId'); t.nullable.string('poNumber'); t.nonNull.float('grossAmount'); t.nonNull.float('platformFee'); t.nonNull.float('supplierNet'); t.nonNull.string('feeRuleId'); t.nonNull.string('feeRateType'); t.nullable.float('feeRate'); t.nonNull.string('environment'); t.nonNull.dateTime('settledAt'); t.nullable.dateTime('walletPostedAt'); t.nonNull.string('status'); } });

const financePage = (page?: number | null, limit?: number | null) => { const safePage = Math.max(1, page ?? 1); const safeLimit = Math.min(100, Math.max(1, limit ?? 20)); return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit }; };
const transactionPresentation = (entry: any) => {
  const ref = entry.referenceId ?? '';
  if (ref.startsWith('withdrawal-payout:')) return { label: 'Payout completed', statusLabel: 'Completed', referenceType: 'Withdrawal', linkedWithdrawalId: Number(ref.split(':')[1]) || null };
  if (ref.startsWith('withdrawal-payout-failure:') || ref.startsWith('withdrawal-rejection:')) return { label: 'Withdrawal funds returned', statusLabel: 'Returned', referenceType: 'Withdrawal', linkedWithdrawalId: Number(ref.split(':')[1]) || null };
  if (ref.startsWith('withdrawal:')) return { label: 'Withdrawal reserved', statusLabel: 'Held', referenceType: 'Withdrawal', linkedWithdrawalId: Number(ref.split(':')[1]) || null };
  if (entry.sourceType === 'PURCHASE_ORDER_SETTLEMENT') return { label: 'Order settlement', statusLabel: 'Available', referenceType: 'Purchase order', linkedWithdrawalId: null };
  if (entry.sourceType === 'ESCROW_HOLD') return { label: 'Order funds held', statusLabel: 'Held', referenceType: 'Purchase order', linkedWithdrawalId: null };
  if (entry.sourceType === 'ESCROW_RELEASE') return { label: 'Order funds released', statusLabel: 'Released', referenceType: 'Purchase order', linkedWithdrawalId: null };
  if (entry.sourceType === 'PLATFORM_FEE') return { label: 'Platform fee', statusLabel: 'Completed', referenceType: 'Fee', linkedWithdrawalId: null };
  return { label: entry.sourceType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()), statusLabel: entry.status === 'AVAILABLE' ? 'Available' : entry.status === 'RELEASED' ? 'Released' : entry.status, referenceType: 'Wallet', linkedWithdrawalId: null };
};

export const SupplierQuery = extendType({
  type: 'Query',
  definition(t) {
    // Query pending supplier registrations (admin only)
    t.list.field('pendingSuppliers', {
      type: 'SupplierProfile',
      async resolve(_, __, ctx) {
        requireAuth(ctx)
        const user = ctx.user
        if (user?.role !== 'ADMIN') {
          throw new Error('Only ADMIN can view pending suppliers')
        }
        return ctx.prisma.supplierProfile.findMany({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' }
        })
      },
    })

    // Get current supplier's own profile
    t.field('mySupplierProfile', {
      type: 'SupplierProfile',
      async resolve(_, __, ctx) {
        requireAuth(ctx)
        PAGE_PERMISSIONS.verification.view(ctx)
        const profile = await ctx.prisma.supplierProfile.findUnique({
          where: { userId: ctx.user?.userId }
        })
        if (!profile) {
          throw new Error('Supplier profile not found')
        }
        return profile
      },
    })

    // Get current customer's own profile
    t.field('myCustomerProfile', {
      type: 'CustomerProfile',
      async resolve(_, __, ctx) {
        requireAuth(ctx)
        const profile = await ctx.prisma.customerProfile.findUnique({
          where: { userId: ctx.user?.userId }
        })
        if (!profile) {
          throw new Error('Customer profile not found')
        }
        return profile
      },
    })

    t.field('getSupplierOrder', {
      type: 'SupplierOrder',
      args: { token: nonNull(stringArg()) },
      async resolve(_, { token }, ctx) {
        const order = await ctx.prisma.supplierOrder.findUnique({
          where: { supplierToken: token },
          include: { items: { include: { item: true } } },
        });
        if (!order) throw new Error('Invalid or expired link');
        if (new Date() > order.tokenExpiresAt) throw new Error('This link has expired');
        return order;
      },
    });

    t.field('supplierWalletSummary', {
      type: 'Wallet',
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        PAGE_PERMISSIONS.supplierWallet.view(ctx);
        const orgId = Number(ctx.user?.orgId);
        const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId, environment: supplierFinanceEnvironment } });
        if (!wallet) throw new Error('Wallet not found');
        return wallet;
      },
    });

    t.list.field('supplierFinanceTransactions', {
      type: 'WalletLedgerEntry',
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        PAGE_PERMISSIONS.supplierTransactions.view(ctx);
        const orgId = Number(ctx.user?.orgId);
        const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId, environment: supplierFinanceEnvironment } });
        if (!wallet) return [];
        return ctx.prisma.walletLedgerEntry.findMany({
          where: { walletId: wallet.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
    });

    t.nonNull.field('supplierTransactionPage', {
      type: 'SupplierTransactionPage',
      args: { page: nullable(intArg()), limit: nullable(intArg()), search: nullable(stringArg()), sourceType: nullable(stringArg()), status: nullable(stringArg()), from: nullable(arg({ type: 'DateTime' })), to: nullable(arg({ type: 'DateTime' })) },
      async resolve(_, args, ctx) {
        requireAuth(ctx); PAGE_PERMISSIONS.supplierTransactions.view(ctx); const orgId = Number(ctx.user?.orgId); const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId, environment: supplierFinanceEnvironment } }); const { page, limit, skip } = financePage(args.page, args.limit); if (!wallet) return { items: [], total: 0, page, limit, totalPages: 0 };
        const where: any = { walletId: wallet.id, ...(args.sourceType ? { sourceType: args.sourceType } : {}), ...(args.status ? { status: args.status } : {}), ...(args.from || args.to ? { createdAt: { ...(args.from ? { gte: args.from } : {}), ...(args.to ? { lte: args.to } : {}) } } : {}), ...(args.search?.trim() ? { referenceId: { contains: args.search.trim(), mode: 'insensitive' } } : {}) };
        const [entries, total] = await Promise.all([ctx.prisma.walletLedgerEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }), ctx.prisma.walletLedgerEntry.count({ where })]);
        const poIds = entries.filter((entry: any) => entry.sourceType === 'PURCHASE_ORDER_SETTLEMENT').map((entry: any) => entry.referenceId).filter(Boolean); const orders = poIds.length ? await ctx.prisma.purchaseOrder.findMany({ where: { id: { in: poIds } }, select: { id: true, poNumber: true } }) : []; const poById = new Map(orders.map((order: any) => [order.id, order.poNumber]));
        return { items: entries.map((entry: any) => { const p = transactionPresentation(entry); return { id: entry.id, ...p, direction: entry.amount >= 0 ? 'CREDIT' : 'DEBIT', reference: entry.referenceId, amount: entry.amount, balanceAfter: entry.balanceAfter, sourceType: entry.sourceType, environment: entry.environment, createdAt: entry.createdAt, linkedPoNumber: poById.get(entry.referenceId) ?? null }; }), total, page, limit, totalPages: Math.ceil(total / limit) };
      },
    });

    t.list.field('supplierFinanceWithdrawals', {
      type: 'Withdrawal',
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        PAGE_PERMISSIONS.supplierWithdrawals.view(ctx);
        const orgId = Number(ctx.user?.orgId);
        const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId, environment: supplierFinanceEnvironment } });
        if (!wallet) return [];
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
        PAGE_PERMISSIONS.supplierPayoutMethods.view(ctx);
        const orgId = Number(ctx.user?.orgId);
        return ctx.prisma.payoutMethod.findMany({ where: { orgId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      },
    });

    t.list.field('supplierFinanceFeeHistory', {
      type: 'WalletLedgerEntry',
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        PAGE_PERMISSIONS.supplierFeeHistory.view(ctx);
        const orgId = Number(ctx.user?.orgId);
        const wallet = await ctx.prisma.wallet.findFirst({ where: { orgId, environment: supplierFinanceEnvironment } });
        if (!wallet) return [];
        return ctx.prisma.walletLedgerEntry.findMany({
          where: { walletId: wallet.id, sourceType: { in: ['PLATFORM_FEE', 'SUBSCRIPTION_FEE'] } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      },
    });

    t.nonNull.field('supplierFeeHistoryPage', {
      type: 'SupplierFeeHistoryPage',
      args: { page: nullable(intArg()), limit: nullable(intArg()), environment: nullable(arg({ type: 'Environment' })), from: nullable(arg({ type: 'DateTime' })), to: nullable(arg({ type: 'DateTime' })) },
      async resolve(_, args, ctx) {
        requireAuth(ctx); PAGE_PERMISSIONS.supplierFeeHistory.view(ctx); const orgId = Number(ctx.user?.orgId); const { page, limit, skip } = financePage(args.page, args.limit); const where: any = { supplierOrgId: orgId, ...(args.environment ? { environment: args.environment } : {}), ...(args.from || args.to ? { settledAt: { ...(args.from ? { gte: args.from } : {}), ...(args.to ? { lte: args.to } : {}) } } : {}) };
        const [settlements, total] = await Promise.all([ctx.prisma.purchaseOrderSettlement.findMany({ where, orderBy: { settledAt: 'desc' }, skip, take: limit }), ctx.prisma.purchaseOrderSettlement.count({ where })]); const orders = settlements.length ? await ctx.prisma.purchaseOrder.findMany({ where: { id: { in: settlements.map((settlement: any) => settlement.purchaseOrderId) } }, select: { id: true, poNumber: true } }) : []; const poById = new Map(orders.map((order: any) => [order.id, order.poNumber]));
        return { items: settlements.map((settlement: any) => { const snapshot: any = settlement.feeSnapshot ?? {}; return { settlementId: settlement.id, poId: settlement.purchaseOrderId, poNumber: poById.get(settlement.purchaseOrderId) ?? null, grossAmount: settlement.grossAmount, platformFee: settlement.platformFee, supplierNet: settlement.supplierNet, feeRuleId: settlement.feeRuleId, feeRateType: snapshot.rateType ?? 'SNAPSHOT', feeRate: typeof snapshot.rate === 'number' ? snapshot.rate : null, environment: settlement.environment, settledAt: settlement.settledAt, walletPostedAt: settlement.walletPostedAt, status: settlement.status }; }), total, page, limit, totalPages: Math.ceil(total / limit) };
      },
    });
  },
});
