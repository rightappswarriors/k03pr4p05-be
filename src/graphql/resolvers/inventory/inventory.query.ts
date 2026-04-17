import { extendType, nonNull, intArg, stringArg, arg, objectType } from "nexus";
import { requireAuth, requireOwnership, requireRole } from "../../../middleware/auth.middleware.js";
import * as inventoryService from "../../../services/inventory.service.js";


// Add this objectType
export const OutletStockRow = objectType({
  name: "OutletStockRow",
  definition(t) {
    t.nonNull.int("outletId")
    t.nonNull.string("outletName")
    t.nonNull.float("quantity")
    t.nonNull.string("baseUnit")
    t.nullable.float("reorderPoint")
    t.nonNull.string("status") // "OK" | "LOW" | "CRITICAL"
  }
})

export const ItemStockDistribution = objectType({
  name: "ItemStockDistribution",
  definition(t) {
    t.nonNull.int("itemId")
    t.nonNull.string("itemName")
    t.nonNull.float("totalStock")
    t.nonNull.float("minQuantity")
    t.nonNull.string("stockLabel")
    t.nullable.string("stockDescription")
    t.nonNull.float("warehouseStock")
    t.nonNull.float("totalAssigned")
    t.nonNull.list.nonNull.field("outlets", { type: "OutletStockRow" })
  }
})

// Add inside InventoryQuery definition(t)


export const InventoryQuery = extendType({
  type: "Query",
  definition(t) {
    // Get inventory by outletId
    // Used by the create_new flow in route.ts:
    //   1. createItems mutation creates the Item row
    //   2. itemByName fetches the new item's id
    //   3. addItemsToInventory links it to the inventory
    t.nullable.field("getItemStockDistribution", {
      type: "ItemStockDistribution",
      args: { itemId: nonNull(intArg()) },
      async resolve(_, { itemId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "OWNER", "MANAGER"]);
        return inventoryService.getItemStockDistribution(itemId, ctx.user.orgId);
      }
    })
    t.nullable.field("itemByName", {
      type: "Item",
      args: {
        name: nonNull(stringArg()),
      },
      async resolve(_, { name }, ctx) {
        return ctx.prisma.item.findUnique({
          where: { name },
          include: {
            category: true,
            brandDetails: true,
            color: true,
            purchaseUnit: true,
            media: { orderBy: { sortOrder: "asc" } },
          },
        });
      },
    });
    // inventory.query.ts  — add inside the extendType definition(t) block
    t.nullable.field("inventoryItemByKeys", {
      type: "InventoryItems",
      args: {
        inventoryId: nonNull(intArg()),
        itemId: nonNull(intArg()),
      },
      async resolve(_, { inventoryId, itemId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
        return ctx.prisma.inventoryItems.findUnique({
          where: { inventoryId_itemId: { inventoryId, itemId } },
        });
      },
    })
    t.field("getInventoryByOutletId", {
      type: "Outlet",
      args: {
        outletId: nonNull(intArg()),
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
        await requireOwnership(ctx, "Outlet", outletId)
        try {
          const inventory = await inventoryService.getInventoryByOutletId(Number(outletId));
          if (!inventory) {
            throw new Error("Error getting inventory by Outlet")
          }
          return inventory
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error getting Inventory:", error);
          throw new Error("Failed to get inventory.");
        }
      },
    });
    // Get items by outlet
    t.list.field("getItemsByOutlet", {
      type: "InventoryItems",
      args: {
        outletId: nonNull(arg({ type: "ID" })),
      },
      async resolve(_, { outletId }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
        await requireOwnership(ctx, "Outlet", outletId);
        try {
          if (process.env.NODE_ENV === "development") console.log("Fetching inventory for outletId:", outletId);
          const inventory = await ctx.prisma.inventory.findUnique({
            where: { outletId: Number(outletId) },
            include: { items: { include: { item: true, units: true } } },
          });
          if (!inventory) {
            throw new Error("Inventory not found for outlet");
          }
          if (process.env.NODE_ENV === "development") console.log("Inventory fetched successfully:", inventory.inventoryItems);
          return inventory.items;
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error getting items by outlet:", error);
          throw new Error("Failed to get outlet items.");
        }
      },
    });
    // !GET invetory Items
    // Get inventory items by rack
    t.list.field("getInventoryItemsByRack", {
      type: "InventoryItems",
      args: {
        inventoryId: nonNull(intArg()),
        rackName: nonNull(stringArg()),
      },

      async resolve(_, { inventoryId, rackName }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);

        try {
          return await inventoryService.getInventoryItemsByRack(
            inventoryId,
            rackName
          );
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error retrieving Inventory:", error);
          throw new Error("Failed to fetch inventory items by rack.");
        }
      },
    });
    t.field('getDashboardInventoryStats', {
      type: 'DashboardInventoryStats',
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ['ADMIN', 'MANAGER', 'OWNER']);
        return inventoryService.getDashboardInventoryStats(Number(ctx.user.orgId));
      },
    });
     t.list.field("getItems", {
      type: "Item",
      args: {
        query: stringArg(),
        size: intArg(),
      },
      async resolve(_, { query, size }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);

        try {
          return await inventoryService.getAllItems(ctx.user.orgId, query || undefined, size || 100);
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.error("Error retrieving items:", error);
          throw new Error("Failed to fetch items.");
        }
      },
    });
  },
});

export const InventoryCategoryBreakdown = objectType({
  name: 'InventoryCategoryBreakdown',
  definition(t) {
    t.nonNull.string('name');
    t.nonNull.float('totalStock');
  },
});

export const DashboardInventoryStats = objectType({
  name: 'DashboardInventoryStats',
  definition(t) {
    t.nonNull.int('skuCount');       // distinct product count
    t.nonNull.float('totalUnits');   // sum of all stock
    t.nonNull.list.nonNull.field('categoryBreakdown', {
      type: 'InventoryCategoryBreakdown',
    });
  },
});