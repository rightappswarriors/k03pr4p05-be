import { objectType, enumType } from "nexus";
export const PaymentMethod = enumType({
    name: "PaymentMethod",
    members: ["CASH", "CARD", "DIGITAL"],
});
export const Status = enumType({
    name: "Status",
    members: ["PENDING", "SYNCED", "FAILED", "CANCELED"],
});
export const Transaction = objectType({
    name: "Transaction",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("outletId");
        t.nonNull.field("outlet", {
            type: "Outlet",
            resolve: (parent, args, ctx) => {
                return ctx.prisma.transaction
                    .findUnique({ where: { id: parent.id } })
                    .outlet();
            },
        });
        t.nonNull.int("cashierId");
        t.nonNull.field("cashier", {
            type: "User",
            resolve: (parent, args, ctx) => {
                return ctx.prisma.transaction
                    .findUnique({ where: { id: parent.id } })
                    .cashier();
            },
        });
        t.nonNull.list.nonNull.field("items", {
            type: "CartItem",
            resolve: (parent, args, ctx) => {
                return ctx.prisma.transaction
                    .findUnique({ where: { id: parent.id } })
                    .items();
            },
        });
        t.nonNull.float("total");
        t.nonNull.float("subtotal");
        t.nullable.float("cashReceived");
        t.nullable.float("change");
        t.nonNull.float("tax");
        t.nonNull.field("paymentMethod", { type: "PaymentMethod" });
        t.nonNull.field("status", { type: "Status" });
        t.nonNull.dateTime("createdAt");
        t.nonNull.dateTime("syncedAt");
    },
});
