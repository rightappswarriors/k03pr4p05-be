import { extendType, nonNull, stringArg, intArg, nullable, arg } from 'nexus';
//mport { requireOrgRole } from '../../auth/rbac'
import * as inventoryService from '../../../services/supplierInventory.service.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
export const SupplierInventoryQuery = extendType({
    type: 'Query',
    definition(t) {
        t.field('supplierInventoryDashboard', {
            type: 'SupplierInventoryDashboard',
            args: { orgId: nonNull(intArg()) },
            resolve: async (_, { orgId }, ctx) => {
                //await requireOrgRole(ctx, orgId, ['ORG_OWNER', 'ORG_MANAGER', 'ORG_STAFF'], 'SUPPLIER')
                requireAuth(ctx);
                return inventoryService.getSupplierInventoryDashboard(ctx.prisma, orgId);
            },
        });
        // Powers InventoryTable/InventoryCards — one row per SupplierItem with
        // its live rollup counters (already on the model) plus computed valuation.
        t.nonNull.list.nonNull.field('supplierInventoryList', {
            type: 'SupplierItem',
            args: {
                orgId: nonNull(intArg()),
                warehouseId: nullable(stringArg()),
            },
            resolve: async (_, { orgId, warehouseId }, ctx) => {
                // await requireOrgRole(ctx, orgId, ['ORG_OWNER', 'ORG_MANAGER', 'ORG_STAFF'], 'SUPPLIER')
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
            resolve: (_, { supplierItemId }, ctx) => inventoryService.getInventoryValuation(ctx.prisma, supplierItemId),
        });
        t.nonNull.list.nonNull.field('supplierStockBatches', {
            type: 'SupplierStockBatch',
            args: { supplierItemId: nonNull(stringArg()), includeDepleted: nullable(arg({ type: 'Boolean' })) },
            resolve: (_, { supplierItemId, includeDepleted }, ctx) => ctx.prisma.supplierStockBatch.findMany({
                where: {
                    supplierItemId,
                    deletedAt: null,
                    ...(includeDepleted ? {} : { status: { not: 'DEPLETED' } }),
                },
                orderBy: { receivedAt: 'asc' },
            }),
        });
        t.nonNull.list.nonNull.field('supplierInventoryMovements', {
            type: 'SupplierInventoryMovement',
            args: { supplierItemId: nonNull(stringArg()), page: intArg({ default: 1 }), pageSize: intArg({ default: 30 }) },
            resolve: (_, { supplierItemId, page, pageSize }, ctx) => ctx.prisma.supplierInventoryMovement.findMany({
                where: { supplierItemId, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        });
        t.nonNull.list.nonNull.field('supplierItemCostHistoryList', {
            type: 'SupplierItemCostHistory',
            args: { supplierItemId: nonNull(stringArg()) },
            resolve: (_, { supplierItemId }, ctx) => ctx.prisma.supplierItemCostHistory.findMany({
                where: { supplierItemId },
                orderBy: { effectiveAt: 'desc' },
            }),
        });
        t.field('supplierInventoryForecast', {
            type: 'InventoryForecast',
            args: { supplierItemId: nonNull(stringArg()), trailingDays: intArg({ default: 30 }) },
            resolve: (_, { supplierItemId, trailingDays }, ctx) => inventoryService.getInventoryForecast(ctx.prisma, supplierItemId, trailingDays ?? 30),
        });
        t.field('supplierInventoryAnalytics', {
            type: 'InventoryAnalytics',
            args: { supplierItemId: nonNull(stringArg()) },
            resolve: (_, { supplierItemId }, ctx) => inventoryService.getInventoryAnalytics(ctx.prisma, supplierItemId),
        });
        t.nonNull.list.nonNull.field('supplierWarehouses', {
            type: 'SupplierWarehouse',
            args: { orgId: nonNull(intArg()) },
            resolve: (_, { orgId }, ctx) => {
                requireAuth(ctx);
                ctx.prisma.supplierWarehouse.findMany({ where: { organizationId: orgId, deletedAt: null }, orderBy: { name: 'asc' } });
            }
        });
        t.nonNull.list.nonNull.field('supplierIncomingStockList', {
            type: 'SupplierIncomingStock',
            args: { supplierItemId: nonNull(stringArg()) },
            resolve: (_, { supplierItemId }, ctx) => {
                requireAuth(ctx);
                ctx.prisma.supplierIncomingStock.findMany({
                    where: { supplierItemId, deletedAt: null },
                    orderBy: { expectedDate: 'asc' },
                });
            }
        });
    },
});
