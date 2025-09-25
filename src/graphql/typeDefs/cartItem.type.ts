import { objectType } from "nexus";

export const CartItem = objectType({
  name: "CartItem",
  definition(t) {
    t.nonNull.int("transactionId");
    t.nonNull.int("itemId");
    t.nonNull.int("quantity"); // Correct way to resolve the transaction

    t.nonNull.field("transaction", {
      type: "Transaction",
      resolve: (parent, args, ctx) => {
        // Use Prisma's relational query to get the transaction
        return ctx.prisma.cartItem
          .findUnique({
            where: {
              transactionId_itemId: {
                transactionId: parent.transactionId,
                itemId: parent.itemId,
              },
            },
          })
          .transaction();
      },
    }); // Correct way to resolve the item
    t.nonNull.field("item", {
      type: "Item",
      resolve: (parent, args, ctx) => {
        // Use Prisma's relational query to get the item
        return ctx.prisma.cartItem
          .findUnique({
            where: {
              transactionId_itemId: {
                transactionId: parent.transactionId,
                itemId: parent.itemId,
              },
            },
          })
          .item();
      },
    });
  },
});
