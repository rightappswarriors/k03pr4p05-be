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
                // Correct: Use Prisma's relational query to get the category
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).category();
            }
        })
        t.nonNull.list.nonNull.field('color', {
            type:'Color',
            resolve: (parent, args, ctx) => {
                // Correct: Use Prisma's relational query to get the colors
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).color();
            }
        })
        t.nonNull.list.nonNull.field('InventoryItems', {
            type:'InventoryItems',
            resolve: (parent, args, ctx) => {
                // Correct: Use Prisma's relational query to get the inventory items
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).InventoryItems();
            }
        })
        t.nonNull.list.nonNull.field('cartItems', {
            type:'CartItem',
            resolve: (parent, args, ctx) => {
                // Correct: Use Prisma's relational query to get the cart items
                return ctx.prisma.item.findUnique({ where: { id: parent.id } }).cartItems();
            }
        })
    }
})
