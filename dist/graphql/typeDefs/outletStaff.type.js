import { objectType } from "nexus";
export const OuteltStaff = objectType({
    name: "OutletStaff",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("outletId");
        t.nonNull.int("userId");
        t.nonNull.field("role", { type: "Role" });
        t.nonNull.boolean("isPresent");
        t.nonNull.field("outlet", {
            type: "Outlet",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outletStaff
                    .findUnique({ where: { id: parent.id } })
                    .outlet();
            },
        }); // Relationship to the User who is the staff member
        t.nonNull.field("user", {
            type: "User",
            resolve: (parent, _, ctx) => {
                return ctx.prisma.outletStaff
                    .findUnique({ where: { id: parent.id } })
                    .user();
            },
        });
    },
});
