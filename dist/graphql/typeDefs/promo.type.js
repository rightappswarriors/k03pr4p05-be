import { objectType, } from "nexus";
export const PromoType = objectType({
    name: "PromoType",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.string("name");
        t.nullable.string("description");
        t.nonNull.boolean("isActive");
        t.nonNull.dateTime("createdAt");
        t.nullable.int("userId");
        t.nonNull.int("orgId"); // Added for multi-tenancy
        t.nonNull.field("org", {
            type: "Organization",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.promoType.findUnique({ where: { id: parent.id } }).org();
            }
        });
        t.nullable.field("user", {
            type: "User",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.promoType.findUnique({ where: { id: parent.id } }).user();
            }
        });
        t.nonNull.list.nonNull.field("outletPromos", {
            type: "OutletPromo",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.promoType.findUnique({
                    where: {
                        id: parent.id
                    }
                }).outletPromos();
            }
        });
    }
});
