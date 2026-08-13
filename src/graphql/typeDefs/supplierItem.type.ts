import { objectType, inputObjectType, enumType, list, nonNull } from 'nexus';

export const PriceTier = objectType({
    name: 'PriceTier',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('minQty');
        t.nullable.int('maxQty'); // null means unlimited upper bound
        t.nonNull.float('price');
        t.nonNull.string('currency');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('deletedAt', { type: 'DateTime' });
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
        t.nullable.string('image')
        t.nullable.float('currentCost')
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
                    })
            },
        })
        t.field('category', {
            type: 'SupplierItemCategory',
            resolve(parent, _, ctx) {
                if (!parent.categoryId) return null

                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id, deletedAt: null, } })
                    .category()
            },
        })

        t.field('group', {
            type: 'SupplierItemGroup',
            resolve(parent, _, ctx) {
                if (!parent.groupId) return null

                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id, deletedAt: null, } })
                    .group()
            },
        })
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
                    })
            },
        })
        t.nonNull.list.nonNull.field('costHistory', {
            type: 'SupplierItemCostHistory',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .costHistory({
                        orderBy: {
                            effectiveAt: 'desc',
                        },
                    })
            },
        })
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nonNull.float('reservedQty')
        t.nonNull.float('incomingQty')
        t.nonNull.float('damagedQty')
        t.nonNull.float('returnedQty')

        t.nullable.float('reorderLevel')
        t.nullable.float('reorderQty')
        t.nullable.string('leadTime')
        t.nullable.boolean('sampleAvailable')
        t.nullable.float('samplePrice')
        t.nullable.string('shippingFrom')

        t.nonNull.list.nonNull.field('supplierStockBatches', {
            type: 'SupplierStockBatch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .supplierStockBatches({
                        orderBy: {
                            receivedAt: 'desc',
                        },
                    })
            },
        })

        t.nonNull.list.nonNull.field('supplierInventoryMovements', {
            type: 'SupplierInventoryMovement',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .supplierInventoryMovements({
                        orderBy: {
                            createdAt: 'desc',
                        },
                    })
            },
        })

        t.nonNull.list.nonNull.field('supplierIncomingStock', {
            type: 'SupplierIncomingStock',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem
                    .findUnique({ where: { id: parent.id } })
                    .supplierIncomingStock({
                        orderBy: {
                            expectedDate: 'asc',
                        },
                    })
            },
        })

        // Variant relations
        t.nonNull.boolean('hasVariants', {
            resolve: async (parent, _, ctx) => {
                const count = await ctx.prisma.supplierItemVariant.count({
                    where: { supplierItemId: parent.id, deletedAt: null, isActive: true },
                })
                return count > 0
            },
        })

        // Total available stock across all active variants (or the item's own qty when no variants)
        t.nonNull.float('totalStock', {
            resolve: async (parent, _, ctx) => {
                const agg = await ctx.prisma.supplierItemVariant.aggregate({
                    where: { supplierItemId: parent.id, deletedAt: null, isActive: true },
                    _sum: { availableQty: true },
                })
                const variantTotal = agg._sum.availableQty ?? 0
                return variantTotal > 0 ? variantTotal : parent.availableQty
            },
        })

        t.nonNull.list.nonNull.field('variantGroups', {
            type: 'SupplierItemVariantGroup',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemVariantGroup.findMany({
                    where: { supplierItemId: parent.id },
                    orderBy: { sortOrder: 'asc' },
                    include: { options: { orderBy: { sortOrder: 'asc' } } },
                }),
        })

        t.nonNull.list.nonNull.field('variants', {
            type: 'SupplierItemVariant',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemVariant.findMany({
                    where: { supplierItemId: parent.id, deletedAt: null },
                    orderBy: { createdAt: 'asc' },
                    include: { variantValues: { include: { option: true } } },
                }),
        })

        t.nullable.field('marketplaceListing', {
            type: 'MarketplaceListing',
            resolve: (parent, _, ctx) =>
                ctx.prisma.marketplaceListing.findUnique({ where: { supplierItemId: parent.id } }),
        })

        // Wholesale product extensions
        t.nullable.field('productWholesaleSettings', {
            type: 'ProductWholesaleSettings',
            resolve: (parent, _, ctx) =>
                ctx.prisma.productWholesaleSettings.findUnique({
                    where: { supplierItemId: parent.id },
                }),
        })

        t.nonNull.list.nonNull.field('productSpecifications', {
            type: 'ProductSpecification',
            resolve: (parent, _, ctx) =>
                ctx.prisma.productSpecification.findMany({
                    where: { supplierItemId: parent.id, deletedAt: null },
                    orderBy: { sortOrder: 'asc' },
                }),
        })

        t.nullable.field('wholesalePackaging', {
            type: 'WholesalePackaging',
            resolve: (parent, _, ctx) =>
                ctx.prisma.wholesalePackaging.findUnique({
                    where: { supplierItemId: parent.id },
                }),
        })

        t.nullable.field('wholesaleShipping', {
            type: 'WholesaleShipping',
            resolve: (parent, _, ctx) =>
                ctx.prisma.wholesaleShipping.findUnique({
                    where: { supplierItemId: parent.id },
                }),
        })
        t.nonNull.list.nonNull.field('wholesaleDocument', {
            type: 'WholesaleDocument',
            resolve: (parent, _, ctx) =>
                ctx.prisma.wholesaleDocument.findMany({
                    where: {
                        supplierItemId: parent.id,
                        deletedAt: null,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                }),
        })
        // Image collections for Alibaba-style product management
        t.nonNull.list.nonNull.field('supplierItemImage', {
            type: 'SupplierItemImage',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemImage.findMany({
                    where: { supplierItemId: parent.id, deletedAt: null },
                    orderBy: { sortOrder: 'asc' },
                }),
        })
    },
});

export const PriceTierInput = inputObjectType({
    name: 'PriceTierInput',
    definition(t) {
        t.nonNull.int('minQty');
        t.nullable.int('maxQty');
        t.nonNull.float('price');
        t.string('currency');
    },
});

export const WholesaleDocType = enumType({
    name: 'WholesaleDocType',
    members: ['CE', 'FDA', 'ISO', 'ROHS', 'MSDS', 'OTHER'],
});

export const SupplierCapabilityType = enumType({
    name: 'SupplierCapabilityType',
    members: ['MINOR_CUSTOMIZATION', 'DRAWING_CUSTOMIZATION', 'SAMPLE_CUSTOMIZATION', 'FULL_CUSTOMIZATION', 'OEM', 'ODM'],
});

// ProductWholesaleSettings type
export const ProductWholesaleSettings = objectType({
    name: 'ProductWholesaleSettings',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nullable.int('minimumOrderQty');
        t.nonNull.boolean('sampleAvailable');
        t.nullable.float('samplePrice');
        t.nullable.string('leadTime');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('deletedAt', { type: 'DateTime' });

        t.nullable.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem.findUnique({ where: { id: parent.supplierItemId } });
            },
        });
    },
});

// ProductSpecification type
export const ProductSpecification = objectType({
    name: 'ProductSpecification',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nullable.string('category');
        t.nullable.string('groupName');
        t.nonNull.string('name');
        t.nonNull.string('value');
        t.nullable.string('unit');
        t.nonNull.int('sortOrder');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('deletedAt', { type: 'DateTime' });

        t.nullable.field('SupplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItem.findUnique({ where: { id: parent.supplierItemId } });
            },
        });
    },
});

export const WholesalePackaging = objectType({
    name: 'WholesalePackaging',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nullable.string('sellingUnit');
        t.nullable.float('packageLength');
        t.nullable.float('packageWidth');
        t.nullable.float('packageHeight');
        t.nullable.float('grossWeight');
        t.nullable.float('netWeight');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('deletedAt', { type: 'DateTime' });
    },
});

export const WholesaleShipping = objectType({
    name: 'WholesaleShipping',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nullable.string('originCountry');
        t.nullable.string('originProvince');
        t.nullable.string('originCity');
        t.nullable.string('shippingMethod');
        t.nullable.int('estimatedDays');
        t.nullable.string('shippingNotes');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('deletedAt', { type: 'DateTime' });
    },
});

export const WholesaleDocument = objectType({
    name: 'WholesaleDocument',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('supplierItemId');
        t.nullable.string('title');
        t.nonNull.field('type', { type: 'WholesaleDocType' });
        t.nonNull.string('fileUrl');
        t.nonNull.boolean('verified');
        t.nullable.int('verifiedById');
        t.nullable.field('verifiedAt', { type: 'DateTime' });
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('deletedAt', { type: 'DateTime' });
    },
});

export const SupplierCapability = objectType({
    name: 'SupplierCapability',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('organizationId');
        t.nonNull.field('type', { type: 'SupplierCapabilityType' });
        t.nonNull.string('name');
        t.nullable.string('icon');
        t.nonNull.boolean('available');
        t.nullable.string('description');
        t.nonNull.field('createdAt', { type: 'DateTime' });
        t.nonNull.field('updatedAt', { type: 'DateTime' });
        t.nullable.field('deletedAt', { type: 'DateTime' });
    },
});


// Input types for ProductSpecification
export const CreateSpecificationInput = inputObjectType({
    name: 'CreateSpecificationInput',
    definition(t) {
        t.nonNull.string('supplierItemId');
        t.nullable.string('category');
        t.nullable.string('groupName');
        t.nonNull.string('name');
        t.nonNull.string('value');
        t.nullable.string('unit');
        t.int('sortOrder');
    },
});

export const UpdateSpecificationInput = inputObjectType({
    name: 'UpdateSpecificationInput',
    definition(t) {
        t.nonNull.string('id');
        t.nullable.string('category');
        t.nullable.string('groupName');
        t.nullable.string('name');
        t.nullable.string('value');
        t.nullable.string('unit');
        t.nullable.int('sortOrder');
    },
});

export const UpdatePackagingInput = inputObjectType({
    name: 'UpdatePackagingInput',
    definition(t) {
        t.nonNull.string('supplierItemId');
        t.nullable.string('sellingUnit');
        t.nullable.float('packageLength');
        t.nullable.float('packageWidth');
        t.nullable.float('packageHeight');
        t.nullable.float('grossWeight');
        t.nullable.float('netWeight');
    },
});

export const UpdateShippingInput = inputObjectType({
    name: 'UpdateShippingInput',
    definition(t) {
        t.nonNull.string('supplierItemId');
        t.nullable.string('originCountry');
        t.nullable.string('originProvince');
        t.nullable.string('originCity');
        t.nullable.string('shippingMethod');
        t.nullable.int('estimatedDays');
        t.nullable.string('shippingNotes');
    },
});
export const UploadDocumentInput = inputObjectType({
    name: 'UploadDocumentInput',
    definition(t) {
        t.nonNull.string('supplierItemId');
        t.nonNull.field('type', { type: 'WholesaleDocType' });
        t.nullable.string('title');
        t.nonNull.string('fileUrl');
    },
})

export const UpdateDocumentInput = inputObjectType({
    name: 'UpdateDocumentInput',
    definition(t) {
        t.nonNull.string('id');
        t.nullable.field('type', { type: 'WholesaleDocType' });
        t.nullable.string('title');
    },
})

// SupplierCapability input types
export const CreateSupplierCapabilityInput = inputObjectType({
    name: 'CreateSupplierCapabilityInput',
    definition(t) {
        t.nonNull.int('organizationId');
        t.nonNull.field('type', { type: 'SupplierCapabilityType' });
        t.nullable.string('name');
        t.nullable.boolean('available');
        t.nullable.string('description');
    },
})

export const UpdateSupplierCapabilityInput = inputObjectType({
    name: 'UpdateSupplierCapabilityInput',
    definition(t) {
        t.nonNull.string('id');
        t.nullable.boolean('available');
        t.nullable.string('description');
    },
})

export const SupplierStockBatchStatus = enumType({
    name: 'SupplierStockBatchStatus',
    members: [
        'ACTIVE',
        'DEPLETED',
        'EXPIRED',
        'DAMAGED',
    ],
})

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

export const SupplierItemPriceHistory = objectType({
    name: 'SupplierItemPriceHistory',
    definition(t) {
        t.nonNull.string('id')

        t.nonNull.string('supplierItemId')

        t.nonNull.float('oldPrice')
        t.nonNull.float('newPrice')

        t.nonNull.dateTime('effectiveAt')

        t.nullable.int('changedById')
        t.nullable.string('reason')

        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItemPriceHistory
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem()
            },
        })
    },
})

export const SupplierItemCostHistory = objectType({
    name: 'SupplierItemCostHistory',
    definition(t) {
        t.nonNull.string('id')

        t.nonNull.string('supplierItemId')

        t.nonNull.float('oldCost')
        t.nonNull.float('newCost')

        t.nonNull.dateTime('effectiveAt')

        t.nullable.int('changedById')
        t.nullable.string('reason')

        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierItemCostHistory
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem()
            },
        })
    },
})



export const SupplierWarehouse = objectType({
    name: 'SupplierWarehouse',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.int('organizationId')
        t.nonNull.string('name')
        t.nullable.string('address')
        t.nullable.float('latitude')
        t.nullable.float('longitude')
        t.nonNull.boolean('isDefault')
        t.nonNull.boolean('isActive')
        t.nonNull.dateTime('createdAt')
        t.nonNull.dateTime('updatedAt')
        t.nullable.dateTime('deletedAt')

        t.nonNull.field('organization', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierWarehouse
                    .findUnique({ where: { id: parent.id } })
                    .organization()
            },
        })

        t.nonNull.list.nonNull.field('stockBatches', {
            type: 'SupplierStockBatch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierWarehouse
                    .findUnique({ where: { id: parent.id } })
                    .stockBatches()
            },
        })

        t.nonNull.list.nonNull.field('movements', {
            type: 'SupplierInventoryMovement',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierWarehouse
                    .findUnique({ where: { id: parent.id } })
                    .movements({
                        orderBy: {
                            createdAt: 'desc',
                        },
                    })
            },
        })

        t.nonNull.list.nonNull.field('incoming', {
            type: 'SupplierIncomingStock',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierWarehouse
                    .findUnique({ where: { id: parent.id } })
                    .incoming({
                        orderBy: {
                            expectedDate: 'asc',
                        },
                    })
            },
        })
    },
})

export const SupplierStockBatch = objectType({
    name: 'SupplierStockBatch',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('supplierItemId')
        t.nullable.string('warehouseId')
        t.nullable.string('batchNumber')
        t.nonNull.float('quantity')
        t.nonNull.float('remainingQty')
        t.nonNull.float('unitCost')
        t.nullable.dateTime('expiryDate')
        t.nonNull.field('status', { type: 'SupplierStockBatchStatus' })
        t.nonNull.dateTime('receivedAt')
        t.nonNull.dateTime('createdAt')
        t.nonNull.dateTime('updatedAt')
        t.nullable.dateTime('deletedAt')

        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierStockBatch
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem()
            },
        })

        t.nullable.field('warehouse', {
            type: 'SupplierWarehouse',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierStockBatch
                    .findUnique({ where: { id: parent.id } })
                    .warehouse()
            },
        })

        t.nonNull.list.nonNull.field('movements', {
            type: 'SupplierInventoryMovement',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierStockBatch
                    .findUnique({ where: { id: parent.id } })
                    .movements({
                        orderBy: {
                            createdAt: 'desc',
                        },
                    })
            },
        })
    },
})

export const SupplierInventoryMovement = objectType({
    name: 'SupplierInventoryMovement',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('supplierItemId')
        t.nullable.string('warehouseId')
        t.nullable.string('batchId')

        t.nonNull.field('type', {
            type: 'SupplierInventoryMovementType',
        })

        t.nonNull.float('quantity')
        t.nonNull.float('quantityBefore')
        t.nonNull.float('quantityAfter')
        t.nullable.float('unitCost')

        t.nullable.string('referenceType')
        t.nullable.string('referenceId')
        t.nullable.string('transferGroupId')
        t.nullable.string('reason')
        t.nullable.int('createdById')

        t.nonNull.dateTime('createdAt')
        t.nullable.dateTime('deletedAt')

        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierInventoryMovement
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem()
            },
        })

        t.nullable.field('warehouse', {
            type: 'SupplierWarehouse',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierInventoryMovement
                    .findUnique({ where: { id: parent.id } })
                    .warehouse()
            },
        })

        t.nullable.field('batch', {
            type: 'SupplierStockBatch',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierInventoryMovement
                    .findUnique({ where: { id: parent.id } })
                    .batch()
            },
        })
    },
})

export const SupplierIncomingStock = objectType({
    name: 'SupplierIncomingStock',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('supplierItemId')
        t.nullable.string('warehouseId')

        t.nonNull.float('expectedQty')
        t.nullable.dateTime('expectedDate')

        t.nullable.string('sourceLabel')

        t.nonNull.field('status', {
            type: 'SupplierIncomingStatus',
        })

        t.nullable.string('receivedBatchId')
        t.nullable.string('notes')
        t.nullable.int('createdById')

        t.nonNull.dateTime('createdAt')
        t.nonNull.dateTime('updatedAt')
        t.nullable.dateTime('deletedAt')

        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierIncomingStock
                    .findUnique({ where: { id: parent.id } })
                    .supplierItem()
            },
        })

        t.nullable.field('warehouse', {
            type: 'SupplierWarehouse',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierIncomingStock
                    .findUnique({ where: { id: parent.id } })
                    .warehouse()
            },
        })
    },
})


export const InventoryValuationType = objectType({
    name: 'InventoryValuation',
    definition(t) {
        t.nonNull.float('totalQty')
        t.nonNull.float('totalValue')
        t.nonNull.float('averageCost')
        t.nonNull.int('batchCount')
    },
})

export const StockAgingBucketsType = objectType({
    name: 'StockAgingBuckets',
    definition(t) {
        t.nonNull.float('fresh')
        t.nonNull.float('aging')
        t.nonNull.float('old')
        t.nonNull.float('stale')
    },
})

export const BatchDistributionEntryType = objectType({
    name: 'BatchDistributionEntry',
    definition(t) {
        t.nonNull.string('batchId')
        t.string('batchNumber')
        t.nonNull.float('remainingQty')
        t.nonNull.float('unitCost')
    },
})

export const InventoryAnalyticsType = objectType({
    name: 'InventoryAnalytics',
    definition(t) {
        t.nonNull.float('inventoryValue')
        t.nonNull.float('averageCost')
        t.float('highestCost')
        t.float('lowestCost')
        t.float('inventoryTurnover')
        t.float('avgDaysInStock')
        t.float('estimatedProfit')
        t.float('marginPct')
        t.nonNull.field('stockAging', { type: 'StockAgingBuckets' })
        t.nonNull.list.nonNull.field('batchDistribution', { type: 'BatchDistributionEntry' })
    },
})

export const InventoryForecastType = objectType({
    name: 'InventoryForecast',
    definition(t) {
        t.nonNull.boolean('hasData')
        t.float('avgDailyConsumption')
        t.float('daysRemaining')
        t.field('expectedStockoutDate', { type: 'DateTime' })
        t.float('suggestedReorderQty')
        t.field('suggestedReorderDate', { type: 'DateTime' })
        t.boolean('isLowStockPredicted')
    },
})

export const SupplierInventoryDashboardType = objectType({
    name: 'SupplierInventoryDashboard',
    definition(t) {
        t.nonNull.float('totalInventory')
        t.nonNull.float('inventoryValue')
        t.nonNull.float('availableStock')
        t.nonNull.float('reservedStock')
        t.nonNull.float('incomingStock')
        t.nonNull.int('lowStockCount')
        t.nonNull.int('outOfStockCount')
        t.nonNull.int('expiringSoonCount')
        t.nonNull.float('averageInventoryCost')
        t.float('averageMargin')
    },
})


export const SupplierScheduledPrice = objectType({
    name: 'SupplierScheduledPrice',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('supplierItemId')
        t.nonNull.float('price')

        t.nonNull.dateTime('effectiveAt')
        t.nullable.dateTime('expiresAt')

        t.nonNull.field('status', {
            type: 'ScheduledPriceStatus',
        })

        t.nullable.int('createdById')

        t.nonNull.dateTime('createdAt')
        t.nonNull.dateTime('updatedAt')
        t.nullable.dateTime('deletedAt')

        t.nonNull.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.supplierScheduledPrice
                    .findUnique({
                        where: {
                            id: parent.id,
                        },
                    })
                    .supplierItem()
            },
        })
    },
})

export const ScheduledPriceStatus = enumType({
    name: 'ScheduledPriceStatus',
    members: [
        'PENDING',
        'ACTIVE',
        'EXPIRED',
        'CANCELLED',
    ],
})

export const InventoryReconcileResultType = objectType({
    name: 'InventoryReconcileResult',
    definition(t) {
        t.nonNull.field('before', { type: 'InventoryRollupSnapshot' })
        t.nonNull.field('after', { type: 'InventoryRollupSnapshot' })
        t.nonNull.boolean('driftDetected')
    },
})

export const InventoryRollupSnapshotType = objectType({
    name: 'InventoryRollupSnapshot',
    definition(t) {
        t.nonNull.float('availableQty')
        t.nonNull.float('reservedQty')
        t.nonNull.float('damagedQty')
        t.nonNull.float('returnedQty')
        t.nonNull.float('incomingQty')
    },
})


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
})

export const SupplierIncomingStatus = enumType({
    name: 'SupplierIncomingStatus',
    members: [
        'PENDING',
        'RECEIVED',
        'CANCELLED',
    ],
})


export const SupplierItemCategory = objectType({
    name: 'SupplierItemCategory',

    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('catalogId')

        t.nonNull.string('name')
        t.string('description')

        t.nonNull.boolean('isActive')

        t.nonNull.field('catalog', {
            type: 'SupplierCatalog',
            resolve(parent, _, ctx) {
                return ctx.prisma.supplierItemCategory
                    .findUnique({ where: { id: parent.id } })
                    .catalog()
            },
        })

        t.nonNull.list.nonNull.field('items', {
            type: 'SupplierItem',
            resolve(parent, _, ctx) {
                return ctx.prisma.supplierItemCategory
                    .findUnique({ where: { id: parent.id } })
                    .items()
            },
        })

        t.nonNull.field('createdAt', { type: 'DateTime' })
        t.nonNull.field('updatedAt', { type: 'DateTime' })
        t.nullable.dateTime('deletedAt')
    },
})


export const SupplierItemGroup = objectType({
    name: 'SupplierItemGroup',

    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('catalogId')

        t.nonNull.string('name')
        t.string('description')

        t.nonNull.boolean('isActive')

        t.nonNull.field('catalog', {
            type: 'SupplierCatalog',
            resolve(parent, _, ctx) {
                return ctx.prisma.supplierItemGroup
                    .findUnique({ where: { id: parent.id, deletedAt: null, } })
                    .catalog()
            },
        })

        t.nonNull.list.nonNull.field('items', {
            type: 'SupplierItem',
            resolve(parent, _, ctx) {
                return ctx.prisma.supplierItemGroup
                    .findUnique({ where: { id: parent.id, deletedAt: null, } })
                    .items()
            },
        })

        t.nullable.dateTime('deletedAt')
        t.nonNull.field('createdAt', { type: 'DateTime' })
        t.nonNull.field('updatedAt', { type: 'DateTime' })
    },
})


// ─────────────────────────────────────────────────────────────
// VARIANT TYPES
// ─────────────────────────────────────────────────────────────

export const SupplierItemVariantOption = objectType({
    name: 'SupplierItemVariantOption',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('variantGroupId')
        t.nonNull.string('value')
        t.nullable.string('colorHex')
        t.nullable.string('image')
        t.nonNull.int('sortOrder')
    },
})

export const SupplierItemVariantGroup = objectType({
    name: 'SupplierItemVariantGroup',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('supplierItemId')
        t.nonNull.string('name')
        t.nonNull.int('sortOrder')
        t.nonNull.field('createdAt', { type: 'DateTime' })
        t.nonNull.field('updatedAt', { type: 'DateTime' })
        t.nonNull.list.nonNull.field('options', {
            type: 'SupplierItemVariantOption',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemVariantOption.findMany({
                    where: { variantGroupId: parent.id },
                    orderBy: { sortOrder: 'asc' },
                }),
        })
    },
})

export const SupplierItemVariantValue = objectType({
    name: 'SupplierItemVariantValue',
    definition(t) {
        t.nonNull.string('variantId')
        t.nonNull.string('optionId')
        t.nonNull.field('option', {
            type: 'SupplierItemVariantOption',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemVariantOption.findUniqueOrThrow({ where: { id: parent.optionId } }),
        })
    },
})

export const SupplierItemVariant = objectType({
    name: 'SupplierItemVariant',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('supplierItemId')
        t.nullable.string('sku')
        t.nullable.string('barcode')
        t.nonNull.string('name')
        t.nonNull.float('price')
        t.nonNull.float('cost')
        t.nonNull.float('availableQty')
        t.nonNull.float('reservedQty')
        t.nonNull.float('incomingQty')
        t.nonNull.float('damagedQty')
        t.nonNull.float('returnedQty')
        t.nullable.float('reorderLevel')
        t.nullable.float('reorderQty')
        t.nullable.float('weight')
        t.nullable.float('length')
        t.nullable.float('width')
        t.nullable.float('height')
        t.nullable.string('image')
        t.nonNull.boolean('isDefault')
        t.nonNull.boolean('isActive')
        t.nonNull.field('createdAt', { type: 'DateTime' })
        t.nonNull.field('updatedAt', { type: 'DateTime' })
        t.nullable.dateTime('deletedAt')
        t.nonNull.list.nonNull.field('variantValues', {
            type: 'SupplierItemVariantValue',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemVariantValue.findMany({
                    where: { variantId: parent.id },
                    include: { option: true },
                }),
        })
        // Resolved image — variant image with fallback to parent item image.
        t.nullable.string('resolvedImage', {
            resolve: async (parent, _, ctx) => {
                if (parent.image) return parent.image
                const item = await ctx.prisma.supplierItem.findUnique({ where: { id: parent.supplierItemId }, select: { image: true } })
                return item?.image ?? null
            },
        })

        // Variant-specific image gallery
        t.nonNull.list.nonNull.field('images', {
            type: 'SupplierItemVariantImage',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemVariantImage.findMany({
                    where: { supplierItemVariantId: parent.id, deletedAt: null },
                    orderBy: { sortOrder: 'asc' },
                }),
        })
    },
})

// Input types for mutations
export const VariantOptionInput = inputObjectType({
    name: 'VariantOptionInput',
    definition(t) {
        t.nonNull.string('value')
        t.nullable.string('colorHex')
        t.nullable.string('image')
        t.int('sortOrder')
    },
})

export const CreateVariantInput = inputObjectType({
    name: 'CreateVariantInput',
    definition(t) {
        t.nonNull.string('supplierItemId')
        t.nullable.string('sku')
        t.nullable.string('barcode')
        t.nonNull.string('name')
        t.nonNull.float('price')
        t.float('cost')
        t.float('availableQty')
        t.nullable.string('image')
        t.nullable.float('weight')
        t.nullable.float('length')
        t.nullable.float('width')
        t.nullable.float('height')
        t.boolean('isDefault')
        t.nonNull.list.nonNull.string('optionIds')
    },
})

export const UpdateVariantInput = inputObjectType({
    name: 'UpdateVariantInput',
    definition(t) {
        t.nonNull.string('id')
        t.nullable.string('sku')
        t.nullable.string('barcode')
        t.nullable.string('name')
        t.nullable.float('price')
        t.nullable.float('cost')
        t.nullable.float('availableQty')
        t.nullable.float('reorderLevel')
        t.nullable.float('reorderQty')
        t.nullable.string('image')
        t.nullable.float('weight')
        t.nullable.float('length')
        t.nullable.float('width')
        t.nullable.float('height')
        t.nullable.boolean('isDefault')
        t.nullable.boolean('isActive')
    },
})

// Summary returned by generateVariants mutation
export const GenerateVariantsResult = objectType({
    name: 'GenerateVariantsResult',
    definition(t) {
        t.nonNull.int('created')
        t.nonNull.int('skipped')
        t.nonNull.list.nonNull.field('variants', { type: 'SupplierItemVariant' })
    },
})

// ─────────────────────────────────────────────────────────────
// IMAGE TYPES - SupplierItemImage, SupplierItemVariantImage, SupplierItemReviewImage
// ─────────────────────────────────────────────────────────────

export const SupplierItemImage = objectType({
    name: 'SupplierItemImage',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('supplierItemId')
        t.nonNull.string('url')
        t.nonNull.int('sortOrder')
        t.nullable.field('createdAt', { type: 'DateTime' })
        t.nullable.field('updatedAt', { type: 'DateTime' })
        t.nullable.field('deletedAt', { type: 'DateTime' })
        t.nullable.field('supplierItem', {
            type: 'SupplierItem',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItem.findUnique({ where: { id: parent.supplierItemId } }),
        })
    },
})

export const SupplierItemVariantImage = objectType({
    name: 'SupplierItemVariantImage',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('supplierItemVariantId')
        t.nonNull.string('url')
        t.nonNull.int('sortOrder')
        t.nullable.field('createdAt', { type: 'DateTime' })
        t.nullable.field('updatedAt', { type: 'DateTime' })
        t.nullable.field('deletedAt', { type: 'DateTime' })
        t.nullable.field('supplierItemVariant', {
            type: 'SupplierItemVariant',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemVariant.findUnique({ where: { id: parent.supplierItemVariantId } }),
        })
    },
})

export const SupplierItemReviewImage = objectType({
    name: 'SupplierItemReviewImage',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('supplierItemReviewId')
        t.nonNull.string('url')
        t.nonNull.int('sortOrder')
        t.nullable.field('createdAt', { type: 'DateTime' })
        t.nullable.field('updatedAt', { type: 'DateTime' })
        t.nullable.field('deletedAt', { type: 'DateTime' })
        t.nullable.field('supplierItemReview', {
            type: 'SupplierItemReview',
            resolve: (parent, _, ctx) =>
                ctx.prisma.supplierItemReview.findUnique({ where: { id: parent.supplierItemReviewId } }),
        })
    },
})

// Input types for image mutations
export const CreateSupplierItemImageInput = inputObjectType({
    name: 'CreateSupplierItemImageInput',
    definition(t) {
        t.nonNull.string('supplierItemId')
        t.nonNull.string('url')
        t.int('sortOrder')
    },
})

export const UpdateSupplierItemImageInput = inputObjectType({
    name: 'UpdateSupplierItemImageInput',
    definition(t) {
        t.nonNull.int('id')
        t.nullable.string('url')
        t.nullable.int('sortOrder')
    },
})

export const CreateSupplierItemVariantImageInput = inputObjectType({
    name: 'CreateSupplierItemVariantImageInput',
    definition(t) {
        t.nonNull.string('supplierItemVariantId')
        t.nonNull.string('url')
        t.int('sortOrder')
    },
})

export const CreateSupplierItemReviewImageInput = inputObjectType({
    name: 'CreateSupplierItemReviewImageInput',
    definition(t) {
        t.nonNull.string('supplierItemReviewId')
        t.nonNull.string('url')
        t.int('sortOrder')
    },
})

export const ReorderImagesInput = inputObjectType({
    name: 'ReorderImagesInput',
    definition(t) {
        t.nonNull.list.nonNull.int('ids')
        t.nonNull.list.nonNull.int('sortOrders')
    },
})

export const UpdateSupplierItemVariantImageInput = inputObjectType({
    name: 'UpdateSupplierItemVariantImageInput',
    definition(t) {
        t.nonNull.int('id')
        t.nullable.string('url')
        t.nullable.int('sortOrder')
    },
})
