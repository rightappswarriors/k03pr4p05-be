/*import { objectType } from "nexus";

export const ModeOfPayment = objectType({
  name: "ModeOfPayment",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
    t.nullable.field("accountLink", { type: "AccountLink" });
    // Relation field (each mode belongs to one supplier)
    t.field("supplier", {
      type: "Supplier",
      resolve: (parent, _, ctx) => {
        return ctx.prisma.modeOfPayment
          .findUnique({ where: { id: parent.id } })
          .supplier();
      },
    });
  },
});

*/