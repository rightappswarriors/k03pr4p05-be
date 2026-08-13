

import { objectType } from 'nexus'

export const Brand = objectType({
    name: 'Brand',
    definition(t) {
        t.nonNull.int('id')
        t.nullable.string('email')
        t.nullable.string('webUrl')
        t.nullable.string('contactNumber')
        t.nonNull.string('name')
        t.nonNull.int('orgId') // Added for multi-tenancy
        t.nonNull.field('org', { // Added relation
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.brand.findUnique({ where: { id: parent.id } }).org();
            }
        })
        t.nonNull.list.nonNull.field('Item', {
            type: 'Item',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.brand.findUnique({ where: { id: parent.id } }).Item();
            }
        })
    }
})