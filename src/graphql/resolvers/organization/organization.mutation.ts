import { extendType, intArg, nonNull, stringArg } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'
import { createOrganization as createOrganizationService } from '../../../services/organizationService.js'

export const organizationMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createOrganization', {
      type: 'Organization',
      args: {
        name: nonNull(stringArg())
      },
      resolve: async (_, { name }, ctx) => {
        requireAuth(ctx)
        const userId = ctx.user?.userId
        if (!userId) throw new Error('User is required')
        if (!name || !name.trim()) throw new Error('Organization name is required')
        return createOrganizationService(Number(userId), name.trim())
      }
    })
    t.field('updateOrganization', {
      type: 'Organization',
      args: {
        id: intArg(),
        name: stringArg()
      },
      resolve: async (_, { id, name }, ctx) => {
        requireAuth(ctx)
        return ctx.prisma.organization.update({
          where: { id },
          data: { name }
        })
      }
    })
  }
})