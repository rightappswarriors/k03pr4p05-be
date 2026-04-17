import { objectType } from 'nexus'

export const SummaryRow = objectType({
    name: 'SummaryRow',
    definition(t) {
        t.nonNull.string('id')
        t.nonNull.string('itemCode')
        t.nonNull.string('description')
        t.nonNull.float('opExPct')
        t.nonNull.float('computedCost')
        t.nonNull.float('costContribution')
        t.nonNull.float('sellingPrice')
        t.nullable.string('status')
        t.nonNull.int('orgId')

        t.nonNull.dateTime('createdAt');
        t.nullable.int('userId');
        t.nullable.int('itemId');
         t.nonNull.field('item', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).item();
            }
        })
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).org();
            }
        })
        t.nullable.field('item', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).org();
            }
        })
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).user();
            }
        })
    }
})