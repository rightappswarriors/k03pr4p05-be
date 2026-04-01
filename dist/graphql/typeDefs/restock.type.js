import { enumType, inputObjectType, objectType } from "nexus";
export const RecurrenceTypeEnum = enumType({
    name: "RecurrenceType",
    members: ["once", "daily", "weekly", "monthly"],
});
export const RestockSchedule = objectType({
    name: "RestockSchedule",
    definition(t) {
        t.int("id");
        t.int("itemId");
        t.int("orgId");
        t.field("recurrence", { type: "RecurrenceType" });
        t.nullable.dateTime("startDate");
        t.nullable.dateTime("endDate");
        t.string("timeOfDay");
        t.nullable.int("dayOfWeek");
        t.nullable.int("dayOfMonth");
        t.string("emailRecipient");
        t.nullable.string("emailSubject");
        t.nullable.string("emailBody");
        t.boolean("isActive");
        t.nullable.dateTime("lastTriggeredAt");
        t.dateTime("createdAt");
    }
});
export const RestockScheduleInput = inputObjectType({
    name: "RestockScheduleInput",
    definition(t) {
        t.int("itemId");
        t.field("recurrence", { type: "RecurrenceType" });
        t.nonNull.field("startDate", { type: "DateTime" });
        t.nonNull.field("endDate", { type: "DateTime" });
        t.string("timeOfDay");
        t.nullable.int("dayOfWeek");
        t.nullable.int("dayOfMonth");
        t.string("emailRecipient");
        t.string("emailSubject");
        t.string("emailBody");
    }
});
