import { objectType } from "nexus";
// cartItem.type.ts
export const CartItem = objectType({
  name: "CartItem",
  definition(t) {
    t.nonNull.int("transactionId");
    t.nonNull.int("itemId");
    t.nonNull.float("quantity");       // Int → Float (supports 0.875 kg)
    t.nullable.int("unitId");          // new
    t.nullable.string("unitName");     // new — e.g. "kg", "dozen"
    t.nonNull.float("priceAtSale");    // new — price locked at sale time

    t.nonNull.field("transaction", {
      type: "Transaction",
      resolve: (parent, _, ctx) =>
        ctx.prisma.cartItem
          .findUnique({
            where: {
              transactionId_itemId: {
                transactionId: parent.transactionId,
                itemId: parent.itemId,
              },
            },
          })
          .transaction(),
    });

    t.nonNull.field("item", {
      type: "Item",
      resolve: (parent, _, ctx) =>
        ctx.prisma.cartItem
          .findUnique({
            where: {
              transactionId_itemId: {
                transactionId: parent.transactionId,
                itemId: parent.itemId,
              },
            },
          })
          .item(),
    });

    t.nullable.field("unit", {
      type: "InventoryItemUnit",
      resolve: (parent, _, ctx) => {
        if (!parent.unitId) return null;
        return ctx.prisma.inventoryItemUnit.findUnique({
          where: { id: parent.unitId },
        });
      },
    });
  },
});