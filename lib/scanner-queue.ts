import redis from "./redis"

// Reuse the singleton connection from lib/redis
// This ensures we don't open multiple connections and use consistent config

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
