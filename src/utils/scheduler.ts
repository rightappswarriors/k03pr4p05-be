// rai-pos-backend\src\utils\scheduler.ts
import { restockQueue } from '../queue/restock.queue';
import { RecurrenceType } from '@prisma/client';

export interface RestockSchedule {
  id: number;
  itemId: number;
  orgId: number;
  recurrence: RecurrenceType;
  startDate: Date;
  endDate?: Date;
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  emailRecipient: string;
  emailFrom?: string;
  emailSubject?: string;
  emailBody?: string;
  isActive: boolean;
  lastTriggeredAt?: Date;
}

function generateCronPattern(schedule: RestockSchedule): string {
  const [hours, minutes] = schedule.timeOfDay.split(':');

  switch (schedule.recurrence) {
    case RecurrenceType.once:
      // For once, we don't use cron, we use delay
      return '';

    case RecurrenceType.daily:
      // Daily at specific time: "0 22 * * *" (10 PM every day)
      return `${minutes} ${hours} * * *`;

    case RecurrenceType.weekly:
      // Weekly on specific day: "0 22 * * 1" (Monday at 10 PM)
      if (schedule.dayOfWeek === undefined || schedule.dayOfWeek === null) {
        throw new Error('dayOfWeek is required for weekly recurrence');
      }
      return `${minutes} ${hours} * * ${schedule.dayOfWeek}`;

    case RecurrenceType.monthly:
      // Monthly on specific day: "0 22 1 * *" (1st of month at 10 PM)
      if (schedule.dayOfMonth === undefined || schedule.dayOfMonth === null) {
        throw new Error('dayOfMonth is required for monthly recurrence');
      }
      return `${minutes} ${hours} ${schedule.dayOfMonth} * *`;

    default:
      throw new Error(`Unsupported recurrence type: ${schedule.recurrence}`);
  }
}

function calculateDelay(schedule: RestockSchedule): number {
  const now = new Date();
  const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
  const targetTime = new Date(schedule.startDate);
  targetTime.setHours(hours, minutes, 0, 0);

  // If the target time is in the past, schedule for next occurrence
  if (targetTime <= now) {
    switch (schedule.recurrence) {
      case RecurrenceType.once:
        // If once and already passed, don't schedule
        return -1;
      case RecurrenceType.daily:
        targetTime.setDate(targetTime.getDate() + 1);
        break;
      case RecurrenceType.weekly:
        targetTime.setDate(targetTime.getDate() + 7);
        break;
      case RecurrenceType.monthly:
        targetTime.setMonth(targetTime.getMonth() + 1);
        break;
    }
  }

  return targetTime.getTime() - now.getTime();
}

export async function registerRestockJob(schedule: RestockSchedule): Promise<void> {
  try {
    // Remove existing job if it exists
    await restockQueue.remove(schedule.id.toString());

    if (!schedule.isActive) {
      console.log(`Schedule ${schedule.id} is inactive, skipping job registration`);
      return;
    }

    const jobData = {
      scheduleId: schedule.id,
    };

    if (schedule.recurrence === RecurrenceType.once) {
      const delay = calculateDelay(schedule);
      if (delay === -1) {
        console.log(`Schedule ${schedule.id} start time has passed, skipping one-time job`);
        return;
      }

      await restockQueue.add(
        'process-restock',
        jobData,
        {
          jobId: schedule.id.toString(),
          delay,
        }
      );
    } else {
      // Recurring job
      const pattern = generateCronPattern(schedule);
      const endDate = schedule.endDate ? new Date(schedule.endDate) : undefined;

      await restockQueue.add(
        'process-restock',
        jobData,
        {
          jobId: schedule.id.toString(),
          repeat: {
            pattern,
            endDate,
          },
        }
      );
    }

    console.log(`Registered restock job for schedule ${schedule.id} (${schedule.recurrence})`);
  } catch (error) {
    console.error(`Failed to register restock job for schedule ${schedule.id}:`, error);
    throw error;
  }
}

export async function removeRestockJob(scheduleId: number): Promise<void> {
  try {
    await restockQueue.remove(scheduleId.toString());
    console.log(`Removed restock job for schedule ${scheduleId}`);
  } catch (error) {
    console.error(`Failed to remove restock job for schedule ${scheduleId}:`, error);
    throw error;
  }
}