import { objectType } from 'nexus'

export const SummaryRow = objectType({
    name: 'SummaryRow',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('itemCode')
        t.nonNull.string('description')
        t.nonNull.float('opExPct')
        t.nonNull.float('computedCost')
        t.nonNull.float('costContribution')
        t.nonNull.float('sellingPrice')
        t.nonNull.int('centerId')
        t.nonNull.int('subCenterId')
        t.nonNull.int('accountTitleId')
        t.nonNull.int('itemId')
        t.nonNull.int('orgId')
        t.nullable.string('status')
        t.nullable.string('itemName')
        t.nullable.int('userId')
        t.nonNull.dateTime('createdAt')
        t.nonNull.field('item', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).item();
            }
        })
        t.nonNull.field('accountTitle', {
            type: 'AccountTitle',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).accountTitle();
            }
        })
        t.nonNull.field('center', {
            type: 'Center',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).center();
            }
        })
        t.nonNull.field('subCenter', {
            type: 'SubCenter',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.summaryRow.findUnique({ where: { id: parent.id } }).subCenter();
            }
        })
        t.nonNull.field('org', {
            type: 'Organization',
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