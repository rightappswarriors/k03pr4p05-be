import { objectType } from "nexus";

export const Category = objectType({
  name: "Category",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
      t.field("_count", {
        type: objectType({
          name: "CategoryCount",
          definition(ct) {
            ct.int("itemCount");
          },
        }),
      });
    t.nonNull.list.nonNull.field("items", {
      type: "Item",
      resolve: (parent, _, ctx) => {
        return ctx.prisma.category
          .findUnique({ where: { id: parent.id } })
          .items();
      },
    });
  },
});
