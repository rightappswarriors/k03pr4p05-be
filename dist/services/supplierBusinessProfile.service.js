import { canonicalSupplierLinkStatus, requireRetailerOrganization, requireRetailerOutlet } from './supplierLink.service.js';
const orderableProductWhere = (supplierOrgId) => ({
    catalog: { organizationId: supplierOrgId },
    isActive: true,
    deletedAt: null,
    marketplaceListing: { status: 'PUBLISHED', deletedAt: null },
});
const percentage = (numerator, denominator) => denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : null;
export async function getRegisteredSupplierProfile(ctx, input) {
    const retailerOrgId = await requireRetailerOrganization(ctx);
    if (input.supplierOrgId === retailerOrgId)
        throw new Error('Supplier organization not found.');
    const outlet = input.outletId == null ? null : await requireRetailerOutlet(ctx, input.outletId);
    const supplier = await ctx.prisma.organization.findFirst({
        where: {
            id: input.supplierOrgId,
            roles: { has: 'SUPPLIER' },
            deletedAt: null,
            accountStatus: 'ACTIVE',
        },
        select: {
            id: true,
            name: true,
            profileImg: true,
            profilePhoto: true,
            bannerImg: true,
            location: true,
            contactNumber: true,
            bio: true,
            verificationStatus: true,
            createdAt: true,
        },
    });
    if (!supplier)
        throw new Error('Supplier organization not found.');
    const productWhere = orderableProductWhere(supplier.id);
    const [link, reviewAggregate, activeProductCount, productPreview, orderGroups, deliveryGroups, globalCategories, supplierCategories] = await Promise.all([
        outlet
            ? ctx.prisma.supplierOutletLink.findFirst({
                where: { supplierOrgId: supplier.id, outletId: outlet.id, deletedAt: null },
                select: { id: true, status: true },
            })
            : Promise.resolve(null),
        ctx.prisma.organizationReview.aggregate({
            where: { organizationId: supplier.id, deletedAt: null },
            _avg: { rating: true },
            _count: { _all: true },
        }),
        ctx.prisma.supplierItem.count({ where: productWhere }),
        ctx.prisma.supplierItem.findMany({
            where: productWhere,
            orderBy: { updatedAt: 'desc' },
            take: 6,
            select: {
                id: true,
                name: true,
                image: true,
                unit: true,
                moq: true,
                globalCategory: { select: { name: true } },
                category: { select: { name: true } },
            },
        }),
        ctx.prisma.purchaseOrder.groupBy({
            by: ['status'],
            where: { supplierOrgId: supplier.id },
            _count: { _all: true },
        }),
        ctx.prisma.delivery.groupBy({
            by: ['status'],
            where: { po: { supplierOrgId: supplier.id } },
            _count: { _all: true },
        }),
        ctx.prisma.category.findMany({
            where: { status: 'ACTIVE', deletedAt: null, items: { some: productWhere } },
            orderBy: { name: 'asc' },
            take: 12,
            select: { name: true },
        }),
        ctx.prisma.supplierItemCategory.findMany({
            where: {
                catalog: { organizationId: supplier.id },
                isActive: true,
                deletedAt: null,
                items: { some: { isActive: true, deletedAt: null, marketplaceListing: { status: 'PUBLISHED', deletedAt: null } } },
            },
            orderBy: { name: 'asc' },
            take: 12,
            select: { name: true },
        }),
    ]);
    const orderCount = (statuses) => orderGroups
        .filter((row) => statuses.includes(row.status))
        .reduce((sum, row) => sum + row._count._all, 0);
    const deliveryCount = (statuses) => deliveryGroups
        .filter((row) => statuses.includes(row.status))
        .reduce((sum, row) => sum + row._count._all, 0);
    const successfulOrders = orderCount(['COMPLETED']);
    const eligibleTerminalOrders = orderCount(['COMPLETED', 'REJECTED', 'CANCELLED']);
    const completedDeliveries = deliveryCount(['DELIVERED']);
    const eligibleTerminalDeliveries = deliveryCount(['DELIVERED', 'FAILED']);
    const categories = Array.from(new Set([...globalCategories, ...supplierCategories].map((category) => category.name))).slice(0, 12);
    return {
        id: supplier.id,
        name: supplier.name,
        profileImage: supplier.profileImg ?? supplier.profilePhoto ?? null,
        bannerImage: supplier.bannerImg,
        location: supplier.location,
        contactNumber: supplier.contactNumber,
        bio: supplier.bio,
        verificationStatus: supplier.verificationStatus,
        memberSince: supplier.createdAt,
        relationshipId: link?.id ?? null,
        relationshipStatus: link ? canonicalSupplierLinkStatus(link.status) : null,
        outletId: outlet?.id ?? null,
        outletName: outlet?.name ?? null,
        categories,
        productPreview: productPreview.map((item) => ({
            id: item.id,
            name: item.name,
            image: item.image,
            unit: item.unit,
            moq: item.moq,
            category: item.globalCategory?.name ?? item.category?.name ?? null,
        })),
        metrics: {
            overallRating: reviewAggregate._count._all > 0 ? Number((reviewAggregate._avg.rating ?? 0).toFixed(2)) : null,
            reviewCount: reviewAggregate._count._all,
            activeProducts: activeProductCount,
            successfulOrders,
            eligibleTerminalOrders,
            orderCompletionRate: percentage(successfulOrders, eligibleTerminalOrders),
            completedDeliveries,
            eligibleTerminalDeliveries,
            deliveryCompletionRate: percentage(completedDeliveries, eligibleTerminalDeliveries),
        },
    };
}
