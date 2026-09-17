import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { deliveryAgreementQueue } from '../queue/deliveryAgreement.queue.js';
import { reconcileExpiredDeliveryAgreement, reconcileExpiredDeliveryAgreements } from '../services/purchaseOrderDeliveryAgreement.service.js';
const worker = new Worker('delivery-agreement', async (job) => {
    const identity = job.data;
    if (!identity.purchaseOrderId || !Number.isInteger(identity.proposalVersion) || !identity.deadline || !identity.supplierProposal) {
        throw new Error(`Delivery agreement job ${job.id} has an invalid proposal identity.`);
    }
    return reconcileExpiredDeliveryAgreement(prisma, identity);
}, {
    connection: deliveryAgreementQueue.opts.connection,
});
worker.on('failed', (job, error) => {
    console.error(`[Delivery agreement] job ${job?.id ?? 'unknown'} failed:`, error);
});
let recoveryRunning = false;
async function runRecovery() {
    if (recoveryRunning)
        return;
    recoveryRunning = true;
    try {
        await reconcileExpiredDeliveryAgreements(prisma, 50);
    }
    catch (error) {
        console.error('[Delivery agreement] bounded recovery scan failed:', error);
    }
    finally {
        recoveryRunning = false;
    }
}
export function startDeliveryAgreementRecovery() {
    void runRecovery();
    const interval = setInterval(() => void runRecovery(), 60_000);
    interval.unref?.();
    return interval;
}
export default worker;
