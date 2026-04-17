import { objectType, enumType } from "nexus";
export const OutletType = enumType({
    name: "OutletType",
    members: ["retail", "wholesale", "service"],
});
export const OutletStatus = enumType({
    name: "OutletStatus",
    members: ["open", "closed", "maintenance"]
});
export const Outlet = objectType({
    name: "Outlet",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.string("name");
        t.nonNull.string("address");
        t.nonNull.string("code");
        t.nullable.string("phone");
        t.nullable.float("latitude");
        t.nullable.float("longitude");
        t.nullable.int("nextTransactionNumber");
        t.nullable.field("status", { type: "OutletStatus" });
        t.nullable.float("governmentTax");
        t.nullable.float("serviceCharge");
        t.nonNull.field("outletType", { type: "OutletType" });
        t.nonNull.dateTime('createdAt');
        t.nullable.string("wifiSSID");
        t.nonNull.boolean("isActive");
        t.nullable.int("branchId");
        t.nonNull.int("ownerId");
        t.nullable.int("apiKeyId");
        t.nullable.boolean("hasKey");
        t.nullable.string("bannerImage");
        t.nonNull.int("orgId"); // Added for multi-tenancy
        t.string("tin"); // Added for tax identification number
        t.string("ptu"); // Added for previous tax identification number
        t.string("bir"); // Added for business identification number
        t.nonNull.boolean("isVatRegistered");
        t.float("vatZeroSale");
        t.nullable.int("vatTypeId");
        t.nullable.field("vatType", {
            type: "VatType",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .vatType();
            }
        });
        { /** t.nullable.field("deliveryConfig", {
          type: "OutletDeliveryConfig",
          resolve: (parent, _, ctx) => {
            return ctx.prisma.outlet
              .findUnique({ where: { id: parent.id } })
              .deliveryConfig();
          },
        }); **/
        }
        { /**  t.nonNull.list.nonNull.field("kompraCOrders", {
          type: "KompraCOrder",
          resolve: (parent, _, ctx) => {
            return ctx.prisma.outlet
              .findUnique({ where: { id: parent.id } })
              .kompraCOrders();
          },
        }); */
        }
        t.nonNull.list.nonNull.field("itemSearchIndex", {
            type: "OutletItemSearchIndex",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .itemSearchIndex();
            },
        });
        t.nonNull.list.nonNull.field("outletPromos", {
            type: "OutletPromo",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .outletPromos();
            },
        });
        t.nonNull.list.nonNull.field("restockSchedules", {
            type: "RestockSchedule",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .restockSchedules();
            },
        });
        /**
        t.nonNull.list.nonNull.field("notifications", {
          type: "Notification",
          resolve: (parent, _, ctx) => {
            return ctx.prisma.outlet
              .findUnique({ where: { id: parent.id } })
              .notifications();
          },
        }); */
        t.nonNull.field("org", {
            type: "Organization",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .org();
            },
        });
        t.nonNull.field("owner", {
            type: "User",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .owner();
            },
        });
        t.nullable.field("branch", {
            type: "Branch",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .branch();
            },
        });
        t.nonNull.list.nonNull.field("staff", {
            type: "OutletStaff",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .staff();
            },
        });
        t.nullable.field("inventory", {
            type: "Inventory",
            resolve: async (parent, _, ctx) => {
                // If inventory was pre-loaded by the service, return it directly
                if (parent.inventory && typeof parent.inventory === "object") {
                    return parent.inventory; // ← preserves the items array
                }
                // Fallback for queries that don't pre-load inventory
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .inventory();
            },
        });
        t.nonNull.list.nonNull.field("transactions", {
            type: "Transaction",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet //findMany -> unique
                    .findUnique({ where: { id: parent.id } }).transactions();
            },
        });
        t.nullable.field("apiKey", {
            type: "PaymongoAPIKeys",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outlet
                    .findUnique({ where: { id: parent.id } })
                    .apiKey();
            }
        });
    },
});
