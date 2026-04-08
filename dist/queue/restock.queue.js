// rai-pos-backend\src\queue\restock.queue.ts
import { Queue } from 'bullmq';
import Redis from 'ioredis';
// Create Redis connection
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
});
// Create restock queue
export const restockQueue = new Queue('restock', {
    connection,
    defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});
export default restockQueue;
