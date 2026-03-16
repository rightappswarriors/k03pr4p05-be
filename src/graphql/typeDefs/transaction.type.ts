// ─────────────────────────────────────────────────────────────────────────────
// FILE 1: transaction.type.ts  — fixes for your existing Nexus type
// ─────────────────────────────────────────────────────────────────────────────
//
// Issues found in your current Transaction objectType:
//
// 1. t.nonNull.float("tax") — "tax" does not exist on the Transaction model.
//    The schema has vatAmount. Remove tax, add vatAmount.
//
// 2. t.nullable.field("paymentDetails") calls .paymentDetails() fluent API
//    but your schema has CustomerDetails (not PaymentDetails) related by
//    customerDetailsId. The relation name is "customerDetails", not paymentDetails.
//    Rename the field and the resolver.
//
// 3. Status enum is missing "PAID" and "SYNCED" members — your schema has:
//    PENDING, PAID, SYNCED, FAILED, CANCELED
//
// REPLACE your transaction.type.ts with:

import { objectType, enumType } from "nexus";

export const PaymentMethodEnum = enumType({
  name: "PaymentMethod",
  members: ["CASH", "CARD", "E_WALLET"],
});

export const StatusEnum = enumType({
  name: "Status",
  members: ["PENDING", "PAID", "SYNCED", "FAILED", "CANCELED"], // ← added PAID + SYNCED
});

export const Transaction = objectType({
  name: "Transaction",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.int("outletId");
    t.nonNull.field("outlet", {
      type: "Outlet",
      resolve: (parent, _, ctx) =>
        ctx.prisma.transaction.findUnique({ where: { id: parent.id } }).outlet(),
    });
    t.nonNull.int("cashierId");
    t.nonNull.field("cashier", {
      type: "User",
      resolve: (parent, _, ctx) =>
        ctx.prisma.transaction.findUnique({ where: { id: parent.id } }).cashier(),
    });
    t.nonNull.list.nonNull.field("items", {
      type: "CartItem",
      resolve: (parent, _, ctx) =>
        ctx.prisma.transaction.findUnique({ where: { id: parent.id } }).items(),
    });
    t.nonNull.float("total");
    t.nonNull.float("subtotal");
    t.nonNull.float("vatAmount");    // ← was "tax" — matches schema field name
    t.nullable.float("cashReceived");
    t.nullable.float("change");
    t.nonNull.field("paymentMethod", { type: "PaymentMethod" });
    t.nonNull.field("status", { type: "Status" });
    t.nonNull.dateTime("createdAt");
    t.nonNull.dateTime("syncedAt");
    // ← was "paymentDetails" — schema relation is "customerDetails"
    t.nullable.field("customerDetails", {
      type: "CustomerDetails",
      resolve: (parent, _, ctx) =>
        ctx.prisma.transaction
          .findUnique({ where: { id: parent.id } })
          .customerDetails(),
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// FILE 2: detailsContent.tsx  — add live transaction stats
// Replace your DetailsContent component with this
// ─────────────────────────────────────────────────────────────────────────────