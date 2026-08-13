import { enumType, objectType } from "nexus";
// ─── PaymentType enum — must match schema exactly (lowercase members) ─────────
export const PaymentType = enumType({
    name: "PaymentType",
    members: ["gcash", "paymaya", "card", "qrph"], // ← lowercase, matches schema
});
// ─── CustomerDetails objectType ───────────────────────────────────────────────
export const CustomerDetails = objectType({
    name: "CustomerDetails",
    definition(t) {
        t.nonNull.int("id");
        t.nullable.string("fullname");
        t.nullable.string("username");
        t.nullable.string("email");
        t.nullable.string("phoneNumber"); // ← was missing
        t.nullable.field("paymentType", {
            type: "PaymentType",
        });
        t.nullable.string("paymentMethodId");
        t.nullable.string("paymentIntentId");
        t.nullable.string("client_key"); // ← was missing
        t.nullable.string("status");
        t.nonNull.int("transactionId"); // ← was missing
        t.nonNull.field("transaction", {
            type: "Transaction",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.customerDetails // ← was prisma.paymentDetails (wrong model)
                    .findUnique({ where: { id: parent.id } })
                    .transaction();
            },
        });
    },
});
