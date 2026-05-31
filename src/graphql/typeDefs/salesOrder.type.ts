// salesOrder.type.ts
import { enumType, inputObjectType, objectType } from 'nexus'

export const SalesOrderType = objectType({
  name: "SalesOrder",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("orderNumber");
    t.nonNull.string("customer");
    t.nonNull.field("orderMode", { type: "OrderModeEnum" });
    t.nonNull.field("status", { type: "SalesOrderStatusEnum" });
    t.nonNull.dateTime("date");
    t.nonNull.dateTime("updatedAt");
    t.nonNull.int("orgId");
    t.nullable.int("userId");
    t.nullable.int("outletId");
    t.nullable.int("branchId");
    t.nullable.string("customerName");
    t.nullable.string("customerContact");
    t.nonNull.field("customerType", { type: "CustomerType" });
    t.nonNull.field("discountType", { type: "DiscountType" });
    t.nonNull.float("subtotal");
    t.nonNull.float("discountAmount");
    t.nonNull.float("vatAmount");
    t.nonNull.float("vatExemptSale");
    t.nonNull.float("total");
    t.nonNull.float("vatRate");
    t.nonNull.float("discountRate");
    t.nullable.int("totalPax");
    t.nullable.int("scPwdPax");
    t.nullable.string("deliveryAddress");
    t.nullable.string("deliveryNotes");
    t.nonNull.float("extraChargesTotal");
    t.nonNull.float("grandTotal");
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
    t.nullable.field("scPwdCustomer", {
      type: "ScPwdCustomer",
      resolve: (parent, _, ctx) =>
        parent.scPwdCustomerId
          ? ctx.prisma.scPwdCustomer.findUnique({ where: { id: parent.scPwdCustomerId } })
          : null,
    });
    t.nonNull.list.nonNull.field("extraCharges", {
      type: "ExtraCharge",
      resolve: (parent, _, ctx) =>
        ctx.prisma.extraCharge.findMany({
          where: { salesOrderId: parent.id },
          orderBy: { createdAt: "asc" },
        }),
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

export const ExtraChargeType = objectType({
  name: "ExtraCharge",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("label");
    t.nonNull.float("amount");
    t.nonNull.string("salesOrderId");
    t.nonNull.dateTime("createdAt");
  },
});

export const ExtraChargeInput = inputObjectType({
  name: "ExtraChargeInput",
  definition(t) {
    t.nonNull.string("label");
    t.nonNull.float("amount");
  },
});


export const SalesOrderItemType = objectType({
  name: "SalesOrderItem",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("salesOrderId");
    // itemId is now nullable — null when isCustomItem = true
    t.nullable.int("itemId");
    t.nonNull.float("quantity");
    t.nonNull.float("unitPrice");
    t.nonNull.float("totalPrice");
    t.nullable.int("unitId");
    t.nullable.string("unitName");
    t.nullable.float("discountQuantity");
    t.nullable.float("discountRate");
    t.nullable.float("discountAmount");
    t.nonNull.field("discountType", { type: "DiscountType" });
    // ── Custom item fields ────────────────────────────────────────────────
    t.nonNull.boolean("isCustomItem");
    t.nullable.string("customItemName");
    t.nonNull.boolean("vatExempt");
    // item resolver is nullable — will be null for custom items
    t.nullable.field("item", {
      type: "Item",
      resolve: (parent, _, ctx) =>
        parent.itemId
          ? ctx.prisma.item.findUnique({ where: { id: parent.itemId } })
          : null,
    });
  },
});
 

export const SalesOrderStatusEnum = enumType({
  name: "SalesOrderStatusEnum",
  members: ["PENDING", "PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED", "RECEIVED", "ORDERED", "SHIPPED"],
});

export const OrderModeEnum = enumType({
  name: "OrderModeEnum",
  members: ["WALK_IN", "PICK_UP", "DELIVERY"],
});

export const SalesOrderFilterInput = inputObjectType({
  name: "SalesOrderFilterInput",
  definition(t) {
    t.nullable.field("status", { type: "SalesOrderStatusEnum" });
    t.nullable.field("orderMode", { type: "OrderModeEnum" });
    t.nullable.field("discountType", { type: "DiscountType" });
    t.nullable.string("startDate");
    t.nullable.string("endDate");
    t.nullable.string("customerName");
  },
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
