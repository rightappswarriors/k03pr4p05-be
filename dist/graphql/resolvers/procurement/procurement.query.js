import { extendType, arg } from 'nexus';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js';
const assertSupplierOrg = (ctx) => {
    requireAuth(ctx);
    requireRole(ctx, ['OWNER', 'STAFF']);
    PAGE_PERMISSIONS.hr.view(ctx);
    return ctx.user;
};
export const procurementQuery = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.list.nonNull.field('procurementAgents', {
            type: 'ProcurementAgentWorkspace',
            args: {
                status: arg({ type: 'ProcurementInvitationStatus' }),
            },
            resolve: async (_, { status }, ctx) => {
                const user = assertSupplierOrg(ctx);
                const orgId = Number(user.orgId);
                // Get all invitations for this organization (active agents)
                // Get all invitations for this organization (active agents)
                const agents = await ctx.prisma.Agent.findMany({
                    where: {
                        orgId,
                        verificationStatus: status || undefined,
                        deletedAt: null,
                    },
                    include: {
                        organization: true,
                        position: true,
                    },
                    orderBy: { createdAt: 'desc' },
                });
                // Transform to workspace format
                return agents.map((agent) => ({
                    id: agent.id,
                    fullname: agent.email || 'Invited Agent',
                    email: agent.email,
                    phone: null,
                    verificationStatus: agent.status,
                    positionName: agent.position?.name || null,
                    acceptedAt: agent.expiresAt,
                    expiresAt: agent.expiresAt,
                    organizationName: agent.organization?.name || null,
                    organizationLogo: agent.organization?.profileImg || null,
                    assignedOrgCount: 0,
                    pendingRequestsCount: 0,
                }));
            },
        });
        t.nonNull.list.nonNull.field('pendingAgentRequests', {
            type: 'ProcurementAgentRequest',
            args: {
                status: arg({ type: 'ProcurementAgentRequestStatus' }),
            },
            resolve: async (_, { status }, ctx) => {
                const user = assertSupplierOrg(ctx);
                const orgId = Number(user.orgId);
                return ctx.prisma.procurementAgentRequest.findMany({
                    where: {
                        orgId,
                        status: status || undefined,
                        deletedAt: null,
                    },
                    include: {
                        Agent: true,
                        Organization: true,
                    },
                    orderBy: { createdAt: 'desc' },
                });
            },
        });
        t.nonNull.list.nonNull.field('organizationInvitations', {
            type: 'ProcurementInvitation',
            args: {
                status: arg({ type: 'ProcurementInvitationStatus' }),
            },
            resolve: async (_, { status }, ctx) => {
                const user = assertSupplierOrg(ctx);
                const orgId = Number(user.orgId);
                return ctx.prisma.procurementInvitation.findMany({
                    where: {
                        orgId,
                        status: status || undefined,
                        deletedAt: null,
                    },
                    include: {
                        Position: true,
                        Organization: true,
                    },
                    orderBy: { createdAt: 'desc' },
                });
            },
        });
    },
});
