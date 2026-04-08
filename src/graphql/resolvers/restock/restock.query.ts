// rai-pos-backend/src/graphql/resolvers/restock/restock.query.ts
import { extendType, nonNull, intArg } from "nexus";
import { requireAuth } from "../../../middleware/auth.middleware.js";

export const RestockQuery = extendType({
  type: "Query",
  definition(t) {

    t.nonNull.list.nonNull.field("getRestockSchedules", {
      type: "RestockSchedule",
      async resolve(_, __, ctx) {
        requireAuth(ctx);
        return ctx.prisma.restockSchedule.findMany({
          where: { orgId: ctx.user.orgId },
          orderBy: { createdAt: "desc" },
          include: {
            scheduleItems: { include: { item: true } },
            cycles: {
              orderBy: { scheduledAt: "asc" },
              include: { cycleItems: { include: { item: true } } },
            },
          },
        });
      },
    });

    t.nullable.field("getRestockSchedule", {
      type: "RestockSchedule",
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        return ctx.prisma.restockSchedule.findFirst({
          where: { id, orgId: ctx.user.orgId },
          include: {
            scheduleItems: { include: { item: true } },
            cycles: {
              orderBy: { scheduledAt: "asc" },
              include: { cycleItems: { include: { item: true } } },
            },
          },
        });
      },
    });

    // Fetch cycles for a schedule (useful for calendar view)
    t.nonNull.list.nonNull.field("getRestockCycles", {
      type: "RestockCycle",
      args: { scheduleId: nonNull(intArg()) },
      async resolve(_, { scheduleId }, ctx) {
        requireAuth(ctx);
        return ctx.prisma.restockCycle.findMany({
          where: { scheduleId, orgId: ctx.user.orgId },
          orderBy: { scheduledAt: "asc" },
          include: { cycleItems: { include: { item: true } } },
        });
      },
    });

  },
});