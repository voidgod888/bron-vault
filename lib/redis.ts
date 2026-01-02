import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  lazyConnect: true,
});

redis.on('error', (err) => {
  // Suppress connection errors during build/static generation
  if (process.env.SKIP_ENV_VALIDATION) {
      return;
  }
  console.error('Redis Client Error', err);
});

// Attempt to connect immediately unless we are in a build environment
// This mimics the previous behavior but using ioredis
if (!process.env.SKIP_ENV_VALIDATION) {
    (async () => {
        try {
            await redis.connect();
        } catch (error) {
            // In development, redis might not be running yet
             if (process.env.NODE_ENV !== 'production') {
                // console.warn('Failed to connect to Redis:', error);
            } else {
                console.error('Failed to connect to Redis:', error);
            }
        }
    })();
}

export default redis;
