import { objectType, asNexusMethod } from "nexus";

import { GraphQLDateTime } from "graphql-scalars";

export const DateTime = asNexusMethod(GraphQLDateTime, "dateTime");

export const Branch = objectType({
  name: "Branch",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
    t.nonNull.string("address");
    t.nullable.string("name");
    t.nonNull.dateTime("createdAt"); // ✅ works now
    t.nonNull.boolean("isActive");
    t.nonNull.list.nonNull.field("outlets", {
      type: "Outlet",
      async resolve(parent, _, ctx) {
        return ctx.prisma.outlet.findMany({
          where: { id: parent.id}
        }).outlets()
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
    t.nonNull.list.nonNull.field("branches", {
      type: "Branch",
      resolve: (parent, _, ctx) => {
        return ctx.prisma.branch
          .findUnique({ where: { id: parent.id } })
          .branches();
      },
    });
  },
});
