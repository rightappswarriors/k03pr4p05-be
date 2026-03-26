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
        t.nullable.string("imageBanner");
        t.nonNull.int("orgId"); // Added for multi-tenancy
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
