import { objectType } from 'nexus'

export const Department = objectType({
    name: 'Department',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('label')
        t.nullable.string('color')
        t.nonNull.int('orgId')
        t.nonNull.field('org', {
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.department.findUnique({ where: { id: parent.id } }).org();
            }
        })
    }
})