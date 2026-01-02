import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Prefer REDIS_URL if available, otherwise fall back to host/port
// lazyConnect: true ensures we don't connect immediately upon import,
// allowing the singleton to be created without side effects in tests/builds.
const client = REDIS_URL
  ? new Redis(REDIS_URL, { lazyConnect: true })
  : new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      lazyConnect: true
    });

client.on('error', (err) => console.error('Redis Client Error', err));

// Auto-connect if not connected when operations are attempted is handled by ioredis
// but we can also manually connect to ensure availability early if needed.
// However, for lazyConnect: true, we must call connect() explicitly once.
// Or we can rely on auto-reconnect.
// If lazyConnect is true, ioredis won't connect until .connect() is called or a command is issued?
// Actually ioredis docs say: "When lazyConnect is set to true, you should call .connect() method manually."
// But it also auto-connects on first command? No, it doesn't.
// So we should initiate connection.

if (client.status === 'wait') {
    client.connect().catch(e => {
        // Suppress initial connection errors to allow app to start even if Redis is down
        // (depending on criticality). But for this app, Redis seems critical for some parts.
        console.error("Failed to connect to Redis:", e);
    });
}

export default client;

/**
 * Caches the result of a function execution in Redis.
 * @param key The cache key
 * @param ttlSeconds Time to live in seconds
 * @param fetchFn The function to execute if cache is missing
 * @returns The cached or fetched data
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  try {
    const cachedData = await client.get(key);
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (e) {
        console.error(`Error parsing cached data for key ${key}:`, e);
        // If parse fails, ignore cache and fetch fresh
      }
    }

    const data = await fetchFn();

    // Don't cache null/undefined if that's not desired,
    // but here we assume the function might return null and we want to cache it?
    // Usually we only cache valid data.
    if (data !== undefined) {
        await client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    }

    return data;
  } catch (error) {
    console.error(`Cache error for key ${key}:`, error);
    // If Redis fails, fall back to fetching data directly
    return fetchFn();
  }
}
