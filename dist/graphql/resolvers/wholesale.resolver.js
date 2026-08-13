// src/graphql/resolvers/wholesale.resolver.ts
// Resolvers for wholesale product models: specifications, packaging, shipping, documents
import { arg, list, nonNull, queryField, mutationField } from 'nexus';
// Queries
export const productSpecifications = queryField('productSpecifications', {
    type: list(nonNull('ProductSpecification')),
    args: {
        supplierItemId: nonNull('String'),
    },
    resolve: (_root, { supplierItemId }, ctx) => ctx.prisma.productSpecification.findMany({
        where: { supplierItemId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
    }),
});
export const wholesalePackaging = queryField('wholesalePackaging', {
    type: 'WholesalePackaging',
    args: {
        supplierItemId: nonNull('String'),
    },
    resolve: (_root, { supplierItemId }, ctx) => ctx.prisma.wholesalePackaging.findUnique({
        where: { supplierItemId },
    }),
});
export const wholesaleShipping = queryField('wholesaleShipping', {
    type: 'WholesaleShipping',
    args: {
        supplierItemId: nonNull('String'),
    },
    resolve: (_root, { supplierItemId }, ctx) => ctx.prisma.wholesaleShipping.findUnique({
        where: { supplierItemId },
    }),
});
export const wholesaleDocuments = queryField('wholesaleDocuments', {
    type: list(nonNull('WholesaleDocument')),
    args: {
        supplierItemId: nonNull('String'),
    },
    resolve: (_root, { supplierItemId }, ctx) => ctx.prisma.wholesaleDocument.findMany({
        where: { supplierItemId },
        orderBy: { createdAt: 'desc' },
    }),
});
export const supplierCapabilities = queryField('supplierCapabilities', {
    type: list(nonNull('SupplierCapability')),
    args: {
        organizationId: nonNull('Int'),
    },
    resolve: (_root, { organizationId }, ctx) => ctx.prisma.supplierCapability.findMany({
        where: { organizationId, deletedAt: null },
    }),
});
export const wholesaleProduct = queryField('wholesaleProduct', {
    type: 'SupplierItem',
    args: {
        id: nonNull('String'),
    },
    resolve: (_root, { id }, ctx) => ctx.prisma.supplierItem.findUnique({
        where: { id, deletedAt: null },
        include: {
            priceTiers: true,
            productSpecifications: true,
            wholesalePackaging: true,
            wholesaleShipping: true,
            wholesaleDocuments: true,
            productWholesaleSettings: true,
        },
    }),
});
// Mutations
export const createSpecification = mutationField('createSpecification', {
    type: 'ProductSpecification',
    args: {
        input: nonNull(arg({ type: 'CreateSpecificationInput' })),
    },
    resolve: (_root, { input }, ctx) => ctx.prisma.productSpecification.create({
        data: {
            ...input,
        },
    }),
});
export const updateSpecification = mutationField('updateSpecification', {
    type: 'ProductSpecification',
    args: {
        input: nonNull(arg({ type: 'UpdateSpecificationInput' })),
    },
    resolve: (_root, { input }, ctx) => {
        const { id, ...data } = input;
        return ctx.prisma.productSpecification.update({
            where: { id },
            data,
        });
    },
});
export const deleteSpecification = mutationField('deleteSpecification', {
    type: 'ProductSpecification',
    args: {
        id: nonNull('String'),
    },
    resolve: (_root, { id }, ctx) => ctx.prisma.productSpecification.update({
        where: { id },
        data: { deletedAt: new Date() },
    }),
});
export const updatePackaging = mutationField('updatePackaging', {
    type: 'WholesalePackaging',
    args: {
        input: nonNull(arg({ type: 'UpdatePackagingInput' })),
    },
    resolve: (_root, { input }, ctx) => {
        const { supplierItemId, ...data } = input;
        return ctx.prisma.wholesalePackaging.upsert({
            where: { supplierItemId },
            create: { supplierItemId, ...data },
            update: data,
        });
    },
});
export const updateShipping = mutationField('updateShipping', {
    type: 'WholesaleShipping',
    args: {
        input: nonNull(arg({ type: 'UpdateShippingInput' })),
    },
    resolve: (_root, { input }, ctx) => {
        const { supplierItemId, ...data } = input;
        return ctx.prisma.wholesaleShipping.upsert({
            where: { supplierItemId },
            create: { supplierItemId, ...data },
            update: data,
        });
    },
});
export const uploadDocument = mutationField('uploadDocument', {
    type: 'WholesaleDocument',
    args: {
        input: nonNull(arg({ type: 'UploadDocumentInput' })),
    },
    resolve: (_root, { input }, ctx) => ctx.prisma.wholesaleDocument.create({
        data: {
            ...input,
        },
    }),
});
export const deleteDocument = mutationField('deleteDocument', {
    type: 'WholesaleDocument',
    args: {
        id: nonNull('String'),
    },
    resolve: (_root, { id }, ctx) => ctx.prisma.wholesaleDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
    }),
});
export const updateDocument = mutationField('updateDocument', {
    type: 'WholesaleDocument',
    args: {
        input: nonNull(arg({ type: 'UpdateDocumentInput' })),
    },
    resolve: (_root, { input }, ctx) => {
        const { id, ...data } = input;
        return ctx.prisma.wholesaleDocument.update({
            where: { id },
            data,
        });
    },
});
export const updateWholesaleSettings = mutationField('updateWholesaleSettings', {
    type: 'ProductWholesaleSettings',
    args: {
        supplierItemId: nonNull('String'),
        minimumOrderQty: 'Int',
        sampleAvailable: 'Boolean',
        samplePrice: 'Float',
        leadTime: 'String',
    },
    resolve: (_root, { supplierItemId, ...data }, ctx) => ctx.prisma.productWholesaleSettings.upsert({
        where: { supplierItemId },
        create: { supplierItemId, ...data },
        update: data,
    }),
});
// ─────────────────────────────────────────────────────────────
// SUPPLIER CAPABILITY MUTATIONS
// ─────────────────────────────────────────────────────────────
export const createSupplierCapability = mutationField('createSupplierCapability', {
    type: 'SupplierCapability',
    args: {
        input: nonNull(arg({ type: 'CreateSupplierCapabilityInput' })),
    },
    resolve: (_root, { input }, ctx) => ctx.prisma.supplierCapability.create({
        data: {
            organizationId: input.organizationId,
            type: input.type,
            name: input.name ?? input.type,
            available: input.available ?? false,
            description: input.description ?? '',
        },
    }),
});
export const updateSupplierCapability = mutationField('updateSupplierCapability', {
    type: 'SupplierCapability',
    args: {
        input: nonNull(arg({ type: 'UpdateSupplierCapabilityInput' })),
    },
    resolve: (_root, { input }, ctx) => ctx.prisma.supplierCapability.update({
        where: { id: input.id },
        data: {
            ...(input.available !== undefined ? { available: input.available } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
        },
    }),
});
export const deleteSupplierCapability = mutationField('deleteSupplierCapability', {
    type: 'SupplierCapability',
    args: {
        id: nonNull('String'),
    },
    resolve: (_root, { id }, ctx) => ctx.prisma.supplierCapability.update({
        where: { id },
        data: { deletedAt: new Date() },
    }),
});
// ─────────────────────────────────────────────────────────────
// WHOLESALE PRODUCTS LIST QUERY
// ─────────────────────────────────────────────────────────────
export const wholesaleProducts = queryField('wholesaleProducts', {
    type: list(nonNull('SupplierItem')),
    args: {
        catalogId: 'String',
        search: 'String',
        categoryId: 'String',
        groupId: 'String',
        isActive: 'Boolean',
    },
    resolve: async (_root, args, ctx) => {
        const where = { deletedAt: null };
        if (args.catalogId) {
            where.catalogId = args.catalogId;
        }
        if (args.search) {
            where.OR = [
                { name: { contains: args.search, mode: 'insensitive' } },
                { sku: { contains: args.search, mode: 'insensitive' } },
                { description: { contains: args.search, mode: 'insensitive' } },
            ];
        }
        if (args.categoryId) {
            where.categoryId = args.categoryId;
        }
        if (args.groupId) {
            where.groupId = args.groupId;
        }
        if (args.isActive !== undefined) {
            where.isActive = args.isActive;
        }
        return ctx.prisma.supplierItem.findMany({
            where,
            include: {
                priceTiers: true,
                productSpecifications: true,
                wholesalePackaging: true,
                wholesaleShipping: true,
                wholesaleDocuments: true,
                productWholesaleSettings: true,
            },
            orderBy: { updatedAt: 'desc' },
        });
    },
});
// ─────────────────────────────────────────────────────────────
// RELATED PRODUCTS QUERY
// ─────────────────────────────────────────────────────────────
export const relatedProducts = queryField('relatedProducts', {
    type: list(nonNull('SupplierItem')),
    args: {
        productId: nonNull('String'),
        limit: 'Int',
    },
    resolve: async (_root, { productId, limit }, ctx) => {
        // First get the source product to find its category/group
        const sourceProduct = await ctx.prisma.supplierItem.findUnique({
            where: { id: productId, deletedAt: null },
            select: { categoryId: true, groupId: true, catalogId: true },
        });
        if (!sourceProduct || !sourceProduct.catalogId) {
            return [];
        }
        // Find related products by same category or group
        const where = {
            catalogId: sourceProduct.catalogId,
            id: { not: productId },
            deletedAt: null,
            isActive: true,
        };
        if (sourceProduct.categoryId) {
            where.categoryId = sourceProduct.categoryId;
        }
        else if (sourceProduct.groupId) {
            where.groupId = sourceProduct.groupId;
        }
        return ctx.prisma.supplierItem.findMany({
            where,
            take: limit ?? 4,
            include: {
                priceTiers: true,
                productWholesaleSettings: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    },
});
