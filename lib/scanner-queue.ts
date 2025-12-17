import Redis from "ioredis"

const REDIS_HOST = process.env.REDIS_HOST || "localhost"
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379")

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  lazyConnect: true // Don't connect immediately, wait for first use
})

// Log connection errors
redis.on("error", (err) => {
  console.error("Redis Client Error:", err)
})

export async function pushToScannerQueue(domain: string, priority: "high" | "low" = "low") {
  try {
    const job = { domain, priority, timestamp: Date.now() }
    await redis.rpush("scanner_queue", JSON.stringify(job))
    return true
  } catch (error) {
    console.error(`Failed to push ${domain} to scanner queue:`, error)
    return false
  }
}

export default redis
