import { objectType, enumType } from "nexus";
export const PaymentMethodEnum = enumType({
    name: "PaymentMethod",
    members: ["CASH", "CARD", "E_WALLET"],
});
export const StatusEnum = enumType({
    name: "Status",
    members: ["PENDING", "PAID", "SYNCED", "FAILED", "CANCELED", "COMPLETED"],
});
// ── New enum for VAT exempt type ─────────────────────────────────────────────
export const VatExemptTypeEnum = enumType({
    name: "VatExemptType",
    members: ["SENIOR_CITIZEN", "PWD", "DIPLOMAT", "GOVERNMENT"],
});
export const Transaction = objectType({
    name: "Transaction",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("outletId");
        t.nonNull.field("outlet", {
            type: "Outlet",
            resolve: (parent, _, ctx) => ctx.prisma.transaction.findUnique({ where: { id: parent.id } }).outlet(),
        });
        t.nonNull.int("cashierId");
        t.nonNull.field("cashier", {
            type: "User",
            resolve: (parent, _, ctx) => ctx.prisma.transaction.findUnique({ where: { id: parent.id } }).cashier(),
        });
        t.nonNull.list.nonNull.field("items", {
            type: "CartItem",
            resolve: (parent, _, ctx) => ctx.prisma.transaction.findUnique({ where: { id: parent.id } }).items(),
        });
        t.nonNull.float("total");
        t.nonNull.float("subtotal");
        t.nonNull.float("vatAmount");
        t.nullable.float("cashReceived");
        t.nullable.float("change");
        t.nullable.string("discountType");
        t.nullable.float("discountAmount");
        t.nonNull.field("paymentMethod", { type: "PaymentMethod" });
        t.nonNull.field("status", { type: "Status" });
        t.nonNull.dateTime("createdAt");
        t.nonNull.dateTime("syncedAt");
        t.nullable.field("customerDetails", {
            type: "CustomerDetails",
            resolve: (parent, _, ctx) => ctx.prisma.transaction
                .findUnique({ where: { id: parent.id } })
                .customerDetails(),
        });
        // ── VAT Exemption fields ──────────────────────────────────────────────────
        t.nonNull.boolean("isVatExempt");
        t.nullable.field("vatExemptType", { type: "VatExemptType" });
        t.nullable.string("vatExemptRefNo"); // SC/PWD ID for BIR
        t.nullable.float("vatExemptAmount"); // total VAT removed
        // ── Promo link ────────────────────────────────────────────────────────────
        t.nullable.int("outletPromoId");
        t.nullable.float("promoDiscountAmt");
        t.nullable.field("outletPromo", {
            type: "OutletPromo",
            resolve: (parent, _, ctx) => ctx.prisma.transaction
                .findUnique({ where: { id: parent.id } })
                .outletPromo(),
        });
    },
});
