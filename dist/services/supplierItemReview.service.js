function normalizeRating(rating) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Rating must be an integer from 1 to 5.');
    }
    return rating;
}
async function hasVerifiedPurchase(prisma, supplierItemId, reviewerOrgId) {
    const po = await prisma.purchaseOrder.findFirst({
        where: {
            buyerOrgId: reviewerOrgId,
            status: 'DELIVERED',
            lineItems: { some: { supplierItemId } },
        },
        select: { id: true },
    });
    return Boolean(po);
}
export async function getSupplierItemReviewAggregate(prisma, supplierItemId) {
    const reviews = await prisma.supplierItemReview.findMany({
        where: { supplierItemId, deletedAt: null },
        select: { rating: true, isVerifiedPurchase: true },
    });
    const reviewCount = reviews.length;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return {
        averageRating: reviewCount > 0 ? Number((total / reviewCount).toFixed(2)) : 0,
        reviewCount,
        verifiedCount: reviews.filter((review) => review.isVerifiedPurchase).length,
        breakdown: [5, 4, 3, 2, 1].map((rating) => ({
            rating,
            count: reviews.filter((review) => review.rating === rating).length,
        })),
    };
}
export async function listSupplierItemReviews(prisma, supplierItemId) {
    const [reviews, aggregate] = await Promise.all([
        prisma.supplierItemReview.findMany({
            where: { supplierItemId, deletedAt: null },
            include: { reviewer: true },
            orderBy: { createdAt: 'desc' },
        }),
        getSupplierItemReviewAggregate(prisma, supplierItemId),
    ]);
    return { reviews, aggregate };
}
export async function createSupplierItemReview(prisma, input) {
    const rating = normalizeRating(input.rating);
    const verified = await hasVerifiedPurchase(prisma, input.supplierItemId, input.reviewerOrgId);
    if (!verified) {
        throw new Error('Only verified buyers with a delivered purchase can review this product.');
    }
    const existing = await prisma.supplierItemReview.findFirst({
        where: {
            supplierItemId: input.supplierItemId,
            reviewerOrgId: input.reviewerOrgId,
            deletedAt: null,
        },
        select: { id: true },
    });
    if (existing) {
        throw new Error('This organization has already reviewed this product.');
    }
    return prisma.supplierItemReview.create({
        data: {
            supplierItemId: input.supplierItemId,
            reviewerOrgId: input.reviewerOrgId,
            rating,
            title: input.title,
            comment: input.comment,
            isVerifiedPurchase: verified,
        },
        include: { reviewer: true },
    });
}
export async function updateSupplierItemReview(prisma, input) {
    const review = await prisma.supplierItemReview.findFirst({
        where: { id: input.id, reviewerOrgId: input.reviewerOrgId, deletedAt: null },
    });
    if (!review)
        throw new Error('Review not found.');
    return prisma.supplierItemReview.update({
        where: { id: input.id },
        data: {
            rating: input.rating == null ? undefined : normalizeRating(input.rating),
            title: input.title,
            comment: input.comment,
        },
        include: { reviewer: true },
    });
}
export async function deleteSupplierItemReview(prisma, id, reviewerOrgId) {
    const review = await prisma.supplierItemReview.findFirst({
        where: { id, reviewerOrgId, deletedAt: null },
    });
    if (!review)
        throw new Error('Review not found.');
    return prisma.supplierItemReview.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: { reviewer: true },
    });
}
