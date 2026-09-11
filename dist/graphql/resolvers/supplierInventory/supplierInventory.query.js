import { extendType, nonNull, stringArg, intArg, nullable, arg } from 'nexus';
//mport { requireOrgRole } from '../../auth/rbac'
import * as inventoryService from '../../../services/supplierInventory.service.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import { requireSupplierItemScope, requireSupplierOrganizationScope } from '../../../lib/supplierScope.js';
const pageWindow = (page, limit) => {
    const safePage = Math.max(1, page ?? 1);
    const safeLimit = Math.min(100, Math.max(1, limit ?? 20));
    return { safePage, safeLimit };
};
const batchStatus = (batch) => {
    if (batch.status === 'DEPLETED' || batch.status === 'DAMAGED')
        return batch.status;
    if (batch.expiryDate && batch.expiryDate.getTime() < Date.now())
        return 'EXPIRED';
    if (batch.expiryDate && batch.expiryDate.getTime() <= Date.now() + 30 * 86400000)
        return 'EXPIRING_SOON';
    return 'ACTIVE';
};
export const SupplierInventoryQuery = extendType({
    type: 'Query',
    definition(t) {
        t.field('supplierInventoryDashboard', {
            type: 'SupplierInventoryDashboard',
            resolve: async (_, __, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                const orgId = Number(ctx.user?.orgId);
                if (!orgId)
                    throw new Error('Authentication required');
                return inventoryService.getSupplierInventoryDashboard(ctx.prisma, orgId);
            },
        });
        // Powers InventoryTable/InventoryCards — one row per SupplierItem with
        // its live rollup counters (already on the model) plus computed valuation.
        t.nonNull.list.nonNull.field('supplierInventoryList', {
            type: 'SupplierItem',
            args: {
                warehouseId: nullable(stringArg()),
            },
            resolve: async (_, { warehouseId }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                const orgId = Number(ctx.user?.orgId);
                if (!orgId)
                    throw new Error('Authentication required');
                const catalog = await ctx.prisma.supplierCatalog.findUnique({ where: { organizationId: orgId } });
                if (!catalog)
                    return [];
                return ctx.prisma.supplierItem.findMany({
                    where: {
                        catalogId: catalog.id,
                        deletedAt: null,
                        ...(warehouseId
                            ? {
                                OR: [
                                    { supplierStockBatches: { some: { warehouseId, deletedAt: null } } },
                                ]
                            }
                            : {}),
                    },
                    include: { priceTiers: true },
                    orderBy: { updatedAt: 'desc' },
                });
            },
        });
        t.field('supplierInventoryValuation', {
            type: 'InventoryValuation',
            args: { supplierItemId: nonNull(stringArg()) },
            resolve: async (_, { supplierItemId }, ctx) => { PAGE_PERMISSIONS.supplierInventory.view(ctx); await requireSupplierItemScope(ctx, supplierItemId); return inventoryService.getInventoryValuation(ctx.prisma, supplierItemId); },
        });
        t.nonNull.list.nonNull.field('supplierStockBatches', {
            type: 'SupplierStockBatch',
            args: { supplierItemId: nonNull(stringArg()), includeDepleted: nullable(arg({ type: 'Boolean' })) },
            resolve: async (_, { supplierItemId, includeDepleted }, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                await requireSupplierItemScope(ctx, supplierItemId);
                return ctx.prisma.supplierStockBatch.findMany({
                    where: {
                        supplierItemId,
                        deletedAt: null,
                        ...(includeDepleted ? {} : { status: { not: 'DEPLETED' } }),
                    },
                    orderBy: { receivedAt: 'asc' },
                });
            },
        });
        t.nonNull.list.nonNull.field('supplierInventoryMovements', {
            type: 'SupplierInventoryMovement',
            args: { supplierItemId: nonNull(stringArg()), page: intArg({ default: 1 }), pageSize: intArg({ default: 30 }) },
            resolve: async (_, { supplierItemId, page, pageSize }, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                await requireSupplierItemScope(ctx, supplierItemId);
                return ctx.prisma.supplierInventoryMovement.findMany({
                    where: { supplierItemId, deletedAt: null },
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                });
            },
        });
        t.nonNull.field('supplierInventoryMovementPage', {
            type: 'SupplierInventoryMovementPage',
            args: { search: nullable(stringArg()), type: nullable(stringArg()), page: intArg({ default: 1 }), limit: intArg({ default: 20 }) },
            resolve: async (_, { search, type, page, limit }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                const orgId = Number(ctx.user?.orgId);
                if (!orgId)
                    throw new Error('Authentication required');
                const safePage = Math.max(1, page ?? 1);
                const safeLimit = Math.min(100, Math.max(1, limit ?? 20));
                const where = {
                    deletedAt: null,
                    supplierItem: { catalog: { organizationId: orgId } },
                    ...(type ? { type } : {}),
                    ...(search?.trim() ? { OR: [
                            { referenceId: { contains: search.trim(), mode: 'insensitive' } },
                            { supplierItem: { name: { contains: search.trim(), mode: 'insensitive' } } },
                            { supplierItem: { sku: { contains: search.trim(), mode: 'insensitive' } } },
                        ] } : {}),
                };
                const [total, items] = await Promise.all([
                    ctx.prisma.supplierInventoryMovement.count({ where }),
                    ctx.prisma.supplierInventoryMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (safePage - 1) * safeLimit, take: safeLimit, include: { supplierItem: { select: { id: true, name: true, sku: true, unit: true } } } }),
                ]);
                return { items, total, page: safePage, limit: safeLimit, totalPages: Math.max(1, Math.ceil(total / safeLimit)) };
            },
        });
        t.nonNull.field('supplierInventoryBatchPage', {
            type: 'SupplierInventoryBatchPage',
            args: { search: nullable(stringArg()), status: nullable(stringArg()), page: intArg({ default: 1 }), limit: intArg({ default: 20 }) },
            resolve: async (_, { search, status, page, limit }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                const orgId = Number(ctx.user?.orgId);
                if (!orgId)
                    throw new Error('Authentication required');
                const { safePage, safeLimit } = pageWindow(page, limit);
                const where = { deletedAt: null, supplierItem: { catalog: { organizationId: orgId } }, ...(search?.trim() ? { OR: [{ batchNumber: { contains: search.trim(), mode: 'insensitive' } }, { supplierItem: { name: { contains: search.trim(), mode: 'insensitive' } } }, { supplierItem: { sku: { contains: search.trim(), mode: 'insensitive' } } }] } : {}) };
                const batches = await ctx.prisma.supplierStockBatch.findMany({ where, orderBy: { receivedAt: 'desc' }, include: { supplierItem: { select: { id: true, name: true, sku: true, unit: true } } } });
                const mapped = batches.map((batch) => ({ ...batch, itemName: batch.supplierItem.name, sku: batch.supplierItem.sku, unit: batch.supplierItem.unit, inventoryValue: batch.remainingQty * batch.unitCost, status: batchStatus(batch) }));
                const filtered = status && status !== 'ALL' ? mapped.filter((batch) => batch.status === status) : mapped;
                return { items: filtered.slice((safePage - 1) * safeLimit, safePage * safeLimit), total: filtered.length, page: safePage, limit: safeLimit, totalPages: Math.max(1, Math.ceil(filtered.length / safeLimit)) };
            },
        });
        t.nonNull.field('supplierInventoryAlertPage', {
            type: 'SupplierInventoryAlertPage',
            args: { search: nullable(stringArg()), filter: nullable(stringArg()), page: intArg({ default: 1 }), limit: intArg({ default: 20 }) },
            resolve: async (_, { search, filter, page, limit }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                const orgId = Number(ctx.user?.orgId);
                if (!orgId)
                    throw new Error('Authentication required');
                const { safePage, safeLimit } = pageWindow(page, limit);
                const items = await ctx.prisma.supplierItem.findMany({ where: { catalog: { organizationId: orgId }, deletedAt: null, ...(search?.trim() ? { OR: [{ name: { contains: search.trim(), mode: 'insensitive' } }, { sku: { contains: search.trim(), mode: 'insensitive' } }] } : {}) }, select: { id: true, name: true, sku: true, availableQty: true, reorderLevel: true, reorderQty: true, supplierStockBatches: { where: { deletedAt: null, remainingQty: { gt: 0 } }, select: { id: true, expiryDate: true, status: true } } } });
                const now = Date.now();
                const soon = now + 30 * 86400000;
                const alerts = [];
                for (const item of items) {
                    const base = { supplierItemId: item.id, itemName: item.name, sku: item.sku, availableQty: item.availableQty, reorderLevel: item.reorderLevel, reorderQty: item.reorderQty, batchId: null, expiryDate: null };
                    if (item.availableQty <= 0)
                        alerts.push({ ...base, id: `out:${item.id}`, kind: 'OUT_OF_STOCK', severity: 'CRITICAL', title: 'Out of stock', message: `${item.name} has no available stock.` });
                    else if (item.reorderLevel !== null && item.availableQty <= item.reorderLevel)
                        alerts.push({ ...base, id: `low:${item.id}`, kind: 'LOW_STOCK', severity: 'WARNING', title: 'Low stock', message: item.reorderQty ? `Reorder ${item.reorderQty} ${item.name} units.` : `${item.name} is at or below its reorder level.` });
                    for (const batch of item.supplierStockBatches) {
                        if (batch.expiryDate && batch.expiryDate.getTime() < now)
                            alerts.push({ ...base, id: `expired:${batch.id}`, kind: 'EXPIRED', severity: 'CRITICAL', title: 'Batch expired', message: `${item.name} batch has expired.`, batchId: batch.id, expiryDate: batch.expiryDate });
                        else if (batch.expiryDate && batch.expiryDate.getTime() <= soon)
                            alerts.push({ ...base, id: `expiring:${batch.id}`, kind: 'EXPIRING_SOON', severity: batch.expiryDate.getTime() <= now + 7 * 86400000 ? 'CRITICAL' : 'WARNING', title: 'Batch expiring soon', message: `${item.name} has stock expiring soon.`, batchId: batch.id, expiryDate: batch.expiryDate });
                    }
                }
                const filtered = filter && filter !== 'ALL' ? alerts.filter((alert) => alert.kind === filter || alert.severity === filter) : alerts;
                return { items: filtered.slice((safePage - 1) * safeLimit, safePage * safeLimit), total: filtered.length, page: safePage, limit: safeLimit, totalPages: Math.max(1, Math.ceil(filtered.length / safeLimit)) };
            },
        });
        t.nonNull.list.nonNull.field('supplierItemCostHistoryList', {
            type: 'SupplierItemCostHistory',
            args: { supplierItemId: nonNull(stringArg()) },
            resolve: async (_, { supplierItemId }, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                await requireSupplierItemScope(ctx, supplierItemId);
                return ctx.prisma.supplierItemCostHistory.findMany({
                    where: { supplierItemId },
                    orderBy: { effectiveAt: 'desc' },
                });
            },
        });
        t.field('supplierInventoryForecast', {
            type: 'InventoryForecast',
            args: { supplierItemId: nonNull(stringArg()), trailingDays: intArg({ default: 30 }) },
            resolve: async (_, { supplierItemId, trailingDays }, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                await requireSupplierItemScope(ctx, supplierItemId);
                return inventoryService.getInventoryForecast(ctx.prisma, supplierItemId, trailingDays ?? 30);
            },
        });
        t.field('supplierInventoryAnalytics', {
            type: 'InventoryAnalytics',
            args: { supplierItemId: nonNull(stringArg()) },
            resolve: async (_, { supplierItemId }, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                await requireSupplierItemScope(ctx, supplierItemId);
                return inventoryService.getInventoryAnalytics(ctx.prisma, supplierItemId);
            },
        });
        t.nonNull.list.nonNull.field('supplierWarehouses', {
            type: 'SupplierWarehouse',
            args: { orgId: nonNull(intArg()) },
            resolve: (_, { orgId }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                requireSupplierOrganizationScope(ctx, orgId);
                return ctx.prisma.supplierWarehouse.findMany({ where: { organizationId: Number(ctx.user?.orgId), deletedAt: null }, orderBy: { name: 'asc' } });
            }
        });
        t.nonNull.list.nonNull.field('supplierIncomingStockList', {
            type: 'SupplierIncomingStock',
            args: { supplierItemId: nonNull(stringArg()) },
            resolve: async (_, { supplierItemId }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.supplierInventory.view(ctx);
                await requireSupplierItemScope(ctx, supplierItemId);
                return ctx.prisma.supplierIncomingStock.findMany({
                    where: { supplierItemId, deletedAt: null },
                    orderBy: { expectedDate: 'asc' },
                });
            }
        });
    },
});
