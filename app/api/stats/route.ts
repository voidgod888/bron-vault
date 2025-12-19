import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { logInfo, logError } from "@/lib/logger"
import { validateRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("📊 Loading stats...")

    // Check cache first (analytics_cache remains in MySQL - operational table)
    const cacheResult = (await executeQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'stats_main' AND expires_at > NOW()",
    )) as any[]

    if (cacheResult.length > 0) {
      console.log("📊 Using cached stats")
      let cached = cacheResult[0].cache_data
      let parsed: any = null

      try {
        if (typeof cached === "string") {
          parsed = JSON.parse(cached)
        } else if (typeof cached === "object" && cached !== null) {
          parsed = cached
        } else {
          throw new Error("Unsupported cached format")
        }
      } catch (e) {
        console.warn("📊 Cached stats parse failed, will recalc. Error:", e)
        parsed = null
      }

      // VALIDATION: Ensure cached data has correct structure
      if (parsed && parsed.stats) {
        const hasValidData = 
          parsed.stats.totalDevices !== undefined && 
          parsed.stats.totalDevices !== null &&
          typeof parsed.stats.totalDevices === 'number' &&
          parsed.stats.totalFiles !== undefined && 
          parsed.stats.totalFiles !== null &&
          typeof parsed.stats.totalFiles === 'number'
        
        if (hasValidData) {
          console.log("📊 Cache valid, returning cached data")
        return NextResponse.json(parsed)
        } else {
          console.log("📊 Cache data incomplete or invalid, recalculating...")
          // Invalidate cache by deleting it
          await executeQuery(
            "DELETE FROM analytics_cache WHERE cache_key = 'stats_main'"
          )
        }
      } else {
        console.log("📊 Cache corrupted or invalid structure, continuing to recompute stats")
      }
    }

    console.log("📊 Calculating fresh stats...")

    // Run all queries in parallel for maximum speed
    let deviceStatsResult: any
    let fileCountResult: any
    let aggregatedStatsResult: any
    let topPasswordsResult: any
    let recentDevicesResult: any
    let batchStatsResult: any

    try {
      [
        deviceStatsResult,
      fileCountResult,
      aggregatedStatsResult,
      topPasswordsResult,
      recentDevicesResult,
      batchStatsResult
    ] = await Promise.all([
        // SingleStore: Count devices (unique device_id due to Shard Key)
        executeQuery(`
          SELECT 
            COUNT(*) as total_devices,
            COUNT(DISTINCT device_name_hash) as unique_devices
          FROM devices
        `),
        // SingleStore: Count files
        executeQuery("SELECT COUNT(*) as count FROM files WHERE is_directory = 0"),
        // SingleStore: Sum aggregations
        executeQuery(`
        SELECT 
            sum(total_credentials) as total_credentials,
            sum(total_domains) as total_domains,
            sum(total_urls) as total_urls
        FROM devices
      `),
        // SingleStore: Top passwords query
        // Cleaned up logic for standard SQL
        executeQuery(`
          SELECT password, COUNT(DISTINCT device_id) as total_count
        FROM password_stats
        WHERE password IS NOT NULL 
            AND LENGTH(TRIM(password)) > 2
          AND password NOT IN ('', ' ', 'null', 'undefined', 'N/A', 'n/a', 'none', 'None', 'NONE', 'blank', 'Blank', 'BLANK', 'empty', 'Empty', 'EMPTY', '[NOT_SAVED]')
          AND password NOT LIKE '%[NOT_SAVED]%'
            AND password REGEXP '^[^[:space:]]+$'
        GROUP BY password
        ORDER BY total_count DESC, password ASC
        LIMIT 5
      `),
        // SingleStore: Recent devices
        executeQuery(`
        SELECT device_id, device_name, upload_batch, upload_date, total_files, total_credentials, total_domains, total_urls
        FROM devices 
        ORDER BY upload_date DESC 
        LIMIT 10
      `),
        // SingleStore: Batch stats
        executeQuery(`
        SELECT 
          upload_batch,
            COUNT(*) as devices_count,
            SUM(total_credentials) as batch_credentials,
            SUM(total_domains) as batch_domains,
            SUM(total_urls) as batch_urls,
            MAX(upload_date) as upload_date
        FROM devices 
        GROUP BY upload_batch 
        ORDER BY upload_date DESC 
        LIMIT 10
      `)
    ])
    } catch (error) {
      console.error("❌ Error executing SingleStore queries:", error)
      throw error
    }

    const deviceStats = deviceStatsResult[0] || {}
    const totalDevices = Number(deviceStats.total_devices) || 0
    const uniqueDeviceNames = Number(deviceStats.unique_devices) || 0
    const duplicateDeviceNames = Math.max(0, totalDevices - uniqueDeviceNames)

    const fileStats = fileCountResult[0] || {}
    const totalFiles = Number(fileStats.count) || 0

    const aggStats = (aggregatedStatsResult as any[])[0] || {}

    const topPasswordsArray = (topPasswordsResult as any[]).map((pw: any) => ({
      ...pw,
      total_count: Number(pw.total_count) || 0,
    }))

    const recentDevices = recentDevicesResult as any[]
    
    const batchStats = (batchStatsResult as any[]).map((batch: any) => ({
      ...batch,
      devices_count: Number(batch.devices_count) || 0,
      batch_credentials: Number(batch.batch_credentials) || 0,
      batch_domains: Number(batch.batch_domains) || 0,
      batch_urls: Number(batch.batch_urls) || 0,
    }))

    const result = {
      stats: {
        totalDevices,
        uniqueDeviceNames,
        duplicateDeviceNames,
        totalFiles,
        totalCredentials: Number(aggStats.total_credentials) || 0,
        totalDomains: Number(aggStats.total_domains) || 0,
        totalUrls: Number(aggStats.total_urls) || 0,
      },
      topPasswords: topPasswordsArray,
      devices: recentDevices,
      batches: batchStats,
    }

    logInfo(`Final stats result`, result.stats, 'Stats API')

    // Cache for 30 minutes
    await executeQuery(
      "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
      ["stats_main", JSON.stringify(result)],
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("❌ Stats API Error:", error)
    logError("Stats error", error, 'Stats API')
    
    return NextResponse.json(
      {
        error: "Failed to get stats",
        details: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
      { status: 500 },
    )
  }
}
