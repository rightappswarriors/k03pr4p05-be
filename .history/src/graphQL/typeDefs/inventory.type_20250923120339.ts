import { objectType } from 'nexus'

export const Inventory = objectType({
     name: 'Inventory',
     definition(t){
          t.nonNull.int('id')
          t.nullable.string('name')
          t.nonNull.list.nonNull.field('items',{
               type: 'InventoryItems',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.inventoryItems.findUnique({
                         where: { id: parent.id}
                    }).items()
               }
          })
     }
})