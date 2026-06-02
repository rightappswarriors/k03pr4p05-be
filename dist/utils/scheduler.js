// rai-pos-backend/src/utils/scheduler.ts
// Registers one BullMQ job per RestockCycle (not per schedule).
// Schedules are just envelopes; cycles are the actual work units.
import { restockQueue } from '../queue/restock.queue.js';
// ─── Cycle-level job registration ─────────────────────────────────────────────
/** Register a single BullMQ job for one cycle. */
export async function registerCycleJob(cycle) {
    if (!restockQueue) {
        console.warn(`Skipping restock job registration for cycle ${cycle.id} because Redis is disabled`);
        return;
    }
    const jobId = `restock-cycle-${cycle.id}`;
    const now = new Date();
    const delay = cycle.scheduledAt.getTime() - now.getTime();
    if (!cycle.isActive) {
        console.log(`Cycle ${cycle.id} is inactive, skipping`);
        return;
    }
    if (delay <= 0) {
        console.log(`Cycle ${cycle.id} scheduledAt is in the past (${cycle.scheduledAt.toISOString()}), skipping`);
        return;
    }
    // Remove any existing job for this cycle first
    try {
        const existing = await restockQueue.getJob(jobId);
        if (existing)
            await existing.remove();
    }
    catch { }
    await restockQueue.add('process-restock-cycle', { cycleId: cycle.id }, {
        jobId,
        delay,
    });
    console.log(`Registered cycle job ${jobId} → fires in ${Math.round(delay / 1000)}s at ${cycle.scheduledAt.toISOString()}`);
}
/** Remove a cycle's BullMQ job (e.g. when cycle is deleted or deactivated). */
export async function removeCycleJob(cycleId) {
    if (!restockQueue) {
        return;
    }
    const jobId = `restock-cycle-${cycleId}`;
    try {
        const existing = await restockQueue.getJob(jobId);
        if (existing) {
            await existing.remove();
            console.log(`Removed cycle job ${jobId}`);
        }
    }
    catch (error) {
        console.error(`Failed to remove cycle job ${jobId}:`, error);
    }
}
/** Remove all cycle jobs for a schedule (e.g. when schedule is deleted). */
export async function removeScheduleCycleJobs(scheduleId) {
    if (!restockQueue) {
        return;
    }
    try {
        const jobs = await restockQueue.getJobs([
            'waiting', 'delayed', 'active', 'paused', 'completed', 'failed',
        ]);
        await Promise.all(jobs
            .filter(j => {
            const data = j.data;
            return data?.scheduleId === scheduleId || String(j.id).startsWith(`restock-cycle-`);
        })
            .map(async (j) => {
            // Only remove if it belongs to this schedule — check via job data
            const data = j.data;
            if (data?.scheduleId === scheduleId)
                await j.remove();
        }));
        console.log(`Removed all cycle jobs for schedule ${scheduleId}`);
    }
    catch (error) {
        console.error(`Failed to remove cycle jobs for schedule ${scheduleId}:`, error);
    }
}
// ─── Legacy schedule-level helpers (kept for backwards compat) ────────────────
// These are no longer used for new cycle-based flow but kept so existing
// schedule-only records (if any) don't break.
export async function registerRestockJob(schedule) {
    // No-op for new cycle-based flow.
    // Called from mutations but actual scheduling is now done per-cycle.
    console.log(`registerRestockJob called for schedule ${schedule.id} — scheduling is now handled per-cycle`);
}
export async function removeRestockJob(scheduleId) {
    await removeScheduleCycleJobs(scheduleId);
}
