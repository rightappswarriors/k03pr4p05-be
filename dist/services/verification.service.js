// src/services/verification.service.ts
// Prisma-facing business logic for Supplier Verification. Resolvers call
// into this file rather than embedding Prisma calls directly, matching the
// branch.service.js convention used elsewhere in this codebase.
export async function getVerificationDashboard(prisma, orgId) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const requirements = await prisma.verificationRequirement.findMany({
        where: { isActive: true, isRequired: true },
    });
    const documents = await prisma.businessVerificationDocument.findMany({
        where: { orgId, deletedAt: null, isSuperseded: false },
        orderBy: { uploadedAt: 'desc' },
    });
    const submittedCount = documents.length;
    const approvedCount = documents.filter((d) => d.status === 'APPROVED').length;
    const rejectedCount = documents.filter((d) => d.status === 'REJECTED').length;
    const requiredCount = requirements.length;
    const progressPct = requiredCount ? (approvedCount / requiredCount) * 100 : 0;
    return {
        orgVerificationStatus: org.verificationStatus,
        verificationExpiresAt: org.verificationExpiresAt,
        requiredCount,
        submittedCount,
        approvedCount,
        rejectedCount,
        progressPct,
        requirements,
        documents,
    };
}
export async function listVerificationDocuments(prisma, orgId) {
    return prisma.businessVerificationDocument.findMany({
        where: { orgId, deletedAt: null, isSuperseded: false },
        orderBy: { uploadedAt: 'desc' },
    });
}
export async function listVerificationRequirements(prisma) {
    return prisma.verificationRequirement.findMany({
        where: { isActive: true },
        orderBy: { label: 'asc' },
    });
}
/**
 * Records a document submission. The actual file bytes are handled
 * client-side via the existing MediaService before this is called — this
 * only persists the resulting fileUrl/filePath and creates a fresh PENDING
 * row. A resubmission of the same documentType supersedes the prior row
 * instead of overwriting it, preserving document + review history.
 */
export async function uploadVerificationDocument(prisma, input) {
    const { orgId, requirementId, documentType, fileUrl, filePath } = input;
    await prisma.businessVerificationDocument.updateMany({
        where: { orgId, documentType, isSuperseded: false, deletedAt: null },
        data: { isSuperseded: true },
    });
    const doc = await prisma.businessVerificationDocument.create({
        data: { orgId, requirementId, documentType, fileUrl, filePath, status: 'PENDING' },
    });
    await prisma.verificationReviewHistory.create({
        data: { documentId: doc.id, status: 'PENDING', remarks: 'Document submitted' },
    });
    await prisma.organization.update({
        where: { id: orgId },
        data: { verificationStatus: 'PENDING' },
    });
    return doc;
}
/**
 * Deletes a document — only permitted before approval. Enforced here (not
 * just in the UI) since this could be called directly. Caller is expected
 * to have already deleted the underlying file via MediaService before
 * invoking this; this only removes the DB record.
 */
export async function deleteVerificationDocument(prisma, id) {
    const doc = await prisma.businessVerificationDocument.findUniqueOrThrow({ where: { id } });
    if (doc.status === 'APPROVED') {
        throw new Error('Cannot delete an approved document. Contact an administrator to revoke it first.');
    }
    return prisma.businessVerificationDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
}
export async function reviewVerificationDocument(prisma, args) {
    const { id, status, remarks, reviewedById } = args;
    const doc = await prisma.businessVerificationDocument.findUniqueOrThrow({
        where: { id },
        include: { requirement: true },
    });
    const now = new Date();
    const approvedAt = status === 'APPROVED' ? now : null;
    const expiresAt = status === 'APPROVED' && doc.requirement.validityDays
        ? new Date(now.getTime() + doc.requirement.validityDays * 24 * 60 * 60 * 1000)
        : null;
    const updated = await prisma.businessVerificationDocument.update({
        where: { id },
        data: { status, reviewedById, reviewedAt: now, adminRemarks: remarks, approvedAt, expiresAt },
    });
    await prisma.verificationReviewHistory.create({
        data: { documentId: id, status, remarks, reviewedById },
    });
    await recomputeOrgVerificationStatus(prisma, doc.orgId);
    return updated;
}
export async function recomputeOrgVerificationStatus(prisma, orgId) {
    const requiredTypes = await prisma.verificationRequirement.findMany({
        where: { isActive: true, isRequired: true },
        select: { documentType: true },
    });
    const currentDocs = await prisma.businessVerificationDocument.findMany({
        where: { orgId, isSuperseded: false, deletedAt: null },
    });
    const allApproved = requiredTypes.every((r) => currentDocs.some((d) => d.documentType === r.documentType && d.status === 'APPROVED'));
    const earliestExpiry = currentDocs
        .filter((d) => d.status === 'APPROVED' && d.expiresAt)
        .map((d) => d.expiresAt)
        .sort((a, b) => a.getTime() - b.getTime())[0];
    const anyExpired = earliestExpiry ? earliestExpiry.getTime() < Date.now() : false;
    const status = anyExpired ? 'EXPIRED' : allApproved ? 'VERIFIED' : 'PENDING';
    await prisma.organization.update({
        where: { id: orgId },
        data: {
            verificationStatus: status,
            verificationExpiresAt: allApproved ? earliestExpiry ?? null : null,
        },
    });
    return status;
}
/**
 * Intended to run on a daily scheduler — wire this into whatever already
 * triggers RestockSchedule, rather than standing up a second scheduler.
 * Walks all APPROVED documents, flips expired ones, and fires reminder
 * notifications at each requirement's configured reminderDaysBefore
 * thresholds.
 *
 * NOTE: uses NotificationType.ORG_CRITICAL_STOCK as a placeholder — swap
 * to VERIFICATION_EXPIRED / VERIFICATION_REMINDER once those enum members
 * are added to schema.prisma.
 */
export async function runVerificationExpiryCheck(prisma) {
    const now = new Date();
    const approaching = await prisma.businessVerificationDocument.findMany({
        where: { status: 'APPROVED', expiresAt: { not: null }, deletedAt: null },
        include: { requirement: true },
    });
    let processed = 0;
    for (const doc of approaching) {
        const daysLeft = Math.ceil((doc.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) {
            await prisma.businessVerificationDocument.update({
                where: { id: doc.id },
                data: { status: 'REJECTED' }, // functionally "expired" — VerificationStatus has no EXPIRED member
            });
            await recomputeOrgVerificationStatus(prisma, doc.orgId);
            await prisma.notification.create({
                data: {
                    orgId: doc.orgId,
                    type: 'ORG_CRITICAL_STOCK', // TODO: VERIFICATION_EXPIRED
                    title: 'Verification expired',
                    message: `Your ${doc.requirement.label} verification has expired. Please renew to stay visible in retailer searches.`,
                },
            });
            processed++;
            continue;
        }
        if (doc.requirement.reminderDaysBefore.includes(daysLeft)) {
            await prisma.notification.create({
                data: {
                    orgId: doc.orgId,
                    type: 'ORG_CRITICAL_STOCK', // TODO: VERIFICATION_REMINDER
                    title: 'Verification renewal reminder',
                    message: `Your ${doc.requirement.label} verification expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
                },
            });
            processed++;
        }
    }
    return processed;
}
