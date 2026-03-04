import { objectType, } from "nexus"

export const PromoType = objectType({
    name: "PromoType",
    definition(t) {
        t.nonNull.int("id"),
            t.nonNull.string("name"),
            t.nullable.string("description"),
            t.nonNull.boolean("isActive"),
            t.nonNull.dateTime("createdAt")
        t.nonNull.list.nonNull.field("outletPromos", {
            type: "OutletPromo",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.promo.findUnique({
                    where: {
                        id: parent.id
                    }
                }).outletPromos()
            }
        })
    }
})