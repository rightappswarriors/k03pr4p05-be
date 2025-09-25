import { objectType } from 'nexus'

export const location = objectType({
     name: 'Location',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('ailse')
          t.nonNull.string('rack')
          t.nonNull.string('shelf')
          t.nullable.field('item', {
               type:'InventoryItems',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.invetoryItems
                    .findUnique({ where: {id: parent.id}})
                    .item()
               }
          })
     }
})