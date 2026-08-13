// Procurement Invitation resolvers - extends HR module for procurement agent management
import { extendType, stringArg, nonNull, arg, intArg, nullable } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
export const ProcurementInvitationQuery = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.list.nonNull.field('procurementAgents', {
            type: 'ProcurementInvitation',
            args: {
                orgId: nullable(intArg()),
                status: nullable(arg({ type: 'ProcurementInvitationStatus' })),
            },
            resolve: async (parent, { orgId, status }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.view(ctx);
                const targetOrgId = orgId ?? ctx.user.orgId;
                return ctx.prisma.procurementInvitation.findMany({
                    where: {
                        orgId: targetOrgId,
                        deletedAt: null,
                        ...(status && { status }),
                    },
                    include: {
                        position: true,
                    },
                    orderBy: { createdAt: 'desc' },
                });
            },
        });
        t.nonNull.list.nonNull.field('organizationInvitations', {
            type: 'ProcurementInvitation',
            args: {
                status: nullable(arg({ type: 'ProcurementInvitationStatus' })),
            },
            resolve: async (parent, { status }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.view(ctx);
                return ctx.prisma.procurementInvitation.findMany({
                    where: {
                        orgId: ctx.user.orgId,
                        deletedAt: null,
                        ...(status && { status }),
                    },
                    include: {
                        position: true,
                    },
                    orderBy: { createdAt: 'desc' },
                });
            },
        });
        t.nonNull.list.nonNull.field('pendingAgentRequests', {
            type: 'ProcurementAgentRequest',
            args: {
                status: nullable(arg({ type: 'ProcurementAgentRequestStatus' })),
            },
            resolve: async (parent, { status }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.view(ctx);
                return ctx.prisma.procurementAgentRequest.findMany({
                    where: {
                        orgId: ctx.user.orgId,
                        deletedAt: null,
                        ...(status && { status }),
                    },
                    include: {
                        agent: true,
                    },
                    orderBy: { createdAt: 'desc' },
                });
            },
        });
    },
});
export const ProcurementInvitationMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('inviteProcurementAgent', {
            type: 'ProcurementInvitation',
            args: {
                input: nonNull(arg({ type: 'InviteProcurementAgentInput' })),
            },
            resolve: async (parent, { input }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                PAGE_PERMISSIONS.hr.create(ctx);
                const orgId = Number(ctx.user.orgId);
                const expiresAt = input.expiresInDays
                    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
                    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                const invitation = await ctx.prisma.procurementInvitation.create({
                    data: {
                        orgId,
                        email: input.email,
                        positionId: input.positionId,
                        expiresAt,
                        status: 'PENDING',
                    },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'CREATE',
                        recordId: invitation.id,
                        recordType: 'ProcurementInvitation',
                        newValue: { email: input.email, positionId: input.positionId, expiresAt },
                    },
                });
                return invitation;
            },
        });
        t.nonNull.field('generateInvitation', {
            type: 'ProcurementInvitation',
            args: {
                input: nonNull(arg({ type: 'GenerateInvitationInput' })),
            },
            resolve: async (parent, { input }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                PAGE_PERMISSIONS.hr.create(ctx);
                const orgId = Number(ctx.user.orgId);
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                const link = `${process.env.NEXT_PUBLIC_APP_URL || 'https://portal.kompra.ph'}/register/procurement?code=${code}`;
                const expiresAt = input.expiresInDays && input.expiresInDays > 0
                    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
                    : null;
                const invitation = await ctx.prisma.procurementInvitation.create({
                    data: {
                        orgId,
                        code,
                        link,
                        expiresAt,
                        status: 'PENDING',
                        ...(input.positionId && { positionId: input.positionId }),
                    },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'CREATE',
                        recordId: invitation.id,
                        recordType: 'ProcurementInvitation',
                        newValue: { code, link, expiresAt },
                    },
                });
                return invitation;
            },
        });
        t.nonNull.field('approveProcurementAgent', {
            type: 'ProcurementInvitation',
            args: {
                id: nonNull(stringArg()),
                positionId: nullable(stringArg()),
            },
            resolve: async (parent, { id, positionId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.edit(ctx);
                const orgId = Number(ctx.user.orgId);
                const invitation = await ctx.prisma.procurementInvitation.findUnique({
                    where: { id },
                });
                if (!invitation || invitation.orgId !== orgId) {
                    throw new Error('Invitation not found or access denied');
                }
                const updated = await ctx.prisma.procurementInvitation.update({
                    where: { id },
                    data: {
                        status: 'USED',
                        ...(positionId && { positionId }),
                    },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'STATUS_CHANGE',
                        recordId: id,
                        recordType: 'ProcurementInvitation',
                        newValue: { status: 'USED', positionId },
                    },
                });
                return updated;
            },
        });
        t.nonNull.field('rejectProcurementAgent', {
            type: 'ProcurementInvitation',
            args: {
                id: nonNull(stringArg()),
                reason: nullable(stringArg()),
            },
            resolve: async (parent, { id, reason }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.edit(ctx);
                const orgId = Number(ctx.user.orgId);
                const invitation = await ctx.prisma.procurementInvitation.findUnique({
                    where: { id },
                });
                if (!invitation || invitation.orgId !== orgId) {
                    throw new Error('Invitation not found or access denied');
                }
                const updated = await ctx.prisma.procurementInvitation.update({
                    where: { id },
                    data: {
                        status: 'REVOKED',
                    },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'STATUS_CHANGE',
                        recordId: id,
                        recordType: 'ProcurementInvitation',
                        newValue: { status: 'REVOKED', reason },
                    },
                });
                return updated;
            },
        });
        t.nonNull.field('resendInvitation', {
            type: 'ProcurementInvitation',
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (parent, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.edit(ctx);
                const orgId = Number(ctx.user.orgId);
                const invitation = await ctx.prisma.procurementInvitation.findUnique({
                    where: { id },
                });
                if (!invitation || invitation.orgId !== orgId) {
                    throw new Error('Invitation not found or access denied');
                }
                // Reset expiry and status
                const updated = await ctx.prisma.procurementInvitation.update({
                    where: { id },
                    data: {
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        status: 'PENDING',
                        revokedAt: null,
                    },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'UPDATE',
                        recordId: id,
                        recordType: 'ProcurementInvitation',
                        newValue: { status: 'PENDING', action: 'resend' },
                    },
                });
                return updated;
            },
        });
        t.nonNull.field('revokeInvitation', {
            type: 'ProcurementInvitation',
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (parent, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.delete(ctx);
                const orgId = Number(ctx.user.orgId);
                const invitation = await ctx.prisma.procurementInvitation.findUnique({
                    where: { id },
                });
                if (!invitation || invitation.orgId !== orgId) {
                    throw new Error('Invitation not found or access denied');
                }
                const updated = await ctx.prisma.procurementInvitation.update({
                    where: { id },
                    data: {
                        status: 'REVOKED',
                        revokedAt: new Date(),
                    },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'DELETE',
                        recordId: id,
                        recordType: 'ProcurementInvitation',
                        oldValue: { status: invitation.status },
                        newValue: { status: 'REVOKED' },
                    },
                });
                return updated;
            },
        });
        t.nonNull.field('assignProcurementPosition', {
            type: 'ProcurementInvitation',
            args: {
                id: nonNull(stringArg()),
                positionId: nonNull(stringArg()),
            },
            resolve: async (parent, { id, positionId }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.edit(ctx);
                const orgId = Number(ctx.user.orgId);
                const invitation = await ctx.prisma.procurementInvitation.findUnique({
                    where: { id },
                });
                if (!invitation || invitation.orgId !== orgId) {
                    throw new Error('Invitation not found or access denied');
                }
                const updated = await ctx.prisma.procurementInvitation.update({
                    where: { id },
                    data: { positionId },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'UPDATE',
                        recordId: id,
                        recordType: 'ProcurementInvitation',
                        newValue: { positionId },
                    },
                });
                return updated;
            },
        });
        t.nonNull.field('removeProcurementAgent', {
            type: 'ProcurementInvitation',
            args: {
                id: nonNull(stringArg()),
            },
            resolve: async (parent, { id }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER']);
                PAGE_PERMISSIONS.hr.delete(ctx);
                const orgId = Number(ctx.user.orgId);
                const invitation = await ctx.prisma.procurementInvitation.findUnique({
                    where: { id },
                });
                if (!invitation || invitation.orgId !== orgId) {
                    throw new Error('Invitation not found or access denied');
                }
                const updated = await ctx.prisma.procurementInvitation.update({
                    where: { id },
                    data: {
                        deletedAt: new Date(),
                    },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'DELETE',
                        recordId: id,
                        recordType: 'ProcurementInvitation',
                        oldValue: { status: invitation.status },
                    },
                });
                return updated;
            },
        });
        t.nonNull.field('extendInvitationExpiration', {
            type: 'ProcurementInvitation',
            args: {
                id: nonNull(stringArg()),
                days: nonNull(intArg()),
            },
            resolve: async (parent, { id, days }, ctx) => {
                requireAuth(ctx);
                requireRole(ctx, ['OWNER', 'STAFF']);
                PAGE_PERMISSIONS.hr.edit(ctx);
                const orgId = Number(ctx.user.orgId);
                const invitation = await ctx.prisma.procurementInvitation.findUnique({
                    where: { id },
                });
                if (!invitation || invitation.orgId !== orgId) {
                    throw new Error('Invitation not found or access denied');
                }
                const currentExpires = invitation.expiresAt ? new Date(invitation.expiresAt) : new Date();
                const newExpires = new Date(currentExpires.getTime() + days * 24 * 60 * 60 * 1000);
                const updated = await ctx.prisma.procurementInvitation.update({
                    where: { id },
                    data: {
                        expiresAt: newExpires,
                    },
                });
                await ctx.prisma.auditLog.create({
                    data: {
                        orgId,
                        userId: ctx.user.id,
                        pageKey: 'procurementInvitations',
                        action: 'STATUS_CHANGE',
                        recordId: id,
                        recordType: 'ProcurementInvitation',
                        oldValue: { expiresAt: invitation.expiresAt?.toISOString() },
                        newValue: { expiresAt: newExpires.toISOString() },
                    },
                });
                return updated;
            },
        });
    },
});
