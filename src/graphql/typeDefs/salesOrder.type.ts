import { objectType } from 'nexus'

export const SalesOrder = objectType({
    name: 'SalesOrder',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('customer')
        t.nonNull.string('product')
        t.nonNull.int('qty')
        t.nonNull.float('total')
        t.nonNull.string('status')
        t.nonNull.dateTime('date')
        t.nonNull.string('outlet')
        t.nonNull.int('orgId')
        t.nullable.int('userId')
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.salesOrder.findUnique({ where: { id: parent.id } }).org();
            }
        })
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.salesOrder.findUnique({ where: { id: parent.id } }).user();
            }
        })
    }
})