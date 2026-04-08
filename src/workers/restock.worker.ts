// rai-pos-backend/src/workers/restock.worker.ts
// Processes RestockCycle jobs fired by BullMQ.
// Each cycle has its own items, supplier, and exact fire time.

import { Worker } from 'bullmq';
import { restockQueue } from '../queue/restock.queue.js';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../services/email/email.service.js';
import { generateSupplierEmail } from '../services/email/supplier.email.js';
import crypto from 'crypto';

const worker = new Worker(
  'restock',
  async (job) => {
    const { cycleId } = job.data as { cycleId: number };

    if (!cycleId) {
      throw new Error(`Job ${job.id} is missing cycleId`);
    }

    console.log(`Processing restock cycle job for cycle ${cycleId}`);

    // ── 1. Fetch cycle with items and parent schedule ──────────────────────────
    const cycle = await prisma.restockCycle.findUnique({
      where: { id: cycleId },
      include: {
        cycleItems: {
          include: { item: true },
        },
        schedule: true,
      },
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    if (!cycle.isActive) {
      console.log(`Cycle ${cycleId} is inactive, skipping`);
      return;
    }

    if (cycle.cycleItems.length === 0) {
      console.log(`Cycle ${cycleId} has no items, skipping`);
      return;
    }

    // ── 2. Deduplicate: skip if already fired ──────────────────────────────────
    if (cycle.firedAt) {
      const diffMinutes = (new Date().getTime() - cycle.firedAt.getTime()) / 60000;
      if (diffMinutes < 1) {
        console.log(`Cycle ${cycleId} already fired ${diffMinutes.toFixed(2)}m ago, skipping`);
        return;
      }
    }

    // ── 3. Generate supplier portal credentials ───────────────────────────────
    const token = crypto.randomUUID();
    const tempPassword = crypto.randomBytes(3).toString('hex').toUpperCase();
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // ── 4. Create SupplierOrder from cycle items ──────────────────────────────
    const order = await prisma.supplierOrder.create({
      data: {
        orgId: cycle.orgId,
        scheduleId: cycle.scheduleId,
        cycleId: cycle.id,             // NEW — links order to this specific cycle
        supplierEmail: cycle.emailRecipient,
        supplierToken: token,
        tokenExpiresAt,
        userMessage: cycle.emailBody ?? cycle.schedule.emailBody ?? null,
        expectedArrival: cycle.scheduledAt,
        items: {
          create: cycle.cycleItems.map(ci => ({
            itemId: ci.itemId,
            requestedQty: ci.quantity,
          })),
        },
      },
      include: {
        items: { include: { item: true } },
      },
    });

    // ── 5. Send supplier email ────────────────────────────────────────────────
    const portalUrl = `${process.env.FRONTEND_URL}/supplier/${token}`;

    const emailHtml = generateSupplierEmail({
      items: order.items.map(oi => ({
        name: oi.item.name,
        requestedQty: oi.requestedQty,
      })),
      portalUrl,
      tempPassword,
      userMessage: cycle.emailBody ?? cycle.schedule.emailBody ?? undefined,
      expectedArrival: cycle.scheduledAt,
      location: cycle.address && cycle.latitude && cycle.longitude ? {
        address: cycle.address,
        latitude: cycle.latitude,
        longitude: cycle.longitude,
      } : cycle.schedule.address && cycle.schedule.latitude && cycle.schedule.longitude ? {
        address: cycle.schedule.address,
        latitude: cycle.schedule.latitude,
        longitude: cycle.schedule.longitude,
      } : undefined,
    });

    const emailSent = await sendEmail({
      to: cycle.emailRecipient,
      from: "onboarding@resend.dev", // cycle.schedule.emailFrom ?? 'noreply@yourdomain.com',
      subject:
        cycle.emailSubject ??
        cycle.schedule.emailSubject ??
        `New restock order — please review`,
      html: emailHtml,
    });

    if (!emailSent) {
      console.error(
        `Email failed for cycle ${cycleId}, order ${order.id} — SupplierOrder still created`,
      );
    }

    // ── 6. Mark cycle as fired ────────────────────────────────────────────────
    await prisma.restockCycle.update({
      where: { id: cycleId },
      data: { firedAt: new Date() },
    });

    // Also update parent schedule lastTriggeredAt
    await prisma.restockSchedule.update({
      where: { id: cycle.scheduleId },
      data: { lastTriggeredAt: new Date() },
    });

    console.log(
      `Cycle ${cycleId} complete → SupplierOrder ${order.id} (${order.items.length} items) → ${cycle.emailRecipient}`,
    );
  },
  {
    connection: restockQueue.opts.connection,
  },
);

worker.on('completed', (job) => {
  console.log(`Restock cycle job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Restock cycle job ${job?.id} failed:`, err);
});

export default worker;