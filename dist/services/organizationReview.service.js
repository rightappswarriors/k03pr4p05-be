function normalizeRating(rating) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('Rating must be an integer from 1 to 5.');
    }
    return rating;
}
async function hasVerifiedTransaction(prisma, organizationId, reviewerOrgId) {
    if (!reviewerOrgId)
        return false;
    const po = await prisma.purchaseOrder.findFirst({
        where: {
            supplierOrgId: organizationId,
            buyerOrgId: reviewerOrgId,
            status: 'DELIVERED',
        },
        select: { id: true },
    });
    return Boolean(po);
}
export async function getOrganizationReviewAggregate(prisma, organizationId) {
    const reviews = await prisma.organizationReview.findMany({
        where: { organizationId, deletedAt: null },
        select: { rating: true, isVerifiedTransaction: true },
    });
    const reviewCount = reviews.length;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return {
        averageRating: reviewCount > 0 ? Number((total / reviewCount).toFixed(2)) : 0,
        reviewCount,
        verifiedCount: reviews.filter((review) => review.isVerifiedTransaction).length,
        breakdown: [5, 4, 3, 2, 1].map((rating) => ({
            rating,
            count: reviews.filter((review) => review.rating === rating).length,
        })),
    };
}
export async function listOrganizationReviews(prisma, organizationId) {
    const [reviews, aggregate] = await Promise.all([
        prisma.organizationReview.findMany({
            where: { organizationId, deletedAt: null },
            include: { reviewer: true },
            orderBy: { createdAt: 'desc' },
        }),
        getOrganizationReviewAggregate(prisma, organizationId),
    ]);
    return { reviews, aggregate };
}
export async function createOrganizationReview(prisma, input) {
    if (input.reviewerOrgId && input.organizationId === input.reviewerOrgId) {
        throw new Error('Organizations cannot review themselves.');
    }
    if (!input.reviewerOrgId && !input.reviewerCustomerId && !input.reviewerName?.trim()) {
        throw new Error('A reviewer organization, customer, or reviewer name is required.');
    }
    const rating = normalizeRating(input.rating);
    const verified = await hasVerifiedTransaction(prisma, input.organizationId, input.reviewerOrgId);
    if (input.reviewerOrgId && !verified) {
        throw new Error('Only verified buyers with a delivered transaction can review this supplier.');
    }
    if (input.reviewerOrgId || input.reviewerCustomerId) {
        const existing = await prisma.organizationReview.findFirst({
            where: {
                organizationId: input.organizationId,
                reviewerOrgId: input.reviewerOrgId ?? undefined,
                reviewerCustomerId: input.reviewerCustomerId ?? undefined,
                deletedAt: null,
            },
            select: { id: true },
        });
        if (existing) {
            throw new Error('This reviewer has already reviewed this supplier.');
        }
    }
    return prisma.organizationReview.create({
        data: {
            organizationId: input.organizationId,
            reviewerOrgId: input.reviewerOrgId ?? undefined,
            reviewerCustomerId: input.reviewerCustomerId ?? undefined,
            reviewerName: input.reviewerName?.trim() || undefined,
            rating,
            title: input.title,
            comment: input.comment,
            isVerifiedTransaction: verified,
        },
        include: { reviewer: true },
    });
}
export async function updateOrganizationReview(prisma, input) {
    const review = await prisma.organizationReview.findFirst({
        where: { id: input.id, reviewerOrgId: input.reviewerOrgId, deletedAt: null },
    });
    if (!review)
        throw new Error('Review not found.');
    return prisma.organizationReview.update({
        where: { id: input.id },
        data: {
            rating: input.rating == null ? undefined : normalizeRating(input.rating),
            title: input.title,
            comment: input.comment,
            reviewerName: input.reviewerName === undefined ? undefined : input.reviewerName?.trim() || null,
        },
        include: { reviewer: true },
    });
}
export async function deleteOrganizationReview(prisma, id, reviewerOrgId) {
    const review = await prisma.organizationReview.findFirst({
        where: { id, reviewerOrgId, deletedAt: null },
    });
    if (!review)
        throw new Error('Review not found.');
    return prisma.organizationReview.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: { reviewer: true },
    });
}
