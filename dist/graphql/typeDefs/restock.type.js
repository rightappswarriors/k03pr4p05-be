// rai-pos-backend/src/graphql/typeDefs/restock.type.ts
// Adds RestockCycle + RestockCycleItem types and inputs.
// All existing types are preserved unchanged.
import { enumType, inputObjectType, objectType } from "nexus";
export const RecurrenceTypeEnum = enumType({
    name: "RecurrenceType",
    members: ["once", "daily", "weekly", "monthly", "custom"],
});
// ─── Existing types (unchanged) ───────────────────────────────────────────────
export const RestockScheduleItemType = objectType({
    name: "RestockScheduleItem",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("scheduleId");
        t.nonNull.int("itemId");
        t.nonNull.float("quantity");
        t.nullable.string("timeOfDay");
        t.nullable.int("dayOfWeek");
        t.nullable.int("dayOfMonth");
        t.nonNull.field("item", {
            type: "Item",
            resolve: (parent, _, ctx) => ctx.prisma.restockScheduleItem.findUnique({ where: { id: parent.id } }).item(),
        });
    },
});
export const RestockScheduleType = objectType({
    name: "RestockSchedule",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("orgId");
        t.nullable.int("branchId");
        t.nullable.int("outletId");
        t.nullable.string("address");
        t.nullable.float("latitude");
        t.nullable.float("longitude");
        t.nonNull.field("recurrence", { type: "RecurrenceType" });
        t.nullable.dateTime("startDate");
        t.nullable.dateTime("endDate");
        t.nonNull.string("timeOfDay");
        t.nullable.int("dayOfWeek");
        t.nullable.int("dayOfMonth");
        t.nonNull.string("emailRecipient");
        t.nullable.string("emailSubject");
        t.nullable.string("emailBody");
        t.nullable.field("customTimes", { type: "Json" });
        t.nonNull.boolean("isActive");
        t.nullable.dateTime("lastTriggeredAt");
        t.nonNull.dateTime("createdAt");
        t.nonNull.dateTime("updatedAt");
        t.field("branch", {
            type: "Branch",
            resolve: (parent, _, ctx) => parent.branchId ? ctx.prisma.branch.findUnique({ where: { id: parent.branchId } }) : null,
        });
        t.field("outlet", {
            type: "Outlet",
            resolve: (parent, _, ctx) => parent.outletId ? ctx.prisma.outlet.findUnique({ where: { id: parent.outletId } }) : null,
        });
        t.nonNull.list.nonNull.field("scheduleItems", {
            type: "RestockScheduleItem",
            resolve: (parent, _, ctx) => ctx.prisma.restockSchedule.findUnique({ where: { id: parent.id } }).scheduleItems({
                include: { item: true },
            }),
        });
        // NEW — expose cycles on the schedule
        t.nonNull.list.nonNull.field("cycles", {
            type: "RestockCycle",
            resolve: (parent, _, ctx) => ctx.prisma.restockSchedule.findUnique({ where: { id: parent.id } }).cycles({
                orderBy: { scheduledAt: "asc" },
            }),
        });
    },
});
// ─── NEW: RestockCycle types ──────────────────────────────────────────────────
export const RestockCycleItemType = objectType({
    name: "RestockCycleItem",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("cycleId");
        t.nonNull.int("itemId");
        t.nonNull.float("quantity");
        t.nonNull.field("item", {
            type: "Item",
            resolve: (parent, _, ctx) => ctx.prisma.restockCycleItem.findUnique({ where: { id: parent.id } }).item(),
        });
    },
});
export const RestockCycleType = objectType({
    name: "RestockCycle",
    definition(t) {
        t.nonNull.int("id");
        t.nonNull.int("scheduleId");
        t.nonNull.int("orgId");
        t.nullable.int("branchId");
        t.nullable.int("outletId");
        t.nullable.string("address");
        t.nullable.float("latitude");
        t.nullable.float("longitude");
        t.nonNull.dateTime("scheduledAt"); // exact UTC fire time
        t.nonNull.string("emailRecipient"); // supplier email for this cycle
        t.nullable.string("emailSubject");
        t.nullable.string("emailBody");
        t.nonNull.boolean("isActive");
        t.nullable.dateTime("firedAt"); // set when job actually ran
        t.nonNull.dateTime("createdAt");
        t.nonNull.dateTime("updatedAt");
        t.field("branch", {
            type: "Branch",
            resolve: (parent, _, ctx) => parent.branchId ? ctx.prisma.branch.findUnique({ where: { id: parent.branchId } }) : null,
        });
        t.field("outlet", {
            type: "Outlet",
            resolve: (parent, _, ctx) => parent.outletId ? ctx.prisma.outlet.findUnique({ where: { id: parent.outletId } }) : null,
        });
        t.nonNull.list.nonNull.field("cycleItems", {
            type: "RestockCycleItem",
            resolve: (parent, _, ctx) => ctx.prisma.restockCycle.findUnique({ where: { id: parent.id } }).cycleItems({
                include: { item: true },
            }),
        });
    },
});
// ─── Input types ──────────────────────────────────────────────────────────────
export const RestockScheduleItemInput = inputObjectType({
    name: "RestockScheduleItemInput",
    definition(t) {
        t.nonNull.int("itemId");
        t.nonNull.float("quantity");
        t.nullable.string("timeOfDay");
        t.nullable.int("dayOfWeek");
        t.nullable.int("dayOfMonth");
    },
});
export const RestockScheduleInput = inputObjectType({
    name: "RestockScheduleInput",
    definition(t) {
        t.nullable.int("branchId");
        t.nullable.int("outletId");
        t.nullable.string("address");
        t.nullable.float("latitude");
        t.nullable.float("longitude");
        t.nonNull.list.nonNull.field("items", { type: "RestockScheduleItemInput" });
        t.nonNull.field("recurrence", { type: "RecurrenceType" });
        t.nonNull.field("startDate", { type: "DateTime" });
        t.nullable.field("endDate", { type: "DateTime" });
        t.nonNull.string("timeOfDay");
        t.nullable.int("dayOfWeek");
        t.nullable.int("dayOfMonth");
        t.nonNull.string("emailRecipient");
        t.nullable.string("emailSubject");
        t.nullable.string("emailBody");
        t.nullable.field("customTimes", { type: "Json" });
    },
});
// NEW — input for creating/updating a single cycle
export const RestockCycleItemInput = inputObjectType({
    name: "RestockCycleItemInput",
    definition(t) {
        t.nonNull.int("itemId");
        t.nonNull.float("quantity");
    },
});
export const RestockCycleInput = inputObjectType({
    name: "RestockCycleInput",
    definition(t) {
        t.nonNull.int("scheduleId");
        t.nullable.int("branchId");
        t.nullable.int("outletId");
        t.nullable.string("address");
        t.nullable.float("latitude");
        t.nullable.float("longitude");
        t.nonNull.field("scheduledAt", { type: "DateTime" }); // exact UTC fire time
        t.nonNull.string("emailRecipient");
        t.nullable.string("emailSubject");
        t.nullable.string("emailBody");
        t.nonNull.list.nonNull.field("items", { type: "RestockCycleItemInput" });
    },
});
