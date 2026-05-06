// salesOrder.type.ts
import { enumType, objectType } from 'nexus'

export const SalesOrderType = objectType({
  name: "SalesOrder",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("orderNumber");
    t.nonNull.string("customer");
    t.nonNull.field("status", { type: "SalesOrderStatusEnum" });
    t.nonNull.dateTime("date");
    t.nonNull.dateTime("updatedAt");
    t.nonNull.int("orgId");
    t.nullable.int("userId");
    t.nullable.int("outletId");
    t.nullable.int("branchId");
    t.nonNull.float("subtotal");
    t.nonNull.float("discountAmount");
    t.nonNull.float("vatAmount");
    t.nonNull.float("total");
    t.nonNull.float("vatRate");
    t.nonNull.float("discountRate");
    t.nullable.int("outletPromoId");
    t.list.field("items", {
      type: "SalesOrderItem",
      resolve: (parent, _, ctx) =>
        ctx.prisma.salesOrderItem.findMany({ where: { salesOrderId: parent.id } }),
    });
    t.nullable.field("delivery", {
      type: "SalesOrderDelivery",
      resolve: (parent, _, ctx) =>
        ctx.prisma.salesOrderDelivery.findUnique({ where: { salesOrderId: parent.id } }),
    });
    t.nullable.field("outlet", {
      type: "Outlet",
      resolve: (parent, _, ctx) =>
        parent.outletId
          ? ctx.prisma.outlet.findUnique({ where: { id: parent.outletId } })
          : null,
    });
    t.nullable.field("branch", {
      type: "Branch",
      resolve: (parent, _, ctx) =>
        parent.branchId
          ? ctx.prisma.branch.findUnique({ where: { id: parent.branchId } })
          : null,
    });
  },
});

export const SalesOrderDeliveryType = objectType({
  name: "SalesOrderDelivery",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("salesOrderId");
    t.nullable.string("courierName");
    t.nullable.string("trackingNumber");
    t.nonNull.string("address");
    t.nullable.string("contactPerson");
    t.nullable.string("contactNumber");
    t.nullable.string("notes");
    t.nullable.string("estimatedDate");
    t.nullable.dateTime("shippedAt");
    t.nullable.dateTime("receivedAt");
  },
});

export const SalesOrderItemType = objectType({
  name: "SalesOrderItem",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("salesOrderId");
    t.nonNull.int("itemId");
    t.nonNull.float("quantity");
    t.nonNull.float("unitPrice");
    t.nonNull.float("totalPrice");
    t.nullable.int("unitId");
    t.nullable.string("unitName");
    t.nullable.float("discountQuantity");
    t.nullable.float("discountRate");
    t.nullable.float("discountAmount");
    t.field("item", {
      type: "Item",
      resolve: (parent, _, ctx) =>
        ctx.prisma.item.findUnique({ where: { id: parent.itemId } }),
    });
  },
});

export const SalesOrderStatusEnum = enumType({
  name: "SalesOrderStatusEnum",
  members: ["ORDERED", "PROCESSING", "SHIPPED", "RECEIVED", "CANCELLED"],
});

// ─── InventoryItemsForSales ───────────────────────────────────────────────────
// Extends the shared InventoryItems type with the nested inventory→outlet
// path that the "no outlet selected → tag each item with its outlet" feature
// requires. If your existing InventoryItems objectType already lives elsewhere
// (e.g. inventory.type.ts), add the two fields below to it instead of
// duplicating the whole type.
//
// KEY ADDITIONS vs. the base type:
//   • item.vatExempt      — needed for per-item VAT exclusion (Fix 4)
//   • inventory.outlet    — needed for outlet name tag (Fix: all-org view)
// ─────────────────────────────────────────────────────────────────────────────

// Lightweight outlet summary exposed on inventory (for item tagging)
export const InventoryOutletSummaryType = objectType({
  name: "InventoryOutletSummary",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
    t.nonNull.string("code");
  },
});

// Inventory wrapper exposed on InventoryItems (carries the outlet tag)
export const InventoryForItemType = objectType({
  name: "InventoryForItem",
  definition(t) {
    t.nonNull.int("id");
    // outlet is nullable — safety guard for orphaned inventory rows
    t.nullable.field("outlet", {
      type: "InventoryOutletSummary",
      resolve: (parent: any, _, ctx) =>
        parent.outletId
          ? ctx.prisma.outlet.findUnique({
              where: { id: parent.outletId },
              select: { id: true, name: true, code: true },
            })
          : null,
    });
  },
});

// ─── Inventory Items Search Result ───────────────────────────────────────────
export const InventoryItemsSearchResultType = objectType({
  name: "InventoryItemsSearchResult",
  definition(t) {
    t.nonNull.list.nonNull.field("items", { type: "InventoryItems" });
    t.nonNull.boolean("hasMore");
  },
});