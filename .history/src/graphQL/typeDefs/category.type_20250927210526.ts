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
          ct.nonNull.int("itemCount", {
            resolve: async (parent, _, ctx) => {
              const result = await ctx.prisma.category.findUnique({
                where: { id: parent.id },
                select: { _count: { select: { Item: true } } },
              });

              // return 0 if no items found
              return result?._count.Item ?? 0;
            },
          });
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
