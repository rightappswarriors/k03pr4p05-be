import { objectType } from 'nexus'

export const GISRow = objectType({
    name: 'GISRow',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('main')
        t.nonNull.string('group')
        t.nonNull.string('code')
        t.nonNull.int('centerId')
        t.nonNull.int('subCenterId')
        t.nonNull.string('description')
        t.nonNull.float('debit')
        t.nonNull.float('credit')
        t.nonNull.float('total')
        t.nonNull.int('orgId')
        t.nonNull.int('accountTitleId')
        t.nullable.int('userId')
        t.nonNull.dateTime('createdAt')
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.gISRow.findUnique({ where: { id: parent.id } }).org();
            }
        })
        t.nonNull.field('accountTitle', {
            type: 'AccountTitle',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.gISRow.findUnique({ where: { id: parent.id } }).accountTitle();
            }
        })
        t.nonNull.field('center', {
            type: 'Center',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.gISRow.findUnique({ where: { id: parent.id } }).center();
            }
        })
        t.nonNull.field('subCenter', {
            type: 'SubCenter',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.gISRow.findUnique({ where: { id: parent.id } }).subCenter();
            }
        })
        t.nullable.field('user', {
            type: 'User',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.gISRow.findUnique({ where: { id: parent.id } }).user();
            }
        })
    }
})