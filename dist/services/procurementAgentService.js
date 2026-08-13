import { prisma } from '../lib/prisma.js';
// Development logging helper
const logDev = (message, data) => {
    if (process.env.NODE_ENV === "development" || process.env.DEVELOPMENT === "true") {
        console.log(`[Portal HR] ${message}`, data ?? "");
    }
};
// ============================================
// Invitation Validation
// ============================================
export async function validateOrganizationInvitation(codeOrLink) {
    try {
        logDev("Invitation Validation", { codeOrLink });
        const invitation = await prisma.procurementInvitation.findFirst({
            where: {
                OR: [
                    { code: codeOrLink },
                    { link: codeOrLink },
                ],
            },
            include: {
                Organization: {
                    select: {
                        id: true,
                        name: true,
                        profileImg: true,
                        location: true,
                    },
                },
                Position: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                User: {
                    select: {
                        fullname: true,
                        email: true,
                    },
                },
            },
        });
        if (!invitation) {
            logDev("Invitation Invalid - Not Found");
            return { valid: false, error: "Invitation not found" };
        }
        logDev("Invitation Found", { orgId: invitation.orgId });
        if (invitation.status === "USED") {
            logDev("Invitation Already Used");
            return { valid: false, error: "Invitation has already been used" };
        }
        if (invitation.expiresAt && invitation.expiresAt < new Date()) {
            logDev("Invitation Expired");
            return { valid: false, error: "Invitation has expired" };
        }
        if (invitation.status === "REVOKED" || invitation.revokedAt) {
            logDev("Invitation Revoked");
            return { valid: false, error: "Invitation has been revoked" };
        }
        logDev("Invitation Validated Successfully");
        return {
            valid: true,
            invitation: {
                id: invitation.id,
                orgId: invitation.orgId,
                orgName: invitation.Organization?.name || "Unknown Organization",
                orgLogo: invitation.Organization?.profileImg,
                orgAddress: invitation.Organization?.location,
                invitedPositionId: invitation.positionId,
                invitedPositionName: invitation.Position?.name ?? 'undefined',
                invitedByName: invitation.User?.fullname || invitation.User?.email || null,
                invitedByEmail: invitation.email,
                expiresAt: invitation.expiresAt,
            },
        };
    }
    catch (error) {
        logDev("Error validating invitation", { error });
        return { valid: false, error: "Failed to validate invitation" };
    }
}
// ============================================
// Pending Agent Requests (for HR)
// New flow: pending agents are found via ProcurementInvitation.usedByAgentId
// ============================================
export async function getPendingProcurementAgents(orgId) {
    try {
        logDev("Getting Pending Agents via Invitation", { orgId });
        // Query invitations where status=USED, usedByAgentId is set,
        // and the linked Agent has status=PENDING_ORGANIZATION_APPROVAL
        const invitations = await prisma.procurementInvitation.findMany({
            where: {
                orgId,
                status: "USED",
                usedByAgentId: { not: null },
            },
            include: {
                Agent: {
                    include: {
                        verifications: {
                            where: { deletedAt: null },
                            orderBy: { createdAt: "desc" },
                        },
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                profileImg: true,
                                location: true,
                            },
                        },
                    },
                },
                Organization: {
                    select: {
                        id: true,
                        name: true,
                        profileImg: true,
                        location: true,
                    },
                },
                Position: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                User: {
                    select: {
                        fullname: true,
                        email: true,
                    },
                },
            },
            orderBy: { usedAt: "desc" },
        });
        logDev("Pending Invitations Found", { count: invitations.length });
        return invitations
            .filter((inv) => inv.Agent && inv.Agent.status === "PENDING_ORGANIZATION_APPROVAL")
            .map((inv) => {
            const agent = inv.Agent;
            return {
                id: inv.id,
                agentId: agent.id,
                status: agent.status,
                invitationId: inv.id,
                position: inv.Position?.name || null,
                positionId: inv.positionId,
                createdAt: agent.createdAt,
                submittedAt: agent.createdAt,
                agent: {
                    id: agent.id,
                    fullname: agent.fullname,
                    email: agent.email,
                    phone: agent.phone,
                    birthday: agent.birthday,
                    gender: agent.gender,
                    address: agent.address,
                    city: agent.city,
                    province: agent.province,
                    zipCode: agent.zipCode,
                    civilStatus: agent.civilStatus,
                    emergencyContact: agent.emergencyContact,
                    interestedIndustries: agent.interestedIndustries,
                    experienceLevel: agent.experienceLevel,
                    verificationStatus: agent.verificationStatus,
                    verification: agent.verifications.map((v) => ({
                        id: v.id,
                        type: v.documentType,
                        url: v.fileUrl,
                        status: v.status,
                        createdAt: v.createdAt,
                    })),
                    organization: agent.organization
                        ? { id: agent.organization.id, name: agent.organization.name }
                        : null,
                },
                invitation: {
                    id: inv.id,
                    orgId: inv.orgId,
                    code: inv.code,
                    link: inv.link,
                    positionId: inv.positionId,
                    positionName: inv.Position?.name || null,
                    status: inv.status,
                    expiresAt: inv.expiresAt,
                    usedAt: inv.usedAt,
                },
                invitedBy: inv.User
                    ? { fullname: inv.User.fullname, email: inv.User.email }
                    : null,
                organization: inv.Organization
                    ? {
                        id: inv.Organization.id,
                        name: inv.Organization.name,
                        profileImg: inv.Organization.profileImg,
                        location: inv.Organization.location,
                    }
                    : null,
            };
        });
    }
    catch (error) {
        logDev("Error getting pending agents", { error });
        throw new Error("Failed to get pending agent requests");
    }
}
// ============================================
// Agent Approval (HR Action)
// ============================================
export async function approveProcurementAgent(agentId, approverId) {
    try {
        logDev("Approving Agent", { agentId, approverId });
        return await prisma.$transaction(async (tx) => {
            // 1. Get the agent with its invitation
            const agent = await tx.agent.findUnique({
                where: { id: agentId },
                include: {
                    ProcurementInvitation: true,
                },
            });
            if (!agent) {
                throw new Error("Agent not found");
            }
            if (agent.status !== "PENDING_ORGANIZATION_APPROVAL") {
                throw new Error(`Agent is not in PENDING_ORGANIZATION_APPROVAL status. Current: ${agent.status}`);
            }
            const invitation = agent.ProcurementInvitation;
            if (!invitation) {
                throw new Error("Agent has no associated procurement invitation");
            }
            // 2. Create OrganizationMembership
            logDev("Creating OrganizationMembership", { agentId, orgId: invitation.orgId });
            const membership = await tx.organizationMembership.create({
                data: {
                    id: `oms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    // userId: user.id, // No linked User yet - membership is for the agent
                    agentId: agent.id,
                    orgId: invitation.orgId,
                    positionId: invitation.positionId,
                    invitedById: approverId,
                    status: "ACTIVE",
                    joinedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            // 3. Update Agent status to ACTIVE and set organizationId
            logDev("Updating Agent to ACTIVE", { agentId });
            await tx.agent.update({
                where: { id: agent.id },
                data: {
                    verificationStatus: "APPROVED",
                    organizationId: invitation.orgId,
                    updatedAt: new Date(),
                },
            });
            // 4. Update invitation to ACCEPTED
            logDev("Updating invitation to ACCEPTED", { invitationId: invitation.id });
            await tx.procurementInvitation.update({
                where: { id: invitation.id },
                data: {
                    status: "ACCEPTED",
                    approvedAt: new Date(),
                    approvedBy: approverId,
                    updatedAt: new Date(),
                },
            });
            logDev("Agent Approved", { agentId, membershipId: membership.id });
            return { success: true, membershipId: membership.id, agentId: agent.id, invitationId: invitation.id, status: "ACCEPTED" };
        });
    }
    catch (error) {
        logDev("Error approving agent", { error });
        throw error;
    }
}
// ============================================
// Agent Rejection (HR Action)
// ============================================
export async function rejectProcurementAgent(agentId, reason) {
    try {
        logDev("Rejecting Agent", { agentId, reason });
        return await prisma.$transaction(async (tx) => {
            // 1. Get the agent with its invitation
            const agent = await tx.agent.findUnique({
                where: { id: agentId },
                include: {
                    ProcurementInvitation: true,
                },
            });
            if (!agent) {
                throw new Error("Agent not found");
            }
            if (agent.status !== "PENDING_ORGANIZATION_APPROVAL") {
                throw new Error(`Agent is not in PENDING_ORGANIZATION_APPROVAL status. Current: ${agent.status}`);
            }
            const invitation = agent.ProcurementInvitation;
            if (!invitation) {
                throw new Error("Agent has no associated procurement invitation");
            }
            // 2. Update Agent status to REJECTED
            logDev("Updating Agent to REJECTED", { agentId });
            await tx.agent.update({
                where: { id: agent.id },
                data: {
                    verificationStatus: "REJECTED",
                    updatedAt: new Date(),
                },
            });
            // 3. Update invitation to REJECTED
            logDev("Updating invitation to REJECTED", { invitationId: invitation.id });
            await tx.procurementInvitation.update({
                where: { id: invitation.id },
                data: {
                    status: "REJECTED",
                    rejectedBy: invitation.approvedBy ?? 0,
                    rejectionReason: reason || null,
                    updatedAt: new Date(),
                },
            });
            logDev("Agent Rejected", { agentId });
            return { success: true, agentId: agent.id, invitationId: invitation.id };
        });
    }
    catch (error) {
        logDev("Error rejecting agent", { error });
        throw error;
    }
}
// ============================================
// Agent Details (for HR modal)
// ============================================
export async function getProcurementAgentDetails(agentId) {
    try {
        logDev("Getting Agent Details", { agentId });
        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            include: {
                verifications: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: "desc" },
                },
                ProcurementInvitation: {
                    include: {
                        Organization: {
                            select: {
                                id: true,
                                name: true,
                                profileImg: true,
                                location: true,
                            },
                        },
                        Position: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                organization: {
                    select: {
                        id: true,
                        name: true,
                        profileImg: true,
                        location: true,
                    },
                },
            },
        });
        if (!agent) {
            logDev("Agent Not Found", { agentId });
            return null;
        }
        logDev("Agent Found", { agentId: agent.id, status: agent.status });
        const invitation = agent.ProcurementInvitation;
        return {
            id: agent.id,
            agentType: agent.agentType,
            status: agent.status,
            email: agent.email,
            phone: agent.phone,
            fullname: agent.fullname,
            verificationStatus: agent.verificationStatus,
            submittedAt: agent.createdAt,
            personalInfo: {
                dateOfBirth: agent.birthday?.toISOString() || null,
                gender: agent.gender,
                address: agent.address,
                city: agent.city,
                province: agent.province,
                zipCode: agent.zipCode,
                civilStatus: agent.civilStatus,
                emergencyContact: agent.emergencyContact,
            },
            preferences: {
                interestedIndustries: agent.interestedIndustries,
                experienceLevel: agent.experienceLevel,
            },
            verifications: agent.verifications.map((v) => ({
                id: v.id,
                documentType: v.documentType,
                fileUrl: v.fileUrl,
                status: v.status,
                createdAt: v.createdAt,
            })),
            invitation: invitation
                ? {
                    id: invitation.id,
                    orgId: invitation.orgId,
                    orgName: invitation.Organization?.name || "Unknown Organization",
                    orgLogo: invitation.Organization?.profileImg,
                    orgAddress: invitation.Organization?.location,
                    positionId: invitation.positionId,
                    positionName: invitation.Position?.name || null,
                    status: invitation.status,
                    expiresAt: invitation.expiresAt,
                    usedAt: invitation.usedAt,
                }
                : null,
            organization: agent.organization
                ? {
                    id: agent.organization.id,
                    name: agent.organization.name,
                    profileImg: agent.organization.profileImg,
                    location: agent.organization.location,
                }
                : null,
        };
    }
    catch (error) {
        logDev("Error getting agent details", { error });
        return null;
    }
}
// ============================================
// Organization Agents (Approved Agents only)
// Queries Agent table directly - source of truth
// ============================================
export async function getOrganizationAgents(orgId) {
    try {
        logDev("Getting Organization Agents", { orgId });
        const agents = await prisma.agent.findMany({
            where: {
                organizationId: orgId,
                verificationStatus: "APPROVED",
                deletedAt: null,
            },
            include: {
                ProcurementInvitation: {
                    include: {
                        Position: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                organization: {
                    select: {
                        id: true,
                        name: true,
                        profileImg: true,
                        location: true,
                    },
                },
                verifications: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        logDev("Organization Agents Found", { count: agents.length, orgId });
        return agents.map((agent) => ({
            id: agent.id,
            agentType: agent.agentType,
            organizationId: agent.organizationId,
            email: agent.email,
            phone: agent.phone,
            fullname: agent.fullname,
            verificationStatus: agent.verificationStatus,
            trustTier: agent.trustTier,
            status: agent.status,
            address: agent.address,
            birthday: agent.birthday,
            city: agent.city,
            province: agent.province,
            zipCode: agent.zipCode,
            civilStatus: agent.civilStatus,
            emergencyContact: agent.emergencyContact,
            experienceLevel: agent.experienceLevel,
            gender: agent.gender,
            interestedIndustries: agent.interestedIndustries,
            positionId: agent.ProcurementInvitation?.positionId ?? null,
            positionName: agent.ProcurementInvitation?.Position?.name ?? null,
            invitationId: agent.ProcurementInvitation?.id ?? null,
            invitationStatus: agent.ProcurementInvitation?.status ?? null,
            organization: agent.organization
                ? {
                    id: agent.organization.id,
                    name: agent.organization.name,
                    profileImg: agent.organization.profileImg,
                    location: agent.organization.location,
                }
                : null,
            user: agent
                ? {
                    id: agent.id,
                    fullname: agent.fullname,
                    email: agent.email,
                    phone: agent.phone,
                }
                : null,
            verifications: agent.verifications.map((v) => ({
                id: v.id,
                documentType: v.documentType,
                fileUrl: v.fileUrl,
                status: v.status,
                createdAt: v.createdAt,
            })),
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt,
        }));
    }
    catch (error) {
        logDev("Error getting organization agents", { error, orgId });
        throw new Error("Failed to get organization agents");
    }
}
// ============================================
// Update Organization Agent
// ============================================
export async function updateOrganizationAgent(agentId, data, updaterId) {
    try {
        logDev("Updating Organization Agent", { agentId, data, updaterId });
        return await prisma.$transaction(async (tx) => {
            // 1. Verify agent exists and is APPROVED
            const existing = await tx.agent.findUnique({
                where: { id: agentId },
                select: { id: true, verificationStatus: true, organizationId: true },
            });
            if (!existing) {
                throw new Error("Agent not found");
            }
            if (existing.verificationStatus !== "APPROVED") {
                throw new Error(`Agent is not approved. Current status: ${existing.verificationStatus}`);
            }
            // 2. Update agent fields
            logDev("Updating Agent record", { agentId });
            const updated = await tx.agent.update({
                where: { id: agentId },
                data: {
                    ...(data.fullname !== undefined && { fullname: data.fullname }),
                    ...(data.phone !== undefined && { phone: data.phone }),
                    ...(data.address !== undefined && { address: data.address }),
                    ...(data.city !== undefined && { city: data.city }),
                    ...(data.province !== undefined && { province: data.province }),
                    ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
                    ...(data.birthday !== undefined && { birthday: data.birthday }),
                    ...(data.gender !== undefined && { gender: data.gender }),
                    ...(data.civilStatus !== undefined && { civilStatus: data.civilStatus }),
                    ...(data.emergencyContact !== undefined && { emergencyContact: data.emergencyContact }),
                    ...(data.experienceLevel !== undefined && { experienceLevel: data.experienceLevel }),
                    ...(data.interestedIndustries !== undefined && { interestedIndustries: data.interestedIndustries }),
                    updatedAt: new Date(),
                },
            });
            // 3. If positionId is provided and agent has an invitation, update the invitation
            if (data.positionId !== undefined && existing.organizationId) {
                const invitation = await tx.procurementInvitation.findFirst({
                    where: {
                        usedByAgentId: agentId,
                        orgId: existing.organizationId,
                    },
                });
                if (invitation) {
                    logDev("Updating invitation position", { invitationId: invitation.id, positionId: data.positionId });
                    await tx.procurementInvitation.update({
                        where: { id: invitation.id },
                        data: {
                            positionId: data.positionId,
                            updatedAt: new Date(),
                        },
                    });
                }
            }
            logDev("Organization Agent Updated", { agentId });
            return { success: true, agentId: updated.id, updatedAt: updated.updatedAt };
        });
    }
    catch (error) {
        logDev("Error updating organization agent", { error, agentId });
        throw error;
    }
}
// ============================================
// Reject Approved Organization Agent
// Changes verificationStatus to REJECTED - does NOT delete
// ============================================
export async function rejectOrganizationAgent(agentId, reason, rejectedBy) {
    try {
        logDev("Rejecting Approved Organization Agent", { agentId, reason, rejectedBy });
        return await prisma.$transaction(async (tx) => {
            // 1. Get the agent
            const agent = await tx.agent.findUnique({
                where: { id: agentId },
                include: {
                    ProcurementInvitation: true,
                },
            });
            if (!agent) {
                throw new Error("Agent not found");
            }
            if (agent.verificationStatus !== "APPROVED") {
                throw new Error(`Agent is not approved. Current status: ${agent.verificationStatus}`);
            }
            // 2. Update Agent verificationStatus to REJECTED
            logDev("Updating Agent to REJECTED", { agentId });
            const updated = await tx.agent.update({
                where: { id: agent.id },
                data: {
                    verificationStatus: "REJECTED",
                    updatedAt: new Date(),
                },
            });
            // 3. Update related invitation if it exists
            if (agent.ProcurementInvitation) {
                logDev("Updating invitation to REJECTED", { invitationId: agent.ProcurementInvitation.id });
                await tx.procurementInvitation.update({
                    where: { id: agent.ProcurementInvitation.id },
                    data: {
                        status: "REJECTED",
                        rejectedBy,
                        rejectionReason: reason || null,
                        updatedAt: new Date(),
                    },
                });
            }
            logDev("Organization Agent Rejected", { agentId });
            return { success: true, agentId: updated.id, rejectedAt: new Date(), reason };
        });
    }
    catch (error) {
        logDev("Error rejecting organization agent", { error, agentId });
        throw error;
    }
}
