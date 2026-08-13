import { enumType, objectType, inputObjectType } from 'nexus';
export const ProcurementInvitationStatus = enumType({
    name: 'ProcurementInvitationStatus',
    members: ['PENDING', 'USED', 'EXPIRED', 'REVOKED', 'ACCEPTED', 'REJECTED'],
});
export const ProcurementAgentRequestStatus = enumType({
    name: 'ProcurementAgentRequestStatus',
    members: ['PENDING', 'APPROVED', 'REJECTED'],
});
export const ProcurementInvitation = objectType({
    name: 'ProcurementInvitation',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('orgId');
        t.nullable.string('email');
        t.nullable.string('code');
        t.nullable.string('link');
        t.nullable.string('positionId');
        t.nonNull.field('status', { type: 'ProcurementInvitationStatus' });
        t.nullable.dateTime('expiresAt');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nullable.dateTime('revokedAt');
        t.nullable.int('acceptedByUserId');
        // New fields for agent registration flow
        t.nullable.string('usedByAgentId');
        t.nullable.dateTime('usedAt');
        t.nullable.dateTime('approvedAt');
        t.nullable.int('approvedBy');
        t.nullable.int('rejectedBy');
        t.nullable.string('rejectionReason');
        t.nullable.field('usedByAgent', { type: 'Agent' });
        t.nonNull.field('organization', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.procurementInvitation.findUnique({ where: { id: parent.id } }).Organization(),
        });
        t.nullable.field('position', {
            type: 'Position',
            resolve: (parent, _, ctx) => ctx.prisma.procurementInvitation.findUnique({ where: { id: parent.id } }).Position(),
        });
        t.nullable.field('acceptedByUser', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                if (!parent.acceptedByUserId)
                    return null;
                return ctx.prisma.procurementInvitation.findUnique({ where: { id: parent.id } }).User();
            },
        });
    },
});
export const ProcurementAgentRequest = objectType({
    name: 'ProcurementAgentRequest',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('orgId');
        t.nonNull.string('agentId');
        t.nullable.string('message');
        t.field('status', { type: 'ProcurementAgentRequestStatus' });
        t.nullable.int('reviewedById');
        t.nullable.dateTime('reviewedAt');
        t.nullable.string('reviewNotes');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
        t.nullable.dateTime('deletedAt');
        t.nonNull.field('organization', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.procurementAgentRequest.findUnique({ where: { id: parent.id } }).Organization(),
        });
        t.nonNull.field('agent', {
            type: 'Agent',
            resolve: (parent, _, ctx) => ctx.prisma.procurementAgentRequest.findUnique({ where: { id: parent.id } }).Agent(),
        });
        t.nullable.field('reviewedBy', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                if (!parent.reviewedById)
                    return null;
                return ctx.prisma.user.findUnique({ where: { id: parent.reviewedById } });
            },
        });
    },
});
export const ProcurementAgentWorkspace = objectType({
    name: 'ProcurementAgentWorkspace',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('fullname');
        t.nonNull.string('email');
        t.nullable.string('phone');
        t.field('status', { type: 'ProcurementInvitationStatus' });
        t.nullable.string('positionName');
        t.nullable.dateTime('acceptedAt');
        t.nullable.dateTime('expiresAt');
        t.nullable.string('organizationName');
        t.nullable.string('organizationLogo');
        t.nullable.int('assignedOrgCount');
        t.nullable.int('pendingRequestsCount');
    },
});
export const InviteProcurementAgentInput = inputObjectType({
    name: 'InviteProcurementAgentInput',
    definition(t) {
        t.string('email');
        t.string('positionId');
        t.int('expiresInDays');
    },
});
export const GenerateInvitationInput = inputObjectType({
    name: 'GenerateInvitationInput',
    definition(t) {
        t.string('positionId');
        t.int('expiresInDays');
    },
});
export const ValidateInvitationInput = inputObjectType({
    name: 'ValidateInvitationInput',
    definition(t) {
        t.string('code');
        t.string('link');
    },
});
export const AcceptInvitationInput = inputObjectType({
    name: 'AcceptInvitationInput',
    definition(t) {
        t.nonNull.string('invitationId');
        t.nonNull.string('userId');
    },
});
export const RequestDocumentsInput = inputObjectType({
    name: 'RequestDocumentsInput',
    definition(t) {
        t.nonNull.string('requestId');
        t.nonNull.list.nonNull.field('documentTypes', { type: 'DocumentType' });
        t.string('notes');
    },
});
// Extended Invitation type with more details for HR view
export const ProcurementInvitationDetails = objectType({
    name: 'ProcurementInvitationDetails',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('orgId');
        t.nullable.string('email');
        t.nullable.string('code');
        t.nullable.string('link');
        t.nullable.string('positionId');
        t.nonNull.field('status', { type: 'ProcurementInvitationStatus' });
        t.nullable.dateTime('expiresAt');
        t.nonNull.dateTime('createdAt');
        t.nullable.dateTime('updatedAt');
        t.nullable.dateTime('revokedAt');
        t.nullable.int('acceptedByUserId');
        // New fields for agent registration flow
        t.nullable.string('usedByAgentId');
        t.nullable.dateTime('usedAt');
        t.nullable.dateTime('approvedAt');
        t.nullable.int('approvedBy');
        t.nullable.int('rejectedBy');
        t.nullable.string('rejectionReason');
        t.nullable.field('usedByAgent', { type: 'Agent' });
        // Relations
        t.nonNull.field('organization', {
            type: 'Organization',
            resolve: (parent, _, ctx) => ctx.prisma.procurementInvitation.findUnique({ where: { id: parent.id } }).Organization(),
        });
        t.nullable.field('position', {
            type: 'Position',
            resolve: (parent, _, ctx) => ctx.prisma.procurementInvitation.findUnique({ where: { id: parent.id } }).Position(),
        });
        t.nullable.field('invitedBy', {
            type: 'User',
            resolve: (parent, _, ctx) => ctx.prisma.procurementInvitation.findUnique({ where: { id: parent.id } }).User(),
        });
    },
});
// ============================================
// Pending Agent type for HR Pending Requests tab
// ============================================
export const PendingAgent = objectType({
    name: 'PendingAgent',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.string('agentId');
        t.nonNull.field('status', { type: 'AgentStatus' });
        t.nonNull.string('invitationId');
        t.nullable.string('position');
        t.nullable.string('positionId');
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('submittedAt');
        t.nullable.field('agent', { type: 'Agent' });
        t.nullable.field('invitation', { type: 'ProcurementInvitation' });
        t.nullable.field('invitedBy', { type: 'User' });
        t.nullable.field('organization', { type: 'Organization' });
    },
});
export const AgentDetailsInvitation = objectType({
    name: 'AgentDetailsInvitation',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.int('orgId');
        t.nonNull.string('orgName');
        t.nullable.string('orgLogo');
        t.nullable.string('orgAddress');
        t.nullable.string('positionId');
        t.nullable.string('positionName');
        t.nonNull.field('status', { type: 'ProcurementInvitationStatus' });
        t.nullable.dateTime('expiresAt');
        t.nullable.dateTime('usedAt');
    },
});
// ============================================
// Agent Details type for HR modal
// ============================================
export const AgentDetails = objectType({
    name: 'AgentDetails',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.field('agentType', { type: 'AgentType' });
        t.nonNull.field('status', { type: 'AgentStatus' });
        t.nonNull.string('email');
        t.nullable.string('phone');
        t.nonNull.string('fullname');
        t.nonNull.string('verificationStatus');
        t.nonNull.dateTime('submittedAt');
        t.nonNull.field('personalInfo', { type: 'PersonalInfo' });
        t.nonNull.field('preferences', { type: 'AgentPreferences' });
        t.nonNull.list.nonNull.field('verifications', { type: 'AgentVerification' });
        t.nullable.field('invitation', { type: 'AgentDetailsInvitation' });
        t.nullable.field('organization', { type: 'Organization' });
    },
});
export const PersonalInfo = objectType({
    name: 'PersonalInfo',
    definition(t) {
        t.nullable.dateTime('dateOfBirth');
        t.nullable.string('gender');
        t.nullable.string('address');
        t.nullable.string('city');
        t.nullable.string('province');
        t.nullable.string('zipCode');
        t.nullable.string('civilStatus');
        t.nullable.string('emergencyContact');
    },
});
export const AgentPreferences = objectType({
    name: 'AgentPreferences',
    definition(t) {
        t.nonNull.list.field('interestedIndustries', { type: 'String' });
        t.nonNull.string('experienceLevel');
    },
});
// ============================================
// Organization Agent type (approved agents only)
// Source of truth: Agent table
// ============================================
export const OrganizationAgent = objectType({
    name: 'OrganizationAgent',
    definition(t) {
        t.nonNull.string('id');
        t.nonNull.field('agentType', { type: 'AgentType' });
        t.nonNull.int('organizationId');
        t.nonNull.string('email');
        t.nullable.string('phone');
        t.nonNull.string('fullname');
        t.nonNull.string('verificationStatus');
        t.nonNull.string('trustTier');
        t.nonNull.field('status', { type: 'AgentStatus' });
        t.nullable.string('address');
        t.nullable.dateTime('birthday');
        t.nullable.string('city');
        t.nullable.string('province');
        t.nullable.string('zipCode');
        t.nullable.string('civilStatus');
        t.nullable.string('emergencyContact');
        t.nonNull.string('experienceLevel');
        t.nullable.string('gender');
        t.nonNull.list.field('interestedIndustries', { type: 'String' });
        t.nullable.string('positionId');
        t.nullable.string('positionName');
        t.nullable.string('invitationId');
        t.nullable.string('invitationStatus');
        t.nullable.field('agent', { type: 'Agent' });
        t.nullable.field('organization', { type: 'Organization' });
        t.nonNull.list.nonNull.field('verifications', { type: 'AgentVerification' });
        t.nonNull.dateTime('createdAt');
        t.nonNull.dateTime('updatedAt');
    },
});
export const UpdateOrganizationAgentInput = inputObjectType({
    name: 'UpdateOrganizationAgentInput',
    definition(t) {
        t.string('fullname');
        t.string('phone');
        t.string('address');
        t.string('city');
        t.string('province');
        t.string('zipCode');
        t.nullable.dateTime('birthday');
        t.nullable.string('gender');
        t.nullable.string('civilStatus');
        t.nullable.string('emergencyContact');
        t.string('experienceLevel');
        t.list.field('interestedIndustries', { type: 'String' });
        t.string('positionId');
    },
});
