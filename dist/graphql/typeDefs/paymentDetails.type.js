import { enumType, objectType } from 'nexus';
export const PaymentType = enumType({
    name: "PaymentType",
    members: ["GCASH", "PAYMAYA", "CARD"]
});
export const PaymentDetails = objectType({
    name: "PaymentDetails",
    definition(t) {
        t.nullable.int("id");
        t.nullable.string("fullname");
        t.nullable.string("username");
        t.nullable.string("email");
        t.nullable.field('type', { type: "PaymentType" });
        t.nullable.string("paymentMethodId");
        t.nullable.string("paymentIntentId");
        t.nullable.string("status");
        t.nonNull.field("transaction", {
            type: "Transaction",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.paymentDetails
                    .findUnique({ where: { id: parent.id } })
                    .transaction();
            }
        });
    }
});
