import { enumType, objectType } from 'nexus'

export const MembershipStatus = enumType({
  name: 'MembershipStatus',
  members: ['PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'],
})

export const OrganizationMembership = objectType({
  name: 'OrganizationMembership',
  definition(t) {
    t.nonNull.string('id')
    
    t.nullable.string('agentId')
    t.nonNull.int('orgId')
    t.nullable.string('positionId')
    t.nullable.int('invitedById')
    t.nonNull.field('status', { type: 'MembershipStatus' })
    t.nullable.dateTime('joinedAt')
    t.nonNull.dateTime('createdAt')
    t.nonNull.dateTime('updatedAt')
    t.nullable.dateTime('deletedAt')

    t.nonNull.field('user', {
      type: 'User',
      resolve: (parent, _, ctx) => ctx.prisma.organizationMembership.findUnique({ where: { id: parent.id } }).User(),
    })

    t.nullable.field('agent', {
      type: 'Agent',
      resolve: (parent, _, ctx) => {
        if (!parent.agentId) return null
        return ctx.prisma.organizationMembership.findUnique({ where: { id: parent.id } }).Agent()
      },
    })

    t.nonNull.field('org', {
      type: 'Organization',
      resolve: (parent, _, ctx) => ctx.prisma.organizationMembership.findUnique({ where: { id: parent.id } }).Organization(),
    })

    t.nullable.field('position', {
      type: 'Position',
      resolve: (parent, _, ctx) => ctx.prisma.organizationMembership.findUnique({ where: { id: parent.id } }).Position(),
    })

  },
})