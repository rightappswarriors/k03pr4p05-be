import { extendType, nonNull, stringArg, list, objectType, inputObjectType, intArg, arg } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { validateOrganizationInvitation, approveProcurementAgent, rejectProcurementAgent, updateOrganizationAgent, rejectOrganizationAgent } from '../../../services/procurementAgentService.js';
export const ApproveOrganizationAgentResponse = objectType({
  name: 'ApproveOrRejectOrganizationAgentResponse',
  definition(t) {
    t.nonNull.boolean('success');
    t.nonNull.string('membershipId');
    t.nonNull.string('agentId');
    t.nonNull.string('invitationId');
    t.nonNull.string('status');
  },
});


export const ProcurementInvitationDetails = objectType({
  name: 'ValidationProcurementInvitationDetails',
  definition(t) {
    t.nonNull.string('id');
    t.nonNull.string('orgId');
    t.nonNull.string('orgName');

    t.string('orgLogo');
    t.string('orgAddress');

    t.nonNull.string('invitedPositionId');
    t.nonNull.string('invitedPositionName');

    t.string('invitedByName');
    t.string('invitedByEmail');

    t.nonNull.field('expiresAt', {
      type: 'DateTime',
    });
  },
});

export const ValidateProcurementInvitationResponse = objectType({
  name: 'ValidateProcurementInvitationResponse',
  definition(t) {
    t.nonNull.boolean('valid');

    t.field('invitation', {
      type: 'ValidationProcurementInvitationDetails',
    });
  },
});

export const procurementAgentMutation = extendType({
    type: 'Mutation',
    definition(t) {
        // ============================================
        // Validate Invitation (Step 3B)
        // ============================================
        t.field('validateOrganizationInvitation', {
            type: 'ValidateProcurementInvitationResponse',
            args: {
                codeOrLink: nonNull(stringArg()),
            },
            resolve: async (_, { codeOrLink }, ctx) => {
                requireAuth(ctx);
                return validateOrganizationInvitation(codeOrLink);
            },
        });

        // ============================================
        // Approve Organization Agent (HR Action)
        // Creates OrganizationMembership, updates Agent.status = ACTIVE,
        // sets Agent.organizationId, updates invitation to ACCEPTED
        // ============================================
        t.nonNull.field('approveOrganizationAgent', {
            type: 'ApproveOrRejectOrganizationAgentResponse',
            args: {
                agentId: nonNull(stringArg()),
            },
            resolve: async (_, { agentId }, ctx) => {
                requireAuth(ctx);
                const approverId = ctx.user?.userId;
                if (!approverId) throw new Error('Approver ID is required');
                logDev('Mutation approveOrganizationAgent', { agentId, approverId });
                return approveProcurementAgent(agentId, Number(approverId));
            },
        });

        // ============================================
        // Reject Organization Agent (HR Action)
        // Updates Agent.status = REJECTED, invitation to REJECTED
        // ============================================
        t.nonNull.field('rejectOrganizationAgent', {
            type: 'ApproveOrRejectOrganizationAgentResponse',
            args: {
                agentId: nonNull(stringArg()),
                reason: nonNull(stringArg()),
            },
            resolve: async (_, { agentId, reason }, ctx) => {
                requireAuth(ctx);
                logDev('Mutation rejectOrganizationAgent', { agentId, reason });
                return rejectProcurementAgent(agentId, reason);
            },
        });

        // ============================================
        // Update Organization Agent (HR Action)
        // Updates editable fields on an APPROVED agent
        // Runs inside a Prisma transaction
        // ============================================
        t.nonNull.field('updateOrganizationAgent', {
            type: 'OrganizationAgent',
            args: {
                agentId: nonNull(stringArg()),
                input: nonNull(arg({ type: 'UpdateOrganizationAgentInput' })),
            },
            resolve: async (_, { agentId, input }, ctx) => {
                requireAuth(ctx);
                const updaterId = ctx.user?.userId;
                if (!updaterId) throw new Error('Updater ID is required');
                logDev('Mutation updateOrganizationAgent', { agentId, input, updaterId });
                return updateOrganizationAgent(agentId, input, Number(updaterId));
            },
        });

        // ============================================
        // Reject Approved Organization Agent (HR Action)
        // Changes Agent.verificationStatus = REJECTED
        // Does NOT delete the agent
        // ============================================
        t.nonNull.field('rejectApprovedOrganizationAgent', {
            type: 'OrganizationAgent',
            args: {
                agentId: nonNull(stringArg()),
                reason: nonNull(stringArg()),
            },
            resolve: async (_, { agentId, reason }, ctx) => {
                requireAuth(ctx);
                const rejectedBy = ctx.user?.userId;
                if (!rejectedBy) throw new Error('RejectedBy ID is required');
                logDev('Mutation rejectApprovedOrganizationAgent', { agentId, reason, rejectedBy });
                return rejectOrganizationAgent(agentId, reason, Number(rejectedBy));
            },
        });

        // ============================================
        // Request Additional Documents (HR Action)
        // ============================================
        //t.field('requestAdditionalDocuments', {
        //    type: 'Json',
        /*    args: {
                membershipId: nonNull(stringArg()),
                documentTypes: nonNull(list(nonNull(stringArg()))),
            },
            resolve: async (_, { membershipId, documentTypes }, ctx) => {
                requireAuth(ctx);
                return requestAdditionalDocuments(membershipId, documentTypes);
            },
        });*/
    },
});

function logDev(message: string, data?: any) {
  if (process.env.NODE_ENV === 'development' || process.env.DEVELOPMENT === 'true') {
    console.log(`[Portal HR] ${message}`, data ?? '');
  }
}
