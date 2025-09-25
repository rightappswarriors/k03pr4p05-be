import { objectType } from 'nexus'

export const Color = objectType({
     name: 'Color',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('name')
          t.nonNull.list.nonNull.field('items', {
               type:'Item',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.item
                    .findUnique({ where: { id: parent.id}})
                    .item()
               }
          })
     }
})