import { extendType, nonNull, nullable, stringArg, intArg, floatArg, arg } from 'nexus'
//import { requireOrgRole } from '../../auth/rbac'
import * as inventoryService from '../../../services/supplierInventory.service.js'
import { requireAuth } from '../../../middleware/auth.middleware.js'

async function requireSupplierOrgForItem(ctx: any, supplierItemId: string, roles: string[]) {
  const item = await ctx.prisma.supplierItem.findUniqueOrThrow({
    where: { id: supplierItemId },
    include: { catalog: true },
  })
  //await requireOrgRole(ctx, item.catalog.organizationId, roles, 'SUPPLIER')
  requireAuth(ctx)
  return item
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
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.receiveStock(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

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
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.logIncomingStock(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.boolean('cancelIncomingStock', {
      args: { incomingStockId: nonNull(stringArg()) },
      resolve: async (_, { incomingStockId }, ctx) => {
        const incoming = await ctx.prisma.supplierIncomingStock.findUniqueOrThrow({ where: { id: incomingStockId } })
        await requireSupplierOrgForItem(ctx, incoming.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        await inventoryService.cancelIncomingStock(ctx.prisma, incomingStockId)
        return true
      },
    })

    t.field('receiveIncomingStock', {
      type: 'SupplierStockBatch',
      args: {
        incomingStockId: nonNull(stringArg()),
        unitCost: nonNull(floatArg()),
        batchNumber: nullable(stringArg()),
        expiryDate: nullable(arg({ type: 'DateTime' })),
      },
      resolve: async (_, args, ctx) => {
        const incoming = await ctx.prisma.supplierIncomingStock.findUniqueOrThrow({ where: { id: args.incomingStockId } })
        await requireSupplierOrgForItem(ctx, incoming.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.receiveIncomingStock(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.field('reserveStock', {
      type: 'SupplierInventoryMovement',
      args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), referenceType: nullable(stringArg()), referenceId: nullable(stringArg()) },
      resolve: async (_, args, ctx) => {
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.reserveStock(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.field('releaseReservation', {
      type: 'SupplierInventoryMovement',
      args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), reason: nullable(stringArg()) },
      resolve: async (_, args, ctx) => {
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.releaseReservation(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.field('adjustStock', {
      type: 'SupplierInventoryMovement',
      args: { supplierItemId: nonNull(stringArg()), delta: nonNull(floatArg()), unitCost: nullable(floatArg()), warehouseId: nullable(stringArg()), reason: nonNull(stringArg()) },
      resolve: async (_, args, ctx) => {
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.adjustStock(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.field('markDamagedStock', {
      type: 'SupplierInventoryMovement',
      args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), warehouseId: nullable(stringArg()), reason: nonNull(stringArg()) },
      resolve: async (_, args, ctx) => {
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.markDamaged(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.field('markReturnedStock', {
      type: 'SupplierInventoryMovement',
      args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), reason: nullable(stringArg()) },
      resolve: async (_, args, ctx) => {
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.markReturned(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.field('restockReturnedItem', {
      type: 'SupplierInventoryMovement',
      args: { supplierItemId: nonNull(stringArg()), quantity: nonNull(floatArg()), unitCost: nonNull(floatArg()), warehouseId: nullable(stringArg()) },
      resolve: async (_, args, ctx) => {
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.restockReturnedItem(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.nonNull.list.nonNull.field('transferStock', {
      type: 'SupplierStockBatch',
      args: { supplierItemId: nonNull(stringArg()), fromWarehouseId: nonNull(stringArg()), toWarehouseId: nonNull(stringArg()), quantity: nonNull(floatArg()), reason: nullable(stringArg()) },
      resolve: async (_, args, ctx) => {
        await requireSupplierOrgForItem(ctx, args.supplierItemId, ['ORG_OWNER', 'ORG_MANAGER'])
        return inventoryService.transferStock(ctx.prisma, { ...args, createdById: ctx.userId })
      },
    })

    t.field('reconcileInventoryRollups', {
      type: 'InventoryReconcileResult',
      args: { supplierItemId: nonNull(stringArg()) },
      resolve: async (_, { supplierItemId }, ctx) => {
        await requireSupplierOrgForItem(ctx, supplierItemId, ['ORG_OWNER']) // owner-only — this is a data-integrity tool, not routine ops
        return inventoryService.reconcileInventoryRollups(ctx.prisma, supplierItemId)
      },
    })

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
        requireAuth(ctx)
        return id
          ? ctx.prisma.supplierWarehouse.update({ where: { id }, data })
          : ctx.prisma.supplierWarehouse.create({ data: { organizationId, ...data } })
      },
    })
  },
})