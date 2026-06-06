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
        id: nonNull(intArg()),
        name: stringArg(),
        bio: stringArg(),
        email: stringArg(),
        contactNumber: stringArg(),
        location: stringArg(),
        profileImg: stringArg(),
        bannerImg: stringArg(),
        facebookLink: stringArg(),
        instagramLink: stringArg(),
        twitterLink: stringArg(),
      },
      resolve: async (_, { id, name, bio, email, contactNumber, location, profileImg, bannerImg, facebookLink, instagramLink, twitterLink }, ctx) => {
        requireAuth(ctx)
        const userId = ctx.user?.userId
        if (!userId) throw new Error('User is required')

        const org = await ctx.prisma.organization.findUnique({ where: { id } })
        if (!org) throw new Error('Organization not found')

        return ctx.prisma.organization.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(bio !== undefined && { bio }),
            ...(email !== undefined && { email }),
            ...(contactNumber !== undefined && { contactNumber }),
            ...(location !== undefined && { location }),
            ...(profileImg !== undefined && { profileImg }),
            ...(bannerImg !== undefined && { bannerImg }),
            ...(facebookLink !== undefined && { facebookLink }),
            ...(instagramLink !== undefined && { instagramLink }),
            ...(twitterLink !== undefined && { twitterLink }),
          }
        })
      }
    })
  }
})