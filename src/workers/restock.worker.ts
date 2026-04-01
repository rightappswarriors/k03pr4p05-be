// rai-pos-backend\src\workers\restock.worker.ts
import { Worker } from 'bullmq';
import { restockQueue } from '../queue/restock.queue.js';
import { sendEmail, generateRestockEmailContent } from '../services/email/email.service.js';
import { prisma } from '../lib/prisma.js';
import { RestockStatus } from '@prisma/client';

const worker = new Worker(
  'restock',
  async (job) => {
    const { scheduleId } = job.data;

    try {
      console.log(`Processing restock job for schedule ${scheduleId}`);

      // Fetch the schedule
      const schedule = await prisma.restockSchedule.findUnique({
        where: { id: scheduleId },
        include: { item: true },
      });

      if (!schedule) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }

      // Skip if inactive
      if (!schedule.isActive) {
        console.log(`Schedule ${scheduleId} is inactive, skipping`);
        return;
      }

      // Prevent duplicate runs within the same minute
      const now = new Date();
      if (schedule.lastTriggeredAt) {
        const lastTrigger = new Date(schedule.lastTriggeredAt);
        const diffMinutes = (now.getTime() - lastTrigger.getTime()) / (1000 * 60);
        if (diffMinutes < 1) {
          console.log(`Schedule ${scheduleId} was triggered recently (${diffMinutes.toFixed(2)} minutes ago), skipping`);
          return;
        }
      }

      const { item } = schedule;

      // Check stock condition
      if (item.stock > item.minQuantity) {
        console.log(`Item ${item.name} (ID: ${item.id}) has sufficient stock (${item.stock} > ${item.minQuantity}), skipping`);
        return;
      }

      // Send email
      const emailContent = generateRestockEmailContent(
        item.name,
        item.stock,
        item.minQuantity,
        schedule.emailBody || undefined
      );

      const emailSent = await sendEmail({
        to: schedule.emailRecipient,
        from: schedule.emailFrom || 'noreply@yourcompany.com',
        subject: schedule.emailSubject || `Restock Alert: ${item.name}`,
        html: emailContent,
      });

      // Log to RestockItem
      await prisma.restockItem.create({
        data: {
          itemId: item.id,
          orgId: schedule.orgId,
          quantity: item.stock, // Current stock at time of alert
          status: emailSent ? RestockStatus.completed : RestockStatus.failed,
          message: emailSent ? 'Email sent successfully' : 'Failed to send email',
          emailRecipient: schedule.emailRecipient,
          emailFrom: schedule.emailFrom,
        },
      });

      // Update lastTriggeredAt
      await prisma.restockSchedule.update({
        where: { id: scheduleId },
        data: { lastTriggeredAt: now },
      });

      console.log(`Restock alert processed for item ${item.name} (ID: ${item.id})`);

    } catch (error) {
      console.error(`Failed to process restock job for schedule ${scheduleId}:`, error);

      // Try to log failure with available data
      try {
        const schedule = await prisma.restockSchedule.findUnique({
          where: { id: scheduleId },
        });

        if (schedule) {
          await prisma.restockItem.create({
            data: {
              itemId: schedule.itemId,
              orgId: schedule.orgId,
              quantity: 0,
              status: RestockStatus.failed,
              message: `Job processing failed: ${error.message}`,
              emailRecipient: schedule.emailRecipient,
              emailFrom: schedule.emailFrom,
            },
          });
        }
      } catch (logError) {
        console.error('Failed to log job failure:', logError);
      }

      throw error;
    }
  },
  {
    connection: restockQueue.opts.connection,
  }
);

// Event listeners
worker.on('completed', (job) => {
  console.log(`Restock job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Restock job ${job?.id} failed:`, err);
});

export default worker;