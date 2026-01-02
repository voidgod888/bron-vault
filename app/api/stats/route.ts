import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { logInfo, logError } from "@/lib/logger"
import { validateRequest } from "@/lib/auth"
import { getOrSetCache } from "@/lib/redis"

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("📊 Loading stats...")

    const result = await getOrSetCache("stats_main", 1800, async () => {
        console.log("📊 Calculating fresh stats...")

        // Run all queries in parallel for maximum speed
        let deviceStatsResult: any[]
        let fileCountResult: any[]
        let aggregatedStatsResult: any[]
        let topPasswordsResult: any[]
        let recentDevicesResult: any[]
        let batchStatsResult: any[]

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
            `) as Promise<any[]>,
            // SingleStore: Count files
            executeQuery("SELECT COUNT(*) as count FROM files WHERE is_directory = 0") as Promise<any[]>,
            // SingleStore: Sum aggregations
            executeQuery(`
            SELECT
                sum(total_credentials) as total_credentials,
                sum(total_domains) as total_domains,
                sum(total_urls) as total_urls
            FROM devices
          `) as Promise<any[]>,
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
          `) as Promise<any[]>,
            // SingleStore: Recent devices
            executeQuery(`
            SELECT device_id, device_name, upload_batch, upload_date, total_files, total_credentials, total_domains, total_urls
            FROM devices
            ORDER BY upload_date DESC
            LIMIT 10
          `) as Promise<any[]>,
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
          `) as Promise<any[]>
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

        const finalResult = {
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

        logInfo(`Final stats result`, finalResult.stats, 'Stats API')
        return finalResult;
    });

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
