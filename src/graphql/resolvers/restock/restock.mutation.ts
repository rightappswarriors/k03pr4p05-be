// rai-pos-backend/src/graphql/resolvers/restock/restock.mutation.ts
// Adds cycle CRUD mutations alongside existing schedule mutations.

import { extendType, nonNull, intArg } from "nexus";
import { requireAuth, requireRole } from "../../../middleware/auth.middleware.js";
import { registerCycleJob, removeCycleJob, removeRestockJob } from "../../../utils/scheduler.js";

export const RestockMutation = extendType({
  type: "Mutation",
  definition(t) {

    // ─── Existing schedule mutations (unchanged logic) ──────────────────────

    t.field("createRestockSchedule", {
      type: "RestockSchedule",
      args: { data: nonNull("RestockScheduleInput") },
      async resolve(_, { data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
        const { items, ...scheduleData } = data as any;
        const schedule = await ctx.prisma.restockSchedule.create({
          data: {
            ...scheduleData,
            orgId: ctx.user.orgId,
            isActive: true,
            scheduleItems: {
              create: items.map((it: any) => ({
                itemId: it.itemId,
                quantity: it.quantity,
                timeOfDay: it.timeOfDay,
                dayOfWeek: it.dayOfWeek,
                dayOfMonth: it.dayOfMonth,
              })),
            },
          },
          include: { scheduleItems: { include: { item: true } } },
        });
        return schedule;
      },
    });

    t.field("updateRestockSchedule", {
      type: "RestockSchedule",
      args: { id: nonNull(intArg()), data: nonNull("RestockScheduleInput") },
      async resolve(_, { id, data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
        const { items, ...scheduleData } = data as any;
        const updated = await ctx.prisma.restockSchedule.update({
          where: { id },
          data: {
            ...scheduleData,
            orgId: ctx.user.orgId,
            scheduleItems: {
              deleteMany: {},
              create: items.map((it: any) => ({
                itemId: it.itemId,
                quantity: it.quantity,
                timeOfDay: it.timeOfDay,
                dayOfWeek: it.dayOfWeek,
                dayOfMonth: it.dayOfMonth,
              })),
            },
          },
          include: { scheduleItems: { include: { item: true } } },
        });
        return updated;
      },
    });

    t.field("deleteRestockSchedule", {
      type: "RestockSchedule",
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);

        // Remove all cycle jobs for this schedule first
        const cycles = await ctx.prisma.restockCycle.findMany({
          where: { scheduleId: id },
          select: { id: true },
        });
        await Promise.all(cycles.map(c => removeCycleJob(c.id).catch(() => { })));

        return ctx.prisma.restockSchedule.update({
          where: { id },
          data: { deletedAt: new Date() },
          include: { scheduleItems: { include: { item: true } } },
        });
      },
    });

    t.field("toggleRestockSchedule", {
      type: "RestockSchedule",
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);
        const existing = await ctx.prisma.restockSchedule.findUnique({ where: { id } });
        if (!existing) throw new Error("Schedule not found");
        const newActive = !existing.isActive;

        if (!newActive) {
          const cycles = await ctx.prisma.restockCycle.findMany({
            where: { scheduleId: id },
            select: { id: true },
          });
          await Promise.all(cycles.map(c => removeCycleJob(c.id).catch(() => { })));
        }

        const updated = await ctx.prisma.restockSchedule.update({
          where: { id },
          data: { isActive: newActive },
          include: { scheduleItems: { include: { item: true } } },
        });

        if (newActive) {
          const cycles = await ctx.prisma.restockCycle.findMany({
            where: { scheduleId: id, isActive: true },
          });
          await Promise.all(cycles.map(c => registerCycleJob(c).catch(() => { })));
        }

        return updated;
      },
    });

    // ─── NEW: Cycle mutations ───────────────────────────────────────────────

    t.field("createRestockCycle", {
      type: "RestockCycle",
      args: { data: nonNull("RestockCycleInput") },
      async resolve(_, { data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);

        const { items, scheduleId, scheduledAt, emailRecipient, emailSubject, emailBody, branchId, outletId, address, latitude, longitude } = data as any;

        // Verify schedule belongs to this org
        const schedule = await ctx.prisma.restockSchedule.findFirst({
          where: { id: scheduleId, orgId: ctx.user.orgId },
        });
        if (!schedule) throw new Error("Schedule not found");
        if (items.length === 0) throw new Error("A cycle must have at least one item");

        const cycle = await ctx.prisma.restockCycle.create({
          data: {
            scheduleId,
            orgId: ctx.user.orgId,
            branchId: branchId ?? null,
            outletId: outletId ?? null,
            address: address ?? null,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            scheduledAt: new Date(scheduledAt),
            emailRecipient,
            emailSubject: emailSubject ?? null,
            emailBody: emailBody ?? null,
            isActive: true,
            cycleItems: {
              create: items.map((it: any) => ({
                itemId: it.itemId,
                quantity: it.quantity,
              })),
            },
          },
          include: { cycleItems: { include: { item: true } } },
        });

        await registerCycleJob(cycle).catch(err => {
          console.error(`Failed to register cycle job for cycle ${cycle.id}:`, err);
        });

        return cycle;
      },
    });

    t.field("updateRestockCycle", {
      type: "RestockCycle",
      args: { id: nonNull(intArg()), data: nonNull("RestockCycleInput") },
      async resolve(_, { id, data }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);

        const { items, scheduledAt, emailRecipient, emailSubject, emailBody, branchId, outletId, address, latitude, longitude } = data as any;

        // Verify cycle belongs to this org
        const existing = await ctx.prisma.restockCycle.findFirst({
          where: { id, orgId: ctx.user.orgId },
        });
        if (!existing) throw new Error("Cycle not found");
        if (existing.firedAt) throw new Error("Cannot edit a cycle that has already fired");

        // Remove old job
        await removeCycleJob(id).catch(() => { });

        const updated = await ctx.prisma.restockCycle.update({
          where: { id },
          data: {
            branchId: branchId ?? null,
            outletId: outletId ?? null,
            address: address ?? null,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            scheduledAt: new Date(scheduledAt),
            emailRecipient,
            emailSubject: emailSubject ?? null,
            emailBody: emailBody ?? null,
            cycleItems: {
              deleteMany: {},
              create: items.map((it: any) => ({
                itemId: it.itemId,
                quantity: it.quantity,
              })),
            },
          },
          include: { cycleItems: { include: { item: true } } },
        });

        await registerCycleJob(updated).catch(err => {
          console.error(`Failed to re-register cycle job for cycle ${id}:`, err);
        });

        return updated;
      },
    });

    t.field("deleteRestockCycle", {
      type: "RestockCycle",
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);

        const existing = await ctx.prisma.restockCycle.findFirst({
          where: { id, orgId: ctx.user.orgId },
        });
        if (!existing) throw new Error("Cycle not found");

        await removeCycleJob(id).catch(() => { });

        return ctx.prisma.restockCycle.update({
          where: { id },
          data: { deletedAt: new Date() },
          include: { cycleItems: { include: { item: true } } },
        });
      },
    });

    t.field("toggleRestockCycle", {
      type: "RestockCycle",
      args: { id: nonNull(intArg()) },
      async resolve(_, { id }, ctx) {
        requireAuth(ctx);
        requireRole(ctx, ["ADMIN", "MANAGER", "OWNER"]);

        const existing = await ctx.prisma.restockCycle.findFirst({
          where: { id, orgId: ctx.user.orgId },
        });
        if (!existing) throw new Error("Cycle not found");

        const newActive = !existing.isActive;
        if (!newActive) {
          await removeCycleJob(id).catch(() => { });
        }

        const updated = await ctx.prisma.restockCycle.update({
          where: { id },
          data: { isActive: newActive },
          include: { cycleItems: { include: { item: true } } },
        });

        if (newActive && !updated.firedAt) {
          await registerCycleJob(updated).catch(() => { });
        }

        return updated;
      },
    });
  },
});
