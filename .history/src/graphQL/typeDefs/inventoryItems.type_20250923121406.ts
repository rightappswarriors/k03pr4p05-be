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
          t.nonNull.int('quantity')
          t.nullable.int('locationId')
          t.nullable.field('location', {
               type: 'Location',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.location
                    .findUnique({ where: { id: parent.id}})
                    .location()
               }
          })
     }
})