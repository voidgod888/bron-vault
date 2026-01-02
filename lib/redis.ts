import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// ioredis connects automatically by default
const redis = new Redis(redisUrl, {
  lazyConnect: true,
  // Retry strategy
  retryStrategy: (times) => {
    // Stop retrying after 20 times
    if (times > 20) {
      return null;
    }
    return Math.min(times * 50, 2000);
  },
  // Don't crash on error
  maxRetriesPerRequest: null,
});

redis.on('error', (err: any) => console.error('Redis Client Error', err));
redis.on('connect', () => console.log('Redis Connected'));

export default redis;
