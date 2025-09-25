import { objectType } from 'nexus'

export const InventoryItems = objectType({
     name: 'InvetoryItems',
     definition(t){
          t.nonNull.int('id')
          t.nonNull.int('inventoryId')
          t.nonNull.field('inventory', {
               type: 'Inventory',
               resolve: (parent, args, ctx) =>{
                    return ctx.prisma.inventory
                    .findUnique({ where: { id: parent.id}})
                    .inventory()
               }
          })
          t.nonNull.int('itemId')
          t.nonNull.field('item', {
               type: 'Item',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.item
                    .findUnique({ where: { id: parent.id }})
                    .item()
               }
          })
     }
})