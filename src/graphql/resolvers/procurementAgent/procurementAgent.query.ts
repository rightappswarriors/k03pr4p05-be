import { extendType, nonNull, intArg, stringArg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { getPendingProcurementAgents, getProcurementAgentDetails, getOrganizationAgents } from '../../../services/procurementAgentService.js';

export const procurementAgentQuery = extendType({
    type: 'Query',
    definition(t) {
        // ============================================
        // Get Pending Procurement Agents (HR View)
        // Queries ProcurementInvitation.usedByAgentId where
        // status == USED and Agent.status == PENDING_ORGANIZATION_APPROVAL
        // ============================================
        t.nonNull.list.nonNull.field('pendingProcurementAgents', {
            type: 'PendingAgent',
            args: {
                orgId: nonNull(intArg()),
            },
            resolve: async (_, { orgId }, ctx) => {
                requireAuth(ctx);
                logDev('Query pendingProcurementAgents', { orgId });
                return getPendingProcurementAgents(orgId);
            },
        });

        // ============================================
        // Get Approved Organization Agents
        // Queries Agent table directly - source of truth
        // Only returns agents with verificationStatus === APPROVED
        // and organizationId === orgId
        // ============================================
        t.nonNull.list.nonNull.field('organizationAgents', {
            type: 'OrganizationAgent',
            args: {
                orgId: nonNull(intArg()),
            },
            resolve: async (_, { orgId }, ctx) => {
                requireAuth(ctx);
                logDev('Query organizationAgents', { orgId });
                return getOrganizationAgents(orgId);
            },
        });

        // ============================================
        // Get Procurement Agent Details (for HR modal)
        // ============================================
        t.nullable.field('organizationAgentDetails', {
            type: 'AgentDetails',
            args: {
                agentId: nonNull(stringArg()),
            },
            resolve: async (_, { agentId }, ctx) => {
                requireAuth(ctx);
                logDev('Query organizationAgentDetails', { agentId });
                return getProcurementAgentDetails(agentId);
            },
        });
    },
});

function logDev(message: string, data?: any) {
  if (process.env.NODE_ENV === 'development' || process.env.DEVELOPMENT === 'true') {
    console.log(`[Portal HR] ${message}`, data ?? '');
  }
}
