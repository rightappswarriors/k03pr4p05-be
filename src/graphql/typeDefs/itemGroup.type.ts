import { objectType } from 'nexus'

export const ItemGroup = objectType({
    name: 'ItemGroup',
    definition(t) {
        t.nonNull.int('id')
        t.nonNull.string('name')
        t.nullable.string('description')
        t.nullable.string('icon')
        t.nonNull.boolean('isActive')
        t.nonNull.dateTime('createdAt')
        t.nonNull.int('orgId') // Added for multi-tenancy
        t.nonNull.field('org', { // Added relation
            type: 'Organization',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.itemGroup.findUnique({ where: { id: parent.id } }).org();
            }
        })
        t.nonNull.list.nonNull.field('categories', {
            type: 'ItemCategory',
            resolve: (parent, _, ctx) => {
                return ctx.prisma.itemGroup.findUnique({ where: { id: parent.id } }).categories();
            }
        })
    }
})