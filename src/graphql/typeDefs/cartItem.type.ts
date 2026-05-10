// graphql/types/cartItem.type.ts
import { objectType } from "nexus";

export const CartItem = objectType({
  name: "CartItem",
  definition(t) {
    t.nonNull.int("transactionId");
    t.nonNull.int("itemId");
    t.nonNull.float("quantity");
    t.nullable.int("unitId");
    t.nullable.string("unitName");
    t.nonNull.float("priceAtSale");
    t.nullable.float("discountAmount");
    t.nullable.float("discountQuantity");  // ← NEW
    t.nullable.float("discountRate");
    t.nonNull.field("discountType", { type: "DiscountType" });
    t.nonNull.float("originalPrice");
    t.nonNull.float("vatExclusivePrice");
    t.nonNull.float("finalPrice");

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

