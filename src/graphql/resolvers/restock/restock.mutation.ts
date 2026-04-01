import { extendType, nonNull } from "nexus";
import { registerRestockJob, removeRestockJob } from "../../utils/scheduler";

export const CreateRestockSchedule = extendType({
    type: "Mutation",
    definition(t) {
        t.field("createRestockSchedule", {
            type: "RestockSchedule",
            args: {
                data: nonNull("RestockScheduleInput"),
            },
            async resolve(_, { data }, ctx) {
                const schedule = await ctx.prisma.restockSchedule.create({
                    data: {
                        ...data,
                        orgId: ctx.user.orgId,
                        isActive: true,
                    },
                });

                // Register the BullMQ job
                try {
                    await registerRestockJob(schedule);
                } catch (error) {
                    console.error("Failed to register restock job:", error);
                    // Don't fail the mutation, but log the error
                }

                return schedule;
            },
        });
        t.field("deleteRestockSchedule", {
            type: "RestockSchedule",
            args: {
                id: nonNull("Int"),
            },
            async resolve(_, { id }, ctx) {
                // Remove the job before deleting the schedule
                try {
                    await removeRestockJob(id);
                } catch (error) {
                    console.error("Failed to remove restock job:", error);
                    // Continue with deletion even if job removal fails
                }

                return ctx.prisma.restockSchedule.delete({
                    where: { id },
                });
            },
        });

        t.field("updateRestockSchedule", {
            type: "RestockSchedule",
            args: {
                id: nonNull("Int"),
                data: nonNull("RestockScheduleInput"),
            },
            async resolve(_, { id, data }, ctx) {
                const updatedSchedule = await ctx.prisma.restockSchedule.update({
                    where: { id },
                    data: {
                        ...data,
                        orgId: ctx.user.orgId,
                    },
                });

                // Remove old job and register new one
                try {
                    await removeRestockJob(id);
                    await registerRestockJob(updatedSchedule);
                } catch (error) {
                    console.error("Failed to update restock job:", error);
                    // Don't fail the mutation, but log the error
                }

                return updatedSchedule;
            }
        })
    },
});