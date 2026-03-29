import { extendType, intArg, stringArg } from 'nexus'
import { requireRole } from '../../../middleware/auth.middleware'

export const accountTitleMutation = extendType({
  type: 'Mutation',
  definition(t) {
    t.field('createAccountTitle', {
      type: 'AccountTitle',
      args: {
        orgId: intArg(),
        name: stringArg(),
        code: stringArg()
      },
      resolve: async (_, { orgId, name, code }, ctx) => {
        requireRole(ctx, ['OWNER'])
        return ctx.prisma.accountTitle.create({
          data: { orgId, name, code }
        })
      }
    })
    t.field('updateAccountTitle', {
      type: 'AccountTitle',
      args: {
        id: intArg(),
        name: stringArg(),
        code: stringArg()
      },
      resolve: async (_, { id, name, code }, ctx) => {
        requireRole(ctx, ['OWNER'])
        return ctx.prisma.accountTitle.update({
          where: { id },
          data: { name, code }
        })
      }
    })
    t.field('deleteAccountTitle', {
      type: 'AccountTitle',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        requireRole(ctx, ['OWNER'])
        return ctx.prisma.accountTitle.delete({
          where: { id }
        })
      }
    })
  }
})