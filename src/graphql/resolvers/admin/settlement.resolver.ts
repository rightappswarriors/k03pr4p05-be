import { arg, extendType, intArg, nonNull, nullable, objectType, stringArg } from 'nexus';
import { requireAdminPermission } from '../../../lib/adminGovernance.js';

export const AdminPurchaseOrderSettlement = objectType({ name: 'AdminPurchaseOrderSettlement', definition(t) {
  t.nonNull.string('id'); t.nonNull.string('purchaseOrderId'); t.nonNull.string('paymentTransactionId'); t.nonNull.string('poNumber'); t.nonNull.string('supplierName');
  t.nonNull.float('grossAmount'); t.nonNull.float('platformFee'); t.nonNull.float('supplierNet'); t.nonNull.field('environment', { type: 'Environment' }); t.nonNull.dateTime('settledAt');
  t.nullable.dateTime('walletPostedAt'); t.nullable.int('walletLedgerEntryId'); t.nonNull.string('postingStatus'); t.nullable.float('balanceAfter');
} });
export const AdminPurchaseOrderSettlementPage = objectType({ name: 'AdminPurchaseOrderSettlementPage', definition(t) { t.nonNull.list.nonNull.field('items', { type: 'AdminPurchaseOrderSettlement' }); t.nonNull.int('total'); t.nonNull.int('page'); t.nonNull.int('pageSize'); } });
export const AdminPurchaseOrderSettlementSummary = objectType({ name: 'AdminPurchaseOrderSettlementSummary', definition(t) { t.nonNull.float('totalGross'); t.nonNull.float('totalPlatformFees'); t.nonNull.float('totalSupplierNet'); t.nonNull.int('postedCount'); t.nonNull.int('pendingCount'); } });

const environmentDefault = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';
const postingStatus = (row: any) => row.walletPostedAt && row.walletLedgerEntryId ? 'POSTED' : row.walletPostedAt || row.walletLedgerEntryId ? 'NEEDS_REVIEW' : 'PENDING';
const baseWhere = (a: any) => ({ environment: a.environment ?? environmentDefault, ...(a.supplierOrgId ? { supplierOrgId: a.supplierOrgId } : {}), ...(a.dateFrom || a.dateTo ? { settledAt: { ...(a.dateFrom ? { gte: a.dateFrom } : {}), ...(a.dateTo ? { lte: a.dateTo } : {}) } } : {}) });
const mapRows = async (ctx: any, settlements: any[]) => {
  const poIds = settlements.map((s) => s.purchaseOrderId); const supplierIds = [...new Set(settlements.map((s) => s.supplierOrgId))]; const ledgerIds = settlements.flatMap((s) => s.walletLedgerEntryId ? [s.walletLedgerEntryId] : []);
  const [pos, suppliers, ledgers] = await Promise.all([ctx.prisma.purchaseOrder.findMany({ where: { id: { in: poIds } }, select: { id: true, poNumber: true } }), ctx.prisma.organization.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } }), ctx.prisma.walletLedgerEntry.findMany({ where: { id: { in: ledgerIds } }, select: { id: true, balanceAfter: true } })]);
  const poMap = new Map(pos.map((po: any) => [po.id, po.poNumber])); const supplierMap = new Map(suppliers.map((supplier: any) => [supplier.id, supplier.name])); const ledgerMap = new Map(ledgers.map((ledger: any) => [ledger.id, ledger.balanceAfter]));
  return settlements.map((s) => ({ ...s, poNumber: poMap.get(s.purchaseOrderId) ?? s.purchaseOrderId, supplierName: supplierMap.get(s.supplierOrgId) ?? `Supplier #${s.supplierOrgId}`, postingStatus: postingStatus(s), balanceAfter: s.walletLedgerEntryId ? ledgerMap.get(s.walletLedgerEntryId) ?? null : null }));
};

export const AdminSettlementQueries = extendType({ type: 'Query', definition(t) {
  t.nonNull.field('adminPurchaseOrderSettlements', { type: 'AdminPurchaseOrderSettlementPage', args: { environment: nullable(arg({ type: 'Environment' })), search: nullable(stringArg()), supplierOrgId: nullable(intArg()), postingStatus: nullable(stringArg()), dateFrom: nullable(arg({ type: 'DateTime' })), dateTo: nullable(arg({ type: 'DateTime' })), page: nullable(intArg()), pageSize: nullable(intArg()) }, async resolve(_r, a, ctx) {
    requireAdminPermission(ctx, 'COMMERCE_DASHBOARD_VIEW'); const page = Math.max(1, a.page ?? 1); const pageSize = Math.min(100, Math.max(1, a.pageSize ?? 25)); const where: any = baseWhere(a);
    if (a.search?.trim()) { const poIds = await ctx.prisma.purchaseOrder.findMany({ where: { poNumber: { contains: a.search.trim(), mode: 'insensitive' } }, select: { id: true } }); where.purchaseOrderId = { in: poIds.map((po: any) => po.id) }; }
    if (a.postingStatus === 'POSTED') where.AND = [{ walletPostedAt: { not: null } }, { walletLedgerEntryId: { not: null } }]; else if (a.postingStatus === 'PENDING') where.OR = [{ walletPostedAt: null }, { walletLedgerEntryId: null }];
    const [items, total] = await Promise.all([ctx.prisma.purchaseOrderSettlement.findMany({ where, orderBy: { settledAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), ctx.prisma.purchaseOrderSettlement.count({ where })]);
    return { items: await mapRows(ctx, items), total, page, pageSize };
  }});
  t.nonNull.field('adminSettlementSummary', { type: 'AdminPurchaseOrderSettlementSummary', args: { environment: nullable(arg({ type: 'Environment' })), dateFrom: nullable(arg({ type: 'DateTime' })), dateTo: nullable(arg({ type: 'DateTime' })) }, async resolve(_r, a, ctx) { requireAdminPermission(ctx, 'COMMERCE_DASHBOARD_VIEW'); const where = baseWhere(a); const [sum, postedCount, total] = await Promise.all([ctx.prisma.purchaseOrderSettlement.aggregate({ where, _sum: { grossAmount: true, platformFee: true, supplierNet: true } }), ctx.prisma.purchaseOrderSettlement.count({ where: { ...where, walletPostedAt: { not: null }, walletLedgerEntryId: { not: null } } }), ctx.prisma.purchaseOrderSettlement.count({ where })]); return { totalGross: sum._sum.grossAmount ?? 0, totalPlatformFees: sum._sum.platformFee ?? 0, totalSupplierNet: sum._sum.supplierNet ?? 0, postedCount, pendingCount: total - postedCount }; } });
} });
