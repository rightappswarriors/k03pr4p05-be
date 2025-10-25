import { objectType } from "nexus";

export const Supplier = objectType({
  name: "Supplier",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");

    t.nullable.string("address");

    t.nullable.string("zipCode");

    t.nullable.string("faxNumber");
    t.nullable.string("tinNumber");

    t.nullable.string("contactName");
    t.nonNull.string("contactNumber");
    // Relation field (one supplier → many modes)
    t.nonNull.list.nonNull.field("modesOfPayment", {
      type: "ModeOfPayment",
      resolve: (parent, _, ctx) => {
        return ctx.prisma.supplier
          .findUnique({ where: { id: parent.id } })
          .modesOfPayment();
      },
    });
  },
});
