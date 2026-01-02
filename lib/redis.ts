import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Use ioredis which supports lazy connection by default, but we can be explicit
// lazyConnect: true helps preventing connection errors during build time if Redis isn't available
const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: null, // Useful for queues/blocking operations
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  // Suppress connection errors during build/static generation if we haven't explicitly connected
  if (process.env.SKIP_ENV_VALIDATION === '1') {
      return;
  }
  console.error('Redis Client Error', err);
});

// We don't automatically connect here to allow lazy usage
// The client will connect on first command if not manually connected

export default redis;
