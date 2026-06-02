// rai-pos-backend\src\queue\restock.queue.ts
import { Queue } from 'bullmq';
import Redis from 'ioredis';
export const isRedisEnabled = process.env.REDIS_ENABLED !== 'false';
let connection = null;
let restockQueue = null;
if (isRedisEnabled) {
    connection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
    });
    restockQueue = new Queue('restock', {
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
}
export { connection, restockQueue };
export default restockQueue;
