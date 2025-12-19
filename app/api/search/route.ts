import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

/**
 * Build WHERE clause for domain matching that supports subdomains (SingleStore/MySQL)
 * Matches both domain column and hostname extracted from URL
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  // Use LIKE for case-insensitive matching
  const whereClause = `(
    domain = ? OR
    domain LIKE ? OR
    url LIKE ? OR
    url LIKE ? OR
    url LIKE ? OR
    url LIKE ?
  )`
  
  return {
    whereClause,
    params: [
      targetDomain,
      `%.${targetDomain}`,
      `%://${targetDomain}/%`,
      `%://${targetDomain}:%`,
      `%://%.${targetDomain}/%`,
      `%://%.${targetDomain}:%`
    ]
  }
}

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { query, type, page = 1, limit = 50 } = await request.json()

    if (!query || !type) {
      return NextResponse.json({ error: "Query and type are required" }, { status: 400 })
    }

    console.log(`🔍 Searching for: "${query}" by ${type} (page: ${page}, limit: ${limit})`)

    if (type === "email") {
      // Email search
      const pageNum = Number.parseInt(String(page)) || 1
      const limitNum = Number.parseInt(String(limit)) || 50
      const offset = (pageNum - 1) * limitNum
      
      const searchPattern = `%${query}%`
      
      // Get total count first (SingleStore)
      const totalCountResult = await executeQuery(
        `
        SELECT COUNT(DISTINCT d.device_id) as total
        FROM devices d
        INNER JOIN credentials c ON d.device_id = c.device_id
        WHERE c.username LIKE ?
        `,
        [searchPattern],
      ) as any[]
      
      const total = totalCountResult[0]?.total || 0
      
      // Get devices with pagination (SingleStore)
      const devicesResult = await executeQuery(
        `
        SELECT DISTINCT d.device_id, d.device_name, d.upload_batch, d.upload_date
        FROM devices d
        INNER JOIN credentials c ON d.device_id = c.device_id
        WHERE c.username LIKE ?
        ORDER BY d.upload_date DESC, d.device_name
        LIMIT ${limitNum} OFFSET ${offset}
        `,
        [searchPattern],
      ) as any[]
      
      // Get file count and system info for each device (SingleStore)
      const devices = []
      for (const row of devicesResult) {
        const fileCount = await executeQuery(
          `SELECT COUNT(*) as total FROM files WHERE device_id = ?`,
          [row.device_id],
        ) as any[]
        
        const systemInfo = await executeQuery(
          `SELECT log_date FROM systeminformation WHERE device_id = ? LIMIT 1`,
          [row.device_id],
        ) as any[]
        
        devices.push({
          deviceId: row.device_id,
          deviceName: row.device_name,
          uploadBatch: row.upload_batch,
          uploadDate: row.upload_date,
          matchingFiles: [],
          matchedContent: [],
          files: [],
          totalFiles: fileCount[0]?.total || 0,
          credentials: [],
          logDate: systemInfo[0]?.log_date || undefined,
        })
      }
      
      return NextResponse.json({
        devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum * limitNum < total,
        },
      })
      
    } else if (type === "domain") {
      // Domain search
      const pageNum = Math.max(1, Number.parseInt(String(page)) || 1)
      const limitNum = Math.max(1, Math.min(100, Number.parseInt(String(limit)) || 50))
      const offset = Math.max(0, (pageNum - 1) * limitNum)
      
      // Normalize domain
      let normalizedDomain = query.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
      normalizedDomain = normalizedDomain.replace(/^www\./, '')
      normalizedDomain = normalizedDomain.replace(/\/$/, '')
      normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]
      
      // Build WHERE clause (SingleStore/MySQL)
      const { whereClause, params } = buildDomainWhereClause(normalizedDomain)
      
      // Get total count first (SingleStore)
      const totalCountResult = await executeQuery(
        `SELECT COUNT(DISTINCT device_id) as total
         FROM credentials
         WHERE ${whereClause}`,
        params,
      ) as any[]
      
      const total = totalCountResult[0]?.total || 0
      
      // Get devices with pagination (SingleStore)
      // Use IN subquery for efficiency
      const devicesResult = await executeQuery(
        `SELECT DISTINCT d.device_id, d.device_name, d.upload_batch, d.upload_date
         FROM devices d
         WHERE d.device_id IN (
           SELECT DISTINCT device_id
           FROM credentials
           WHERE ${whereClause}
         )
         ORDER BY d.upload_date DESC, d.device_name
         LIMIT ${limitNum} OFFSET ${offset}`,
        params,
      ) as any[]
      
      console.log(`📊 Found ${devicesResult.length} devices (page ${pageNum}, total: ${total})`)
      
      // Get file count, matching files, and system info for each device (SingleStore)
      const devices = []
      for (const row of devicesResult) {
        // Get file count
        const fileCount = await executeQuery(
          `SELECT COUNT(*) as total FROM files WHERE device_id = ?`,
          [row.device_id],
        ) as any[]
        
        // Get matching file paths (files that contain matching credentials)
        // Merge params: whereClause params + device_id
        // NOTE: params for WHERE clause + row.device_id
        const matchingFilesParams = [...params, row.device_id]
        const matchingFilesResult = await executeQuery(
          `SELECT DISTINCT file_path
           FROM credentials
           WHERE ${whereClause} AND file_path IS NOT NULL AND device_id = ?`,
          matchingFilesParams,
        ) as any[]
        
        const matchingFiles = matchingFilesResult.map((f: any) => f.file_path).filter(Boolean)
        
        // Get system info
        const systemInfo = await executeQuery(
          `SELECT log_date FROM systeminformation WHERE device_id = ? LIMIT 1`,
          [row.device_id],
        ) as any[]
        
        devices.push({
          deviceId: row.device_id,
          deviceName: row.device_name,
          uploadBatch: row.upload_batch,
          uploadDate: row.upload_date,
          matchingFiles,
          matchedContent: [], // Will be populated when device is clicked (lazy loading)
          files: [],
          totalFiles: fileCount[0]?.total || 0,
          credentials: [], // Will be loaded when device is clicked (lazy loading)
          logDate: systemInfo[0]?.log_date || undefined,
        })
      }
      
      return NextResponse.json({
        devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum * limitNum < total,
        },
      })
    } else {
      return NextResponse.json({ error: "Invalid search type" }, { status: 400 })
    }
  } catch (error) {
    console.error("❌ Search error:", error)
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
