import { objectType, } from "nexus";


export const OutletPromo = objectType({
    name: "OutletPromo",
    definition(t) {
        t.nonNull.int("id"),
            t.nonNull.int("outletId")
        t.nonNull.int("promoTypeId")
        t.nonNull.float("discount")
        t.nonNull.dateTime("createdAt")
        t.nonNull.boolean("isActive")
        t.nonNull.int("userId")
        t.nonNull.field("user", {
            type: "User",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outletPromo.findUnique({
                    where: {
                        id: parent.id
                    }
                }).user();
            }
        });
        t.nonNull.field("outlet", {
            type: "Outlet",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outletPromo.findUnique({
                    where: {
                        id: parent.id
                    }
                }).outlet();
            }
        });
        t.nonNull.field("promoType", {
            type: "PromoType",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outletPromo.findUnique({
                    where: {
                        id: parent.id
                    }
                }).promoType();
            }
        });
    },
})