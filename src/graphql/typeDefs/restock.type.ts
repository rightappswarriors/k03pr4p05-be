import { enumType, inputObjectType, objectType } from "nexus";


export const RecurrenceTypeEnum = enumType({
  name: "RecurrenceType",
  members: ["once", "daily", "weekly", "monthly"],
})


export const RestockSchedule = objectType({
  name: "RestockSchedule",
  definition(t) {
    t.int("id")
    t.int("itemId")
    t.int("orgId")

    t.field("recurrence", { type: "RecurrenceType" })
    t.nullable.dateTime("startDate")
    t.nullable.dateTime("endDate")

    t.string("timeOfDay")
    t.nullable.int("dayOfWeek")
    t.nullable.int("dayOfMonth")

    t.string("emailRecipient")
    t.nullable.string("emailSubject")
    t.nullable.string("emailBody")

    t.boolean("isActive")
    t.nullable.dateTime("lastTriggeredAt")
    t.dateTime("createdAt")
  }
})

export const RestockScheduleItemInput = inputObjectType({
  name: 'RestockScheduleItemInput',
  definition(t) {
    t.nonNull.int('itemId');
    t.nonNull.float('quantity');
  },
});

export const RestockScheduleInput = inputObjectType({
  name: 'RestockScheduleInput',
  definition(t) {
    t.nonNull.list.nonNull.field('items', { type: 'RestockScheduleItemInput' });
    t.nonNull.field('recurrence', { type: 'RecurrenceType' });
    t.nonNull.field('startDate', { type: 'DateTime' });
    t.nullable.field('endDate', { type: 'DateTime' });
    t.nonNull.string('timeOfDay');
    t.nullable.int('dayOfWeek');
    t.nullable.int('dayOfMonth');
    t.nonNull.string('emailRecipient');
    t.nullable.string('emailSubject');
    t.nullable.string('emailBody');
  },
});