import { objectType, inputObjectType, enumType } from 'nexus';
export const PriceTier = objectType({
    name: 'PriceTier',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('minQty');
        t.nonNull.float('price');
    },
});
export const SupplierStockBatchStatus = enumType({
    name: 'SupplierStockBatchStatus',
    members: [
        'ACTIVE',
        'DEPLETED',
        'EXPIRED',
        'DAMAGED',
    ],
});
export const SupplierCatalog = objectType({
    name: 'SupplierCatalog',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('organizationId');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('organization', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.organization.findUniqueOrThrow({ where: { id: parent.organizationId } }),
        });
        t.nonNull.list.nonNull.field('items', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => ctx.prisma.supplierItem.findMany({
                where: { catalogId: parent.id, isActive: true },
                include: { priceTiers: true },
                orderBy: { name: 'asc' },
            }),
        });
    },
});
export const SupplierItem = objectType({
    name: 'SupplierItem',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('name');
        t.nullable.string('description');
        t.nullable.string('sku');
        t.nonNull.string('unit');
        t.nonNull.float('unitPrice');
        t.nonNull.boolean('isVatExempt');
        t.nonNull.float('vatRate');
        t.nullable.string('image');
        t.nullable.float('currentCost');
        t.nonNull.int('moq');
        t.nonNull.int('availableQty');
        t.nonNull.boolean('isActive');
        t.nonNull.float('averageRating', {
            resolve: async (parent, _, ctx) => {
                const aggregate = await ctx.prisma.supplierItemReview.aggregate({
                    where: { supplierItemId: parent.id, deletedAt: null },
                    _avg: { rating: true },
                });
                return Number((aggregate._avg.rating ?? 0).toFixed(2));
            },
        });
        t.nonNull.int('reviewCount', {
            resolve: (parent, _, ctx) => ctx.prisma.supplierItemReview.count({
                where: { supplierItemId: parent.id, deletedAt: null },
            }),
        });
        t.nonNull.list.nonNull.field('priceTiers', {
            type: 'PriceTier',
            resolve: (parent, _, ctx) => ctx.prisma.priceTier.findMany({
                where: { supplierItemId: parent.id },
                orderBy: { minQty: 'asc' },
            }),
        });
        t.nonNull.list.nonNull.field('reviews', {
            type: 'SupplierItemReview',
            resolve: (parent, _, ctx) => ctx.prisma.supplierItemReview.findMany({
                where: { supplierItemId: parent.id, deletedAt: null },
                include: { reviewer: true },
                orderBy: { createdAt: 'desc' },
            }),
        });
        t.nonNull.list.nonNull.field('priceHistory', {
            type: 'SupplierItemPriceHistory',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .priceHistory({
                    orderBy: {
                        effectiveAt: 'desc',
                    },
                });
            },
        });
        t.field('category', {
            type: 'SupplierItemCategory',
            resolve(parent, _, ctx) {
                if (!parent.categoryId)
                    return null;
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id, deletedAt: null, } })
                    .category();
            },
        });
        t.field('group', {
            type: 'SupplierItemGroup',
            resolve(parent, _, ctx) {
                if (!parent.groupId)
                    return null;
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id, deletedAt: null, } })
                    .group();
            },
        });
        t.nonNull.list.nonNull.field('scheduledPrices', {
            type: 'SupplierScheduledPrice',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({
                    where: {
                        id: parent.id,
                    },
                })
                    .scheduledPrices({
                    where: {
                        deletedAt: null,
                    },
                    orderBy: {
                        effectiveAt: 'desc',
                    },
                });
            },
        });
        t.nonNull.list.nonNull.field('costHistory', {
            type: 'SupplierItemCostHistory',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .costHistory({
                    orderBy: {
                        effectiveAt: 'desc',
                    },
                });
            },
        });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nonNull.float('reservedQty');
        t.nonNull.float('incomingQty');
        t.nonNull.float('damagedQty');
        t.nonNull.float('returnedQty');
        t.nullable.float('reorderLevel');
        t.nullable.float('reorderQty');
        t.nonNull.list.nonNull.field('supplierStockBatches', {
            type: 'SupplierStockBatch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .supplierStockBatches({
                    orderBy: {
                        receivedAt: 'desc',
                    },
                });
            },
        });
        t.nonNull.list.nonNull.field('supplierInventoryMovements', {
            type: 'SupplierInventoryMovement',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .supplierInventoryMovements({
                    orderBy: {
                        createdAt: 'desc',
                    },
                });
            },
        });
        t.nonNull.list.nonNull.field('supplierIncomingStock', {
            type: 'SupplierIncomingStock',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .supplierIncomingStock({
                    orderBy: {
                        expectedDate: 'asc',
                    },
                });
            },
        });
    },
});
export const PriceTierInput = inputObjectType({
    name: 'PriceTierInput',
    definition(t) {
        t.nonNull.int('minQty');
        t.nonNull.float('price');
    },
});
export const SupplierItemPriceHistory = objectType({
    name: 'SupplierItemPriceHistory',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nonNull.float('oldPrice');
        t.nonNull.float('newPrice');
        t.nonNull.dateTime('effectiveAt');
        t.nullable.int('changedById');
        t.nullable.string('reason');
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItemPriceHistory
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem();
            },
        });
    },
});
export const SupplierItemCostHistory = objectType({
    name: 'SupplierItemCostHistory',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nonNull.float('oldCost');
        t.nonNull.float('newCost');
        t.nonNull.dateTime('effectiveAt');
        t.nullable.int('changedById');
        t.nullable.string('reason');
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItemCostHistory
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem();
            },
        });
    },
});
export const SupplierWarehouse = objectType({
    name: 'SupplierWarehouse',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('organizationId');
        t.nonNull.string('name');
        t.nullable.string('address');
        t.nullable.float('latitude');
        t.nullable.float('longitude');
        t.nonNull.boolean('isDefault');
        t.nonNull.boolean('isActive');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('organization', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierWarehouse
                    .findUnique({ where: { id: parent.id } })
                    .organization();
            },
        });
        t.nonNull.list.nonNull.field('stockBatches', {
            type: 'SupplierStockBatch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierWarehouse
                    .findUnique({ where: { id: parent.id } })
                    .stockBatches();
            },
        });
        t.nonNull.list.nonNull.field('movements', {
            type: 'SupplierInventoryMovement',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierWarehouse
                    .findUnique({ where: { id: parent.id } })
                    .movements({
                    orderBy: {
                        createdAt: 'desc',
                    },
                });
            },
        });
        t.nonNull.list.nonNull.field('incoming', {
            type: 'SupplierIncomingStock',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierWarehouse
                    .findUnique({ where: { id: parent.id } })
                    .incoming({
                    orderBy: {
                        expectedDate: 'asc',
                    },
                });
            },
        });
    },
});
export const SupplierStockBatch = objectType({
    name: 'SupplierStockBatch',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nullable.string('warehouseId');
        t.nullable.string('batchNumber');
        t.nonNull.float('quantity');
        t.nonNull.float('remainingQty');
        t.nonNull.float('unitCost');
        t.nullable.dateTime('expiryDate');
        t.nonNull.field('status', { type: 'SupplierStockBatchStatus' });
        t.nonNull.dateTime('receivedAt');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierStockBatch
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem();
            },
        });
        t.nullable.field('warehouse', {
            type: 'SupplierWarehouse',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierStockBatch
                    .findUnique({ where: { id: parent.id } })
                    .warehouse();
            },
        });
        t.nonNull.list.nonNull.field('movements', {
            type: 'SupplierInventoryMovement',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierStockBatch
                    .findUnique({ where: { id: parent.id } })
                    .movements({
                    orderBy: {
                        createdAt: 'desc',
                    },
                });
            },
        });
    },
});
export const SupplierInventoryMovement = objectType({
    name: 'SupplierInventoryMovement',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nullable.string('warehouseId');
        t.nullable.string('batchId');
        t.nonNull.field('type', {
            type: 'SupplierInventoryMovementType',
        });
        t.nonNull.float('quantity');
        t.nonNull.float('quantityBefore');
        t.nonNull.float('quantityAfter');
        t.nullable.float('unitCost');
        t.nullable.string('referenceType');
        t.nullable.string('referenceId');
        t.nullable.string('transferGroupId');
        t.nullable.string('reason');
        t.nullable.int('createdById');
        t.nonNull.dateTime('createdAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierInventoryMovement
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem();
            },
        });
        t.nullable.field('warehouse', {
            type: 'SupplierWarehouse',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierInventoryMovement
                    .findUnique({ where: { id: parent.id } })
                    .warehouse();
            },
        });
        t.nullable.field('batch', {
            type: 'SupplierStockBatch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierInventoryMovement
                    .findUnique({ where: { id: parent.id } })
                    .batch();
            },
        });
    },
});
export const SupplierIncomingStock = objectType({
    name: 'SupplierIncomingStock',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nullable.string('warehouseId');
        t.nonNull.float('expectedQty');
        t.nullable.dateTime('expectedDate');
        t.nullable.string('sourceLabel');
        t.nonNull.field('status', {
            type: 'SupplierIncomingStatus',
        });
        t.nullable.string('receivedBatchId');
        t.nullable.string('notes');
        t.nullable.int('createdById');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierIncomingStock
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem();
            },
        });
        t.nullable.field('warehouse', {
            type: 'SupplierWarehouse',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierIncomingStock
                    .findUnique({ where: { id: parent.id } })
                    .warehouse();
            },
        });
    },
});
export const InventoryValuationType = objectType({
    name: 'InventoryValuation',
    definition(t) {
        t.nonNull.float('totalQty');
        t.nonNull.float('totalValue');
        t.nonNull.float('averageCost');
        t.nonNull.int('batchCount');
    },
});
export const StockAgingBucketsType = objectType({
    name: 'StockAgingBuckets',
    definition(t) {
        t.nonNull.float('fresh');
        t.nonNull.float('aging');
        t.nonNull.float('old');
        t.nonNull.float('stale');
    },
});
export const BatchDistributionEntryType = objectType({
    name: 'BatchDistributionEntry',
    definition(t) {
        t.nonNull.string('batchId');
        t.string('batchNumber');
        t.nonNull.float('remainingQty');
        t.nonNull.float('unitCost');
    },
});
export const InventoryAnalyticsType = objectType({
    name: 'InventoryAnalytics',
    definition(t) {
        t.nonNull.float('inventoryValue');
        t.nonNull.float('averageCost');
        t.float('highestCost');
        t.float('lowestCost');
        t.float('inventoryTurnover');
        t.float('avgDaysInStock');
        t.float('estimatedProfit');
        t.float('marginPct');
        t.nonNull.field('stockAging', { type: 'StockAgingBuckets' });
        t.nonNull.list.nonNull.field('batchDistribution', { type: 'BatchDistributionEntry' });
    },
});
export const InventoryForecastType = objectType({
    name: 'InventoryForecast',
    definition(t) {
        t.nonNull.boolean('hasData');
        t.float('avgDailyConsumption');
        t.float('daysRemaining');
        t.field('expectedStockoutDate', { type: 'DateTime' });
        t.float('suggestedReorderQty');
        t.field('suggestedReorderDate', { type: 'DateTime' });
        t.boolean('isLowStockPredicted');
    },
});
export const SupplierInventoryDashboardType = objectType({
    name: 'SupplierInventoryDashboard',
    definition(t) {
        t.nonNull.float('totalInventory');
        t.nonNull.float('inventoryValue');
        t.nonNull.float('availableStock');
        t.nonNull.float('reservedStock');
        t.nonNull.float('incomingStock');
        t.nonNull.int('lowStockCount');
        t.nonNull.int('outOfStockCount');
        t.nonNull.int('expiringSoonCount');
        t.nonNull.float('averageInventoryCost');
        t.float('averageMargin');
    },
});
export const SupplierScheduledPrice = objectType({
    name: 'SupplierScheduledPrice',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nonNull.float('price');
        t.nonNull.dateTime('effectiveAt');
        t.nullable.dateTime('expiresAt');
        t.nonNull.field('status', {
            type: 'ScheduledPriceStatus',
        });
        t.nullable.int('createdById');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierScheduledPrice
                    .findUnique({
                    where: {
                        id: parent.id,
                    },
                })
                    .supplierItem();
            },
        });
    },
});
export const ScheduledPriceStatus = enumType({
    name: 'ScheduledPriceStatus',
    members: [
        'PENDING',
        'ACTIVE',
        'EXPIRED',
        'CANCELLED',
    ],
});
export const InventoryReconcileResultType = objectType({
    name: 'InventoryReconcileResult',
    definition(t) {
        t.nonNull.field('before', { type: 'InventoryRollupSnapshot' });
        t.nonNull.field('after', { type: 'InventoryRollupSnapshot' });
        t.nonNull.boolean('driftDetected');
    },
});
export const InventoryRollupSnapshotType = objectType({
    name: 'InventoryRollupSnapshot',
    definition(t) {
        t.nonNull.float('availableQty');
        t.nonNull.float('reservedQty');
        t.nonNull.float('damagedQty');
        t.nonNull.float('returnedQty');
        t.nonNull.float('incomingQty');
    },
});
export const SupplierInventoryMovementType = enumType({
    name: 'SupplierInventoryMovementType',
    members: [
        'RECEIVED',
        'SOLD',
        'RESERVED',
        'RELEASED',
        'TRANSFERRED_OUT',
        'TRANSFERRED_IN',
        'ADJUSTED',
        'RETURNED',
        'DAMAGED',
        'EXPIRED',
    ],
});
export const SupplierIncomingStatus = enumType({
    name: 'SupplierIncomingStatus',
    members: [
        'PENDING',
        'RECEIVED',
        'CANCELLED',
    ],
});
export const SupplierItemCategory = objectType({
    name: 'SupplierItemCategory',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('catalogId');
        t.nonNull.string('name');
        t.string('description');
        t.nonNull.boolean('isActive');
        t.nonNull.field('catalog', {
            type: 'SupplierCatalog',
            resolve(parent, _, ctx) {
                return ctx.prisma.supplierItemCategory
                    .findUnique({ where: { id: parent.id } })
                    .catalog();
            },
        });
        t.nonNull.list.nonNull.field('items', {
            type: 'SupplierItem',
            resolve(parent, _, ctx) {
                return ctx.prisma.supplierItemCategory
                    .findUnique({ where: { id: parent.id } })
                    .items();
            },
        });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.dateTime('deletedAt');
    },
});
export const SupplierItemGroup = objectType({
    name: 'SupplierItemGroup',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('catalogId');
        t.nonNull.string('name');
        t.string('description');
        t.nonNull.boolean('isActive');
        t.nonNull.field('catalog', {
            type: 'SupplierCatalog',
            resolve(parent, _, ctx) {
                return ctx.prisma.supplierItemGroup
                    .findUnique({ where: { id: parent.id, deletedAt: null, } })
                    .catalog();
            },
        });
        t.nonNull.list.nonNull.field('items', {
            type: 'SupplierItem',
            resolve(parent, _, ctx) {
                return ctx.prisma.supplierItemGroup
                    .findUnique({ where: { id: parent.id, deletedAt: null, } })
                    .items();
            },
        });
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
    },
});
