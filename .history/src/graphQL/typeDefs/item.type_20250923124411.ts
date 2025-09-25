import { objectType } from 'nexus'

export const Item = objectType({
     name: 'Item',
     definition(t) {
          t.nonNull.int('id')
          t.nonNull.string('name')
          t.nonNull.float('price')
          t.nullable.string('image')
          t.nullable.string('description')
          t.nullable.string('barcode')
          t.nullable.string('brand')
          t.nullable.int('categoryId')
          t.nullable.field('category',{
               type: 'Category',
               resolve: (parent, args, ctx) => {
                    return parent.id
               }
          })
          t.nonNull.list.nonNull.field('color', {
               type:'Color',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.item
                    .findUnique({ where: { id: parent.id}})
                    .item()
               }
          })
          t.nonNull.list.nonNull.field('InventoryItems', {
               type:'InventoryItems',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.inventoryItems
                    .findUnique({ where: { id: parent.id}})
                    .item()
               }
          })
          t.nonNull.list.nonNull.field('cartItems', {
               type:'CartItem',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.inventoryItems
                    .findUnique({ where: { id: parent.id}})
                    .item()
               }
          })
     }
})