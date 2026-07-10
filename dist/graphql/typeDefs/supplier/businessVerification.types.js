// src/graphql/typeDefs/supplier/businessVerification.types.ts
import { objectType, inputObjectType, enumType, extendType, arg, nonNull, nullable, intArg, stringArg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
import * as verificationService from '../../../services/verification.service.js';
// ─────────────────────────────────────────────────────────────
// ENUMS (mirrors schema.prisma — keep in sync)
// ─────────────────────────────────────────────────────────────
export const OrgVerificationStatus = enumType({
    name: 'OrgVerificationStatus',
    members: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'EXPIRED'],
});
// ─────────────────────────────────────────────────────────────
// OBJECT TYPES
// ─────────────────────────────────────────────────────────────
export const VerificationRequirement = objectType({
    name: 'VerificationRequirement',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.field('documentType', { type: 'DocumentType' });
        t.nonNull.string('label');
        t.nullable.string('description');
        t.nonNull.boolean('isRequired');
        t.nullable.int('validityDays');
        t.nonNull.list.nonNull.int('reminderDaysBefore');
        t.nonNull.boolean('isActive');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
    },
});
export const VerificationReviewHistory = objectType({
    name: 'VerificationReviewHistory',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('documentId');
        t.nonNull.field('status', { type: 'VerificationStatus' });
        t.nullable.string('remarks');
        t.nullable.int('reviewedById');
        t.nonNull.dateTime('reviewedAt');
    },
});
export const BusinessVerificationDocument = objectType({
    name: 'BusinessVerificationDocument',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('orgId');
        t.nonNull.string('requirementId');
        t.nonNull.field('documentType', { type: 'DocumentType' });
        t.nonNull.string('fileUrl');
        t.nonNull.string('filePath');
        t.nonNull.field('status', { type: 'VerificationStatus' });
        t.nonNull.dateTime('uploadedAt');
        t.nullable.dateTime('approvedAt');
        t.nullable.dateTime('expiresAt');
        t.nullable.int('reviewedById');
        t.nullable.dateTime('reviewedAt');
        t.nullable.string('adminRemarks');
        t.nonNull.boolean('isSuperseded');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nonNull.field('requirement', {
            type: 'VerificationRequirement',
            resolve: (parent, _args, ctx) => ctx.prisma.verificationRequirement.findUniqueOrThrow({ where: { id: parent.requirementId } }),
        });
        t.nonNull.list.nonNull.field('reviews', {
            type: 'VerificationReviewHistory',
            resolve: (parent, _args, ctx) => ctx.prisma.verificationReviewHistory.findMany({
                where: { documentId: parent.id },
                orderBy: { reviewedAt: 'desc' },
            }),
        });
    },
});
export const VerificationDashboard = objectType({
    name: 'VerificationDashboard',
    definition(t) {
        t.nonNull.field('orgVerificationStatus', { type: 'OrgVerificationStatus' });
        t.nullable.dateTime('verificationExpiresAt');
        t.nonNull.int('requiredCount');
        t.nonNull.int('submittedCount');
        t.nonNull.int('approvedCount');
        t.nonNull.int('rejectedCount');
        t.nonNull.float('progressPct');
        t.nonNull.list.nonNull.field('requirements', { type: 'VerificationRequirement' });
        t.nonNull.list.nonNull.field('documents', { type: 'BusinessVerificationDocument' });
    },
});
// ─────────────────────────────────────────────────────────────
// INPUTS
// ─────────────────────────────────────────────────────────────
export const UploadVerificationDocumentInput = inputObjectType({
    name: 'UploadVerificationDocumentInput',
    definition(t) {
        t.nonNull.int('orgId');
        t.nonNull.string('requirementId');
        t.nonNull.field('documentType', { type: 'DocumentType' });
        t.nonNull.string('fileUrl'); // already-uploaded via MediaService on the client
        t.nonNull.string('filePath');
    },
});
// ─────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────
export const businessVerificationQuery = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.field('verificationDashboard', {
            type: 'VerificationDashboard',
            args: { orgId: nonNull(intArg()) },
            resolve: async (_parent, { orgId }, ctx) => {
                requireAuth(ctx);
                // TODO: confirm 'verification' key exists in permissions.map.js — add it if not.
                PAGE_PERMISSIONS.verification?.view?.(ctx);
                //      requireAny(ctx, PAGE_PERMISSIONS.verification.view)
                return verificationService.getVerificationDashboard(ctx.prisma, orgId);
            },
        });
        t.nonNull.list.nonNull.field('verificationDocuments', {
            type: 'BusinessVerificationDocument',
            args: { orgId: nonNull(intArg()) },
            resolve: async (_parent, { orgId }, ctx) => {
                requireAuth(ctx);
                PAGE_PERMISSIONS.verification?.view?.(ctx);
                return verificationService.listVerificationDocuments(ctx.prisma, orgId);
            },
        });
        t.nonNull.list.nonNull.field('verificationRequirementsList', {
            type: 'VerificationRequirement',
            resolve: async (_parent, _args, ctx) => {
                requireAuth(ctx);
                return verificationService.listVerificationRequirements(ctx.prisma);
            },
        });
    },
});
// ─────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────
export const businessVerificationMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('uploadVerificationDocument', {
            type: 'BusinessVerificationDocument',
            args: {
                input: nonNull(arg({ type: 'UploadVerificationDocumentInput' })),
            },
            resolve: async (_parent, { input }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'OWNER', 'STAFF']); // supplier-side submitter roles
                PAGE_PERMISSIONS.verification?.create?.(ctx);
                return verificationService.uploadVerificationDocument(ctx.prisma, input);
            },
        });
        t.nonNull.field('deleteVerificationDocument', {
            type: 'BusinessVerificationDocument',
            args: { id: nonNull(stringArg()) },
            resolve: async (_parent, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN', 'OWNER', 'STAFF']);
                PAGE_PERMISSIONS.verification?.delete?.(ctx);
                return verificationService.deleteVerificationDocument(ctx.prisma, id);
            },
        });
        t.nonNull.field('reviewVerificationDocument', {
            type: 'BusinessVerificationDocument',
            args: {
                id: nonNull(stringArg()),
                status: nonNull(arg({ type: 'VerificationStatus' })),
                remarks: nullable(stringArg()),
                reviewedById: nullable(intArg()),
            },
            resolve: async (_parent, { id, status, remarks, reviewedById }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN']); // platform admin review only — not the supplier themselves
                return verificationService.reviewVerificationDocument(ctx.prisma, {
                    id,
                    status,
                    remarks,
                    reviewedById,
                });
            },
        });
        t.nonNull.field('runVerificationExpiryCheck', {
            type: 'Int', // count of documents processed
            resolve: async (_parent, _args, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['ADMIN']); // scheduler/admin-triggered only
                return verificationService.runVerificationExpiryCheck(ctx.prisma);
            },
        });
    },
});
