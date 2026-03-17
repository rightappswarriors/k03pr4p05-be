import { objectType } from "nexus";
export const Branch = objectType({
    name: "Branch",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.string("name");
        t.nonNull.string("address");
        t.nullable.string("phone");
        t.nonNull.dateTime("createdAt"); // ✅ works now
        t.nonNull.boolean("isActive");
        t.nonNull.list.nonNull.field("outlets", {
            type: "Outlet",
            async resolve(parent, _, ctx) {
                return ctx.prisma.outlet.findMany({
                    where: { branchId: parent.id }
                });
            },
        });
        t.nonNull.field("owner", {
            type: "User",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.branch
                    .findUnique({ where: { id: parent.id } })
                    .owner();
            },
        });
    },
});
