import { extendType, nonNull, stringArg, intArg, arg, nullable } from 'nexus'
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js'
import { PAGE_PERMISSIONS } from '../../../lib/permissions.map.js'
import crypto from 'crypto'

const generateCode = () => crypto.randomBytes(6).toString('hex').toUpperCase()
const generateLink = (code: string) => `${process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.kompra.ph'}/join/procurement/${code}`

const assertSupplierOrg = (ctx: any) => {
  requireAuth(ctx)
  requireRole(ctx, ['OWNER', 'STAFF'])
  return ctx.user
}

export const procurementMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.nonNull.field('inviteProcurementAgent', {
      type: 'ProcurementInvitation',
      args: {
        input: nonNull(arg({ type: 'InviteProcurementAgentInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.create(ctx)

        // Verify position belongs to organization
        if (input.positionId) {
          const position = await ctx.prisma.position.findUnique({
            where: { id: input.positionId },
          })
          if (!position || position.orgId !== orgId) {
            throw new Error('Position not found or access denied')
          }
        }

        const code = generateCode()
        const link = generateLink(code)
        const expiresAt = input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        const invitation = await ctx.prisma.procurementInvitation.create({
          data: {
            orgId,
            email: input.email,
            code,
            link,
            positionId: input.positionId,
            expiresAt,
          },
        })

        // Log to AuditLog
        await ctx.prisma.auditLog.create({
          data: {
            orgId,
            userId: user.id,
            pageKey: 'procurementAgents',
            action: 'CREATE',
            recordId: invitation.id,
            recordType: 'ProcurementInvitation',
            newValue: { email: input.email, code },
          },
        })

        return invitation
      },
    })

    t.nonNull.field('generateInvitation', {
      type: 'ProcurementInvitation',
      args: {
        input: nonNull(arg({ type: 'GenerateInvitationInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.create(ctx)

        // Verify position belongs to organization
        if (input.positionId) {
          const position = await ctx.prisma.position.findUnique({
            where: { id: input.positionId },
          })
          if (!position || position.orgId !== orgId) {
            throw new Error('Position not found or access denied')
          }
        }

        const code = generateCode()
        const link = generateLink(code)
        const expiresAt = input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        const invitation = await ctx.prisma.procurementInvitation.create({
          data: {
            orgId,
            code,
            link,
            positionId: input.positionId,
            expiresAt,
          },
        })

        // Log to AuditLog
        await ctx.prisma.auditLog.create({
          data: {
            orgId,
            userId: user.id,
            pageKey: 'procurementAgents',
            action: 'CREATE',
            recordId: invitation.id,
            recordType: 'ProcurementInvitation',
            newValue: { code, type: 'GENERATED' },
          },
        })

        return invitation
      },
    })

    t.nonNull.field('approveProcurementAgent', {
      type: 'ProcurementAgentRequest',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.edit(ctx)

        const request = await ctx.prisma.procurementAgentRequest.findUnique({
          where: { id },
          include: {
            agent: true,
          },
        })

        if (!request || request.orgId !== orgId) {
          throw new Error('Request not found or access denied')
        }

        if (request.status !== 'PENDING') {
          throw new Error('Only pending requests can be approved')
        }

        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          // Find the OrganizationMembership for this agent
          const membership = await tx.organizationMembership.findFirst({
            where: {
              agentId: request.agentId,
              orgId,
            },
          })

          // Update membership status to ACTIVE
          if (membership) {
            await tx.organizationMembership.update({
              where: { id: membership.id },
              data: {
                status: 'ACTIVE',
                joinedAt: new Date(),
              },
            })
          }

          // Update or create Agent with organization link
          if (request.agentId) {
            await tx.agent.update({
              where: { id: request.agentId },
              data: {
                organizationId: orgId,
                verificationStatus: 'APPROVED',
              },
            })
          }

          // Update the request
          const updatedRequest = await tx.procurementAgentRequest.update({
            where: { id },
            data: {
              status: 'APPROVED',
              reviewedById: user.id,
              reviewedAt: new Date(),
            },
          })
          await tx.auditLog.create({
            data: {
              orgId,
              userId: user.id,
              pageKey: 'procurementAgents',
              action: 'STATUS_CHANGE',
              recordId: id,
              recordType: 'ProcurementAgentRequest',
              newValue: { status: 'APPROVED' },
            },
          })
          return updatedRequest
        })

        return updated
      },
    })

    t.nonNull.field('rejectProcurementAgent', {
      type: 'ProcurementAgentRequest',
      args: {
        id: nonNull(stringArg()),
        notes: stringArg(),
      },
      resolve: async (_, { id, notes }, ctx) => {
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.edit(ctx)

        const request = await ctx.prisma.procurementAgentRequest.findUnique({
          where: { id },
        })

        if (!request || request.orgId !== orgId) {
          throw new Error('Request not found or access denied')
        }

        if (request.status !== 'PENDING') {
          throw new Error('Only pending requests can be rejected')
        }

        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          const updatedRequest = await tx.procurementAgentRequest.update({
            where: { id },
            data: {
              status: 'REJECTED',
              reviewedById: user.id,
              reviewedAt: new Date(),
              reviewNotes: notes,
            },
          })
          await tx.auditLog.create({
            data: {
              orgId,
              userId: user.id,
              pageKey: 'procurementAgents',
              action: 'STATUS_CHANGE',
              recordId: id,
              recordType: 'ProcurementAgentRequest',
              newValue: { status: 'REJECTED', notes },
            },
          })
          return updatedRequest
        })

        return updated
      },
    })

    t.nonNull.field('assignProcurementPosition', {
      type: 'ProcurementInvitation',
      args: {
        id: nonNull(stringArg()),
        positionId: nonNull(stringArg()),
      },
      resolve: async (_, { id, positionId }, ctx) => {
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.edit(ctx)

        const invitation = await ctx.prisma.procurementInvitation.findUnique({
          where: { id },
        })

        if (!invitation || invitation.orgId !== orgId) {
          throw new Error('Invitation not found or access denied')
        }

        const position = await ctx.prisma.position.findUnique({
          where: { id: positionId },
        })

        if (!position || position.orgId !== orgId) {
          throw new Error('Position not found or access denied')
        }

        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          const updatedInv = await tx.procurementInvitation.update({
            where: { id },
            data: { positionId },
          })
          await tx.auditLog.create({
            data: {
              orgId,
              userId: user.id,
              pageKey: 'procurementAgents',
              action: 'PERMISSION_CHANGE',
              recordId: id,
              recordType: 'ProcurementInvitation',
              newValue: { positionId },
            },
          })
          return updatedInv
        })

        return updated
      },
    })

    t.nonNull.field('removeProcurementAgent', {
      type: 'ProcurementInvitation',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.delete(ctx)

        const invitation = await ctx.prisma.procurementInvitation.findUnique({
          where: { id },
        })

        if (!invitation || invitation.orgId !== orgId) {
          throw new Error('Invitation not found or access denied')
        }

        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          const updatedInv = await tx.procurementInvitation.update({
            where: { id },
            data: {
              status: 'REVOKED',
              revokedAt: new Date(),
              deletedAt: new Date(),
            },
          })
          await tx.auditLog.create({
            data: {
              orgId,
              userId: user.id,
              pageKey: 'procurementAgents',
              action: 'DELETE',
              recordId: id,
              recordType: 'ProcurementInvitation',
              oldValue: { status: invitation.status },
              newValue: { status: 'REVOKED' },
            },
          })
          return updatedInv
        })

        return updated
      },
    })

    t.nonNull.field('resendInvitation', {
      type: 'ProcurementInvitation',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.edit(ctx)

        const invitation = await ctx.prisma.procurementInvitation.findUnique({
          where: { id },
        })

        if (!invitation || invitation.orgId !== orgId) {
          throw new Error('Invitation not found or access denied')
        }

        // Only resend pending invitations
        if (invitation.status !== 'PENDING') {
          throw new Error('Only pending invitations can be resent')
        }

        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          const updatedInv = await tx.procurementInvitation.update({
            where: { id },
            data: {
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          })
          await tx.auditLog.create({
            data: {
              orgId,
              userId: user.id,
              pageKey: 'procurementAgents',
              action: 'STATUS_CHANGE',
              recordId: id,
              recordType: 'ProcurementInvitation',
              newValue: { action: 'resent' },
            },
          })
          return updatedInv
        })

        return updated
      },
    })

    t.nonNull.field('revokeInvitation', {
      type: 'ProcurementInvitation',
      args: {
        id: nonNull(stringArg()),
      },
      resolve: async (_, { id }, ctx) => {
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.delete(ctx)

        const invitation = await ctx.prisma.procurementInvitation.findUnique({
          where: { id },
        })

        if (!invitation || invitation.orgId !== orgId) {
          throw new Error('Invitation not found or access denied')
        }

        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          const updatedInv = await tx.procurementInvitation.update({
            where: { id },
            data: {
              status: 'REVOKED',
              revokedAt: new Date(),
              deletedAt: new Date(),
            },
          })
          await tx.auditLog.create({
            data: {
              orgId,
              userId: user.id,
              pageKey: 'procurementAgents',
              action: 'DELETE',
              recordId: id,
              recordType: 'ProcurementInvitation',
              newValue: { status: 'REVOKED' },
            },
          })
          return updatedInv
        })

        return updated
      },
    })

    // Validate invitation without using it
    t.nonNull.field('validateInvitation', {
      type: 'ProcurementInvitationDetails',
      args: {
        input: nonNull(arg({ type: 'ValidateInvitationInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        const { code, link } = input

        if (!code && !link) {
          throw new Error('Invitation code or link is required')
        }

        const invitation = await ctx.prisma.procurementInvitation.findFirst({
          where: {
            OR: code ? { code } : undefined,
            ...(link ? { link } : undefined),
          },
        })

        if (!invitation) {
          throw new Error('Invitation not found')
        }

        // Check if already used
        if (invitation.status === 'ACCEPTED') {
          throw new Error('Invitation has already been used')
        }

        // Check if expired
        if (invitation.expiresAt && invitation.expiresAt < new Date()) {
          throw new Error('Invitation has expired')
        }

        // Check if revoked
        if (invitation.status === 'REVOKED') {
          throw new Error('Invitation has been revoked')
        }

        return invitation
      },
    })

    // Accept invitation - link user to invitation
    t.nonNull.field('acceptInvitation', {
      type: 'OrganizationMembership',
      args: {
        input: nonNull(arg({ type: 'AcceptInvitationInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        const { invitationId, userId } = input

        return await ctx.prisma.$transaction(async (tx: any) => {
          // Get and validate invitation
          const invitation = await tx.procurementInvitation.findUnique({
            where: { id: invitationId },
          })

          if (!invitation) {
            throw new Error('Invitation not found')
          }

          if (invitation.status === 'ACCEPTED') {
            throw new Error('Invitation has already been used')
          }

          if (invitation.expiresAt && invitation.expiresAt < new Date()) {
            throw new Error('Invitation has expired')
          }

          // Verify user exists
          const user = await tx.user.findUnique({
            where: { id: Number(userId) },
          })

          if (!user) {
            throw new Error('User not found')
          }

          // Check if user already has a pending/approved membership to this org
          const existingMembership = await tx.organizationMembership.findFirst({
            where: {
              userId: Number(userId),
              orgId: invitation.orgId,
              deletedAt: null,
            },
          })

          if (existingMembership) {
            throw new Error('User already has a membership to this organization')
          }

          // Update invitation
          await tx.procurementInvitation.update({
            where: { id: invitationId },
            data: {
              status: 'ACCEPTED',
              acceptedByUserId: Number(userId),
            },
          })

          // Create OrganizationMembership in PENDING state
          const membership = await tx.organizationMembership.create({
            data: {
              userId: Number(userId),
              orgId: invitation.orgId,
              positionId: invitation.positionId,
              status: 'PENDING',
            },
          })

          // Create ProcurementAgentRequest for HR to review
          await tx.procurementAgentRequest.create({
            data: {
              orgId: invitation.orgId,
              agentId: `agent_${Date.now()}`, // This would be linked to actual agent
              status: 'PENDING',
            },
          })

          return membership
        })
      },
    })

    // Request additional documents from applicant
    t.nonNull.field('requestAdditionalDocuments', {
      type: 'ProcurementAgentRequest',
      args: {
        input: nonNull(arg({ type: 'RequestDocumentsInput' })),
      },
      resolve: async (_, { input }, ctx) => {
        const { requestId, documentTypes, notes } = input
        const user = assertSupplierOrg(ctx)
        const orgId = Number(user.orgId)

        PAGE_PERMISSIONS.hr.edit(ctx)

        const request = await ctx.prisma.procurementAgentRequest.findUnique({
          where: { id: requestId },
        })

        if (!request || request.orgId !== orgId) {
          throw new Error('Request not found or access denied')
        }

        const updated = await ctx.prisma.$transaction(async (tx: any) => {
          const updatedRequest = await tx.procurementAgentRequest.update({
            where: { id: requestId },
            data: {
              status: 'PENDING',
              reviewNotes: notes,
            },
          })
          await tx.auditLog.create({
            data: {
              orgId,
              userId: user.id,
              pageKey: 'procurementAgents',
              action: 'STATUS_CHANGE',
              recordId: requestId,
              recordType: 'ProcurementAgentRequest',
              newValue: { action: 'requested_documents', documents: documentTypes },
            },
          })
          return updatedRequest
        })

        return updated
      },
    })
  },
})