import { objectType } from 'nexus'

export const CartItem = objectType({
     name: 'CartItem',
     definition(t){
          t.nonNull.int('transactionId')
          t.nonNull.int('quantity')
          t.nonNull.int('itemId')
          t.nonNull.field('transaction', {
               type: 'Transaction',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.transaction
                    .findUnique({ where: { id: parent.id}})
                    .transaction()
               }
          })
          
          t.nonNull.field('item', {
               type: 'Item',
               resolve: (parent, args, ctx) => {
                    return ctx.prisma.item
                    .findUnique({ where: { id: parent.id}})
                    .item()
               }
          })
     }
})