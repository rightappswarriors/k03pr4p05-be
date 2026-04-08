import { extendType, intArg } from 'nexus'

export const vatTypeQuery = extendType({
  type: 'Query',
  definition(t) {
    t.list.field('vatTypes', {
      type: 'VatType',

      resolve: async (_, { }, ctx) => {
        const orgId = ctx.user.orgId
        return ctx.prisma.vatType.findMany({
          where: { orgId }
        })
      }
    })
    t.field('vatType', {
      type: 'VatType',
      args: {
        id: intArg()
      },
      resolve: async (_, { id }, ctx) => {
        const orgId = ctx.user.orgId
        return ctx.prisma.vatType.findUnique({
          where: { id, orgId }
        })
      }
    })
  }
})