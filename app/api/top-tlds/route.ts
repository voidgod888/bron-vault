import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  console.log("🔍 [TOP-TLDS] API called")

  // Validate authentication
  const user = await validateRequest(request)
  console.log("🔍 [TOP-TLDS] Auth validation result:", user ? "SUCCESS" : "FAILED")

  if (!user) {
    console.log("❌ [TOP-TLDS] Unauthorized - no valid user found")
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("📊 [TOP-TLDS] Loading top TLDs for user:", (user as any).username || "<unknown>")

    // Check cache first (analytics_cache tetap di MySQL - operational table)
    console.log("📊 [TOP-TLDS] Checking cache...")
    const cacheResult = (await executeQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'top_tlds' AND expires_at > NOW()",
    )) as any[]

    console.log("📊 [TOP-TLDS] Cache result length:", Array.isArray(cacheResult) ? cacheResult.length : "unexpected")

    if (cacheResult.length > 0) {
      console.log("📊 [TOP-TLDS] Using cached top TLDs")
      let cachedDataRaw = cacheResult[0].cache_data
      let cachedData: any = null

      try {
        if (typeof cachedDataRaw === "string") {
          cachedData = JSON.parse(cachedDataRaw)
        } else if (typeof cachedDataRaw === "object" && cachedDataRaw !== null) {
          cachedData = cachedDataRaw
        } else {
          throw new Error("Unsupported cache_data type")
        }
      } catch (e) {
        console.warn("📊 [TOP-TLDS] Failed to parse cached data, ignoring cache:", e)
        cachedData = null
      }

      if (cachedData) {
        console.log(
          "📊 [TOP-TLDS] Cached data length:",
          Array.isArray(cachedData) ? cachedData.length : "unknown",
        )
        return NextResponse.json(cachedData)
      } else {
        console.log("📊 [TOP-TLDS] Cache corrupted or invalid, will recalc")
      }
    }

    console.log("📊 [TOP-TLDS] Calculating fresh top TLDs...")

    // Get top TLDs from credentials table (SingleStore)
    // SingleStore: COUNT(*) as count, COUNT(DISTINCT device_id) as affected_devices
    const topTlds = (await executeQuery(`
      SELECT 
        tld,
        COUNT(*) as count,
        COUNT(DISTINCT device_id) as affected_devices
      FROM credentials 
      WHERE tld IS NOT NULL 
        AND tld != ''
        AND tld NOT LIKE '%localhost%'
        AND tld NOT LIKE '%127.0.0.1%'
        AND tld NOT LIKE '%192.168%'
        AND tld NOT LIKE '%10.%'
      GROUP BY tld 
      ORDER BY count DESC, affected_devices DESC
      LIMIT 10
    `)) as any[]

    // Cast BigInt to Number for JSON serialization
    const formattedTlds = topTlds.map(row => ({
      tld: row.tld,
      count: Number(row.count) || 0,
      affected_devices: Number(row.affected_devices) || 0
    }))

    console.log(
      `📊 [TOP-TLDS] Found ${formattedTlds.length} top TLDs`,
    )
    console.log("📊 [TOP-TLDS] Sample data:", formattedTlds.slice(0, 2))

    // Serialize for cache
    let serialized: string
    try {
      serialized = JSON.stringify(formattedTlds)
    } catch (e) {
      console.error("📊 [TOP-TLDS] Failed to serialize topTlds for cache:", e)
      serialized = "[]"
    }

    // Cache for 10 minutes
    console.log("📊 [TOP-TLDS] Caching results...")
    await executeQuery(
      `
      INSERT INTO analytics_cache (cache_key, cache_data, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
      ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)
      `,
      ["top_tlds", serialized],
    )

    console.log("📊 [TOP-TLDS] Returning fresh data")
    return NextResponse.json(formattedTlds)
  } catch (error) {
    console.error("❌ [TOP-TLDS] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to get top TLDs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
