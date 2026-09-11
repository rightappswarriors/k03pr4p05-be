import { extendType, nonNull, nullable, stringArg, intArg, floatArg, arg } from 'nexus';
//import { requireOrgRole } from '../../auth/rbac'
import * as inventoryService from '../../../services/supplierInventory.service.js';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import { requireSupplierItemScope, requireSupplierOrganizationScope } from '../../../lib/supplierScope.js';
async function requireSupplierOrgForItem(ctx, supplierItemId, roles) {
    requireAuth(ctx);
    await requireSupplierItemScope(ctx, supplierItemId);
}
export const SupplierInventoryMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('receiveStock', {
            type: 'SupplierStockBatch',
            args: {
                supplierItemId: nonNull(stringArg()),
                warehouseId: nullable(stringArg()),
                quantity: nonNull(floatArg()),
                unitCost: nonNull(floatArg()),
                batchNumber: nullable(stringArg()),
                expiryDate: nullable(arg({ type: 'DateTime' })),
            },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.create(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.receiveStock(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.field('logIncomingStock', {
            type: 'SupplierIncomingStock',
            args: {
                supplierItemId: nonNull(stringArg()),
                warehouseId: nullable(stringArg()),
                expectedQty: nonNull(floatArg()),
                expectedDate: nullable(arg({ type: 'DateTime' })),
                sourceLabel: nullable(stringArg()),
                notes: nullable(stringArg()),
            },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.create(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.logIncomingStock(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.boolean('cancelIncomingStock', {
            args: { incomingStockId: nonNull(stringArg()) },
            resolve: async (_, { incomingStockId }, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.delete(ctx);
                const incoming = await ctx.prisma.supplierIncomingStock.findUniqueOrThrow({ where: { id: incomingStockId } });
                await requireSupplierOrgForItem(ctx, incoming.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                await inventoryService.cancelIncomingStock(ctx.prisma, incomingStockId);
                return true;
            },
        });
        t.field('receiveIncomingStock', {
            type: 'SupplierStockBatch',
            args: {
                incomingStockId: nonNull(stringArg()),
                unitCost: nonNull(floatArg()),
                batchNumber: nullable(stringArg()),
                expiryDate: nullable(arg({ type: 'DateTime' })),
            },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.create(ctx);
                const incoming = await ctx.prisma.supplierIncomingStock.findUniqueOrThrow({ where: { id: args.incomingStockId } });
                await requireSupplierOrgForItem(ctx, incoming.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.receiveIncomingStock(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.field('reserveStock', {
            type: 'SupplierInventoryMovement',
            args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), referenceType: nullable(stringArg()), referenceId: nullable(stringArg()) },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.reserveStock(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.field('releaseReservation', {
            type: 'SupplierInventoryMovement',
            args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), reason: nullable(stringArg()) },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.releaseReservation(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.field('adjustStock', {
            type: 'SupplierInventoryMovement',
            args: { supplierItemId: nonNull(stringArg()), delta: nonNull(floatArg()), unitCost: nullable(floatArg()), warehouseId: nullable(stringArg()), reason: nonNull(stringArg()) },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.adjustStock(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.field('markDamagedStock', {
            type: 'SupplierInventoryMovement',
            args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), warehouseId: nullable(stringArg()), reason: nonNull(stringArg()) },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.markDamaged(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.field('markReturnedStock', {
            type: 'SupplierInventoryMovement',
            args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), reason: nullable(stringArg()) },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.markReturned(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.field('restockReturnedItem', {
            type: 'SupplierInventoryMovement',
            args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), unitCost: nonNull(floatArg()), warehouseId: nullable(stringArg()) },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.restockReturnedItem(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.nonNull.list.nonNull.field('transferStock', {
            type: 'SupplierStockBatch',
            args: { supplierItemId: nonNull(stringArg()), fromWarehouseId: nonNull(stringArg()), toWarehouseId: nonNull(stringArg()), quantity: nonNull(floatArg()), reason: nullable(stringArg()) },
            resolve: async (_, args, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER']);
                return inventoryService.transferStock(ctx.prisma, { ...args, createdById: ctx.userId });
            },
        });
        t.field('reconcileInventoryRollups', {
            type: 'InventoryReconcileResult',
            args: { supplierItemId: nonNull(stringArg()) },
            resolve: async (_, { supplierItemId }, ctx) => {
                PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                await requireSupplierOrgForItem(ctx, supplierItemId, ['ORG_OWNER']); // owner-only — this is a data-integrity tool, not routine ops
                return inventoryService.reconcileInventoryRollups(ctx.prisma, supplierItemId);
            },
        });
        t.field('upsertSupplierWarehouse', {
            type: 'SupplierWarehouse',
            args: {
                id: nullable(stringArg()),
                organizationId: nonNull(intArg()),
                name: nonNull(stringArg()),
                address: nullable(stringArg()),
                latitude: nullable(floatArg()),
                longitude: nullable(floatArg()),
                isDefault: nullable(arg({ type: 'Boolean' })),
            },
            resolve: async (_, { id, organizationId, ...data }, ctx) => {
                requireAuth(ctx);
                requireSupplierOrganizationScope(ctx, organizationId);
                if (id) {
                    PAGE_PERMISSIONS.supplierInventory.edit(ctx);
                    const warehouse = await ctx.prisma.supplierWarehouse.findFirst({ where: { id, organizationId }, select: { id: true } });
                    if (!warehouse)
                        throw new Error('Resource not found.');
                }
                else {
                    PAGE_PERMISSIONS.supplierInventory.create(ctx);
                }
                return id
                    ? ctx.prisma.supplierWarehouse.update({ where: { id }, data })
                    : ctx.prisma.supplierWarehouse.create({ data: { organizationId, ...data } });
            },
        });
    },
});
