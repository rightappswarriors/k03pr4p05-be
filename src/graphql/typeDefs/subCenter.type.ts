import { objectType } from 'nexus'

export const SubCenter = objectType({
    name: 'SubCenter',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('label')
        t.nonNull.int('orgId')
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.subCenter.findUnique({ where: { id: parent.id } }).org();
            }
        })
        t.list.field('gisRows', {
            type: 'GISRow',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.subCenter.findUnique({ where: { id: parent.id } }).gisrows();
            }
        })
        t.list.field('summaryRows', {
            type: 'SummaryRow',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.subCenter.findUnique({ where: { id: parent.id } }).summaryRows();
            }
        })
    }
})