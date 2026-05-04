import { objectType } from 'nexus'

export const Budget = objectType({
  name: 'Budget',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.int('year')
    t.nonNull.string('account')
    t.nonNull.float('begBal')
    t.nonNull.json('months')
    t.nonNull.int('orgId')
    t.nullable.int('userId')
    t.nonNull.dateTime('createdAt')
    t.nonNull.dateTime('updatedAt')
    t.nonNull.field('org', {
      type: 'Organization',
      resolve: (parent, _, ctx) =>
        ctx.prisma.budget.findUnique({ where: { id: parent.id } }).org(),
    })
    t.nullable.field('user', {
      type: 'User',
      resolve: (parent, _, ctx) => {
        if (!parent.userId) return null
        return ctx.prisma.budget.findUnique({ where: { id: parent.id } }).user()
      },
    })
  },
})
