import { extendType, intArg, nonNull } from 'nexus'
import { requireAuth } from '../../../middleware/auth.middleware.js'

export const userProfileQuery = extendType({
  type: 'Query',
  definition(t) {
    t.field('getUserProfile', {
      type: 'User',
      args: {
        userId: nonNull(intArg()),
      },
      resolve: async (_, { userId }, ctx) => {
        requireAuth(ctx)
        const profile = await ctx.prisma.user.findUnique({
          where: { id: Number(userId) },
        })
        if (!profile) throw new Error('User profile not found')
        return profile
      },
    })

    t.field('getMyProfile', {
      type: 'User',
      resolve: async (_, __, ctx) => {
        requireAuth(ctx)
        const userId = ctx.user?.userId
        if (!userId) throw new Error('User is required')
        
        const profile = await ctx.prisma.user.findUnique({
          where: { id: Number(userId) },
        })
        if (!profile) throw new Error('User profile not found')
        return profile
      },
    })
  },
})
