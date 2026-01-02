import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = createClient({
  url: redisUrl,
});

redis.on('error', (err: any) => console.error('Redis Client Error', err));

// Connect immediately
(async () => {
    if (!redis.isOpen) {
        try {
             await redis.connect();
        } catch (e) {
            console.error("Failed to connect to Redis:", e);
        }
    }
})();

export default redis;
