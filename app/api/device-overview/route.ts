import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deviceId } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    // Verify device exists (SingleStore)
    const deviceCheck = (await executeQuery(
      "SELECT device_id, device_name, upload_batch, upload_date FROM devices WHERE device_id = ?",
      [deviceId]
    )) as any[]

    if (deviceCheck.length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const device = deviceCheck[0]

    // 1. Get summary statistics
    let credentialsCount = { count: 0 }
    let softwareCount = { count: 0 }
    let filesCount = { count: 0 }
    let topPasswords: any[] = []
    let browserDistribution: any[] = []
    let topDomains: any[] = []
    let fileStatistics: any = null
    let hostInfo: any = null

    try {
      const credentialsCountResult = (await executeQuery(
        "SELECT COUNT(*) as count FROM credentials WHERE device_id = ?",
        [deviceId]
      )) as any[]
      const rawCount = credentialsCountResult && credentialsCountResult.length > 0 ? credentialsCountResult[0]?.count : 0
      credentialsCount = { count: Number(rawCount) || 0 }
    } catch (error) {
      console.error("Error getting credentials count:", error)
    }

    try {
      const softwareCountResult = (await executeQuery(
        "SELECT COUNT(*) as count FROM software WHERE device_id = ?",
        [deviceId]
      )) as any[]
      const rawCount = softwareCountResult && softwareCountResult.length > 0 ? softwareCountResult[0]?.count : 0
      softwareCount = { count: Number(rawCount) || 0 }
    } catch (error) {
      console.error("Error getting software count:", error)
    }

    try {
      const filesCountResult = (await executeQuery(
        "SELECT COUNT(*) as count FROM files WHERE device_id = ?",
        [deviceId]
      )) as any[]
      const rawCount = filesCountResult && filesCountResult.length > 0 ? filesCountResult[0]?.count : 0
      filesCount = { count: Number(rawCount) || 0 }
    } catch (error) {
      console.error("Error getting files count:", error)
    }

    // 2. Get top passwords (most frequently used) - SingleStore
    try {
      const topPasswordsRaw = (await executeQuery(
        `SELECT 
          password,
          COUNT(*) as count
        FROM credentials 
        WHERE device_id = ?
          AND password IS NOT NULL 
          AND password != ''
        GROUP BY password 
        ORDER BY count DESC 
        LIMIT 10`,
        [deviceId]
      )) as any[]
      topPasswords = topPasswordsRaw.map((item: any) => ({
        password: item.password,
        count: Number(item.count) || 0,
      }))
    } catch (error) {
      console.error("Error getting top passwords:", error)
      topPasswords = []
    }

    // 3. Get browser distribution - SingleStore
    try {
      const browserDistributionRaw = (await executeQuery(
        `SELECT 
          COALESCE(browser, 'Unknown') as browser,
          COUNT(*) as count
        FROM credentials 
        WHERE device_id = ?
        GROUP BY browser 
        ORDER BY count DESC`,
        [deviceId]
      )) as any[]
      browserDistribution = browserDistributionRaw.map((item: any) => ({
        browser: item.browser,
        count: Number(item.count) || 0,
      }))
    } catch (error) {
      console.error("Error getting browser distribution:", error)
      browserDistribution = []
    }

    // 4. Get top domains - extract from url column with proper domain validation
    try {
      // SingleStore/MySQL compatible query
      topDomains = (await executeQuery(
        `SELECT 
          SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(url, '/', 3), '://', -1), '/', 1), ':', 1) as extracted_host,
          COUNT(*) as count
        FROM credentials 
        WHERE device_id = ?
          AND url IS NOT NULL 
          AND url != ''
          AND url != 'null'
          AND LENGTH(url) > 0
        GROUP BY extracted_host 
        HAVING extracted_host IS NOT NULL 
          AND extracted_host != ''
          AND extracted_host != 'null'
          AND LENGTH(extracted_host) > 0
          AND extracted_host NOT REGEXP '^(com|co|net|org|edu|gov|ac|sch|mil|info|biz|name|pro|asia|tel|mobi|jobs|travel|xxx|aero|museum|coop|int|post|arpa|test|local|localhost)\\.[a-z]{2,3}$'
          AND extracted_host LIKE '%.%'
          AND extracted_host NOT LIKE '.%'
          AND extracted_host NOT LIKE '%.'
          AND LENGTH(extracted_host) >= 3
        ORDER BY count DESC 
        LIMIT 7`,
        [deviceId]
      )) as any[]

      topDomains = topDomains.map((item: any) => ({
        domain: item.extracted_host,
        count: Number(item.count) || 0,
      }))

      if (topDomains.length === 0) {
        const domainsFromColumn = (await executeQuery(
          `SELECT 
            domain,
            COUNT(*) as count
          FROM credentials 
          WHERE device_id = ?
            AND domain IS NOT NULL 
            AND domain != ''
            AND domain != 'null'
            AND domain NOT REGEXP '^(com|co|net|org|edu|gov|ac|sch|mil|info|biz|name|pro|asia|tel|mobi|jobs|travel|xxx|aero|museum|coop|int|post|arpa|test|local|localhost)\\.[a-z]{2,3}$'
            AND domain LIKE '%.%'
            AND domain NOT LIKE '.%'
            AND domain NOT LIKE '%.'
            AND LENGTH(domain) >= 3
          GROUP BY domain 
          ORDER BY count DESC 
          LIMIT 7`,
          [deviceId]
        )) as any[]
        topDomains = domainsFromColumn.map((item: any) => ({
          domain: item.domain,
          count: Number(item.count) || 0,
        }))
        console.log(`📊 Found ${topDomains.length} top domains from domain column (filtered) for device ${deviceId}`)
      } else {
        console.log(`📊 Found ${topDomains.length} top domains extracted from url (filtered) for device ${deviceId}`)
      }

      if (topDomains.length > 0) {
        console.log(`📊 Sample domains:`, topDomains.slice(0, 3).map((d: any) => ({ domain: d.domain, count: d.count })))
      } else {
        const urlCheck = (await executeQuery(
          `SELECT COUNT(*) as total,
           SUM(CASE WHEN url IS NOT NULL AND url != '' AND url != 'null' THEN 1 ELSE 0 END) as with_url
          FROM credentials 
          WHERE device_id = ?`,
          [deviceId]
        )) as any[]
        if (urlCheck.length > 0) {
          console.log(`📊 URL check for device ${deviceId}:`, {
            total: Number(urlCheck[0].total) || 0,
            with_url: Number(urlCheck[0].with_url) || 0,
          })
        }
      }
    } catch (error) {
      console.error("❌ Error getting top domains:", error)
      topDomains = []
    }

    // 5. Get file size distribution (breakdown by file size categories)
    try {
      // SingleStore/MySQL compatible CASE statement
      const fileSizeStats = (await executeQuery(
        `SELECT 
          CASE
            WHEN file_size IS NULL OR file_size = 0 THEN 'Unknown'
            WHEN file_size < 1024 THEN '< 1 KB'
            WHEN file_size >= 1024 AND file_size < 10240 THEN '1 KB - 10 KB'
            WHEN file_size >= 10240 AND file_size < 102400 THEN '10 KB - 100 KB'
            WHEN file_size >= 102400 AND file_size < 1048576 THEN '100 KB - 1 MB'
            WHEN file_size >= 1048576 AND file_size < 10485760 THEN '1 MB - 10 MB'
            WHEN file_size >= 10485760 THEN '> 10 MB'
            ELSE 'Other'
          END as size_category,
          COUNT(*) as count
        FROM files 
        WHERE device_id = ?
          AND is_directory = 0
          AND file_size IS NOT NULL
          AND file_size > 0
        GROUP BY size_category 
        ORDER BY 
          CASE
            WHEN size_category = '< 1 KB' THEN 0
            WHEN size_category = '1 KB - 10 KB' THEN 1
            WHEN size_category = '10 KB - 100 KB' THEN 2
            WHEN size_category = '100 KB - 1 MB' THEN 3
            WHEN size_category = '1 MB - 10 MB' THEN 4
            WHEN size_category = '> 10 MB' THEN 5
            ELSE 6
          END`,
        [deviceId]
      )) as any[]
      
      const directoriesCount = (await executeQuery(
        `SELECT COUNT(*) as count
        FROM files 
        WHERE device_id = ? AND is_directory = 1`,
        [deviceId]
      )) as any[]
      
      // MySQL LIKE is case-insensitive by default with default collation
      const txtFilesCount = (await executeQuery(
        `SELECT COUNT(*) as count
        FROM files 
        WHERE device_id = ?
          AND is_directory = 0
          AND file_name LIKE '%.txt'`,
        [deviceId]
      )) as any[]
      
      const totalDirectories = directoriesCount.length > 0 ? Number(directoriesCount[0].count) || 0 : 0
      const totalTxtFiles = txtFilesCount.length > 0 ? Number(txtFilesCount[0].count) || 0 : 0
      const totalFiles = Number(filesCount?.count) || 0
      const totalOtherFiles = Math.max(0, totalFiles - totalDirectories - totalTxtFiles)
      
      fileStatistics = {
        totalFiles: totalFiles,
        bySize: fileSizeStats.map((item: any) => ({
          category: item.size_category,
          count: Number(item.count) || 0,
        })),
        totalDirectories: totalDirectories,
        totalTxtFiles: totalTxtFiles,
        totalOtherFiles: totalOtherFiles,
      }
    } catch (error) {
      console.error("Error getting file size distribution:", error)
      fileStatistics = {
        totalFiles: filesCount?.count || 0,
        bySize: [],
        totalDirectories: 0,
        totalTxtFiles: 0,
        totalOtherFiles: 0,
      }
    }

    // 6. Get host information (summary) - SingleStore
    try {
      const systemInfo = (await executeQuery(
        `SELECT 
          os,
          computer_name,
          ip_address,
          country,
          username,
          cpu,
          ram,
          gpu
        FROM systeminformation
        WHERE device_id = ?
        LIMIT 1`,
        [deviceId]
      )) as any[]
      hostInfo = systemInfo.length > 0 ? systemInfo[0] : null
    } catch (error) {
      console.error("Error getting host info:", error)
      hostInfo = null
    }

    return NextResponse.json({
      summary: {
        totalCredentials: Number(credentialsCount?.count) || 0,
        totalSoftware: Number(softwareCount?.count) || 0,
        totalFiles: Number(filesCount?.count) || 0,
        uploadDate: device.upload_date || null,
        uploadBatch: device.upload_batch || null,
      },
      topPasswords: topPasswords,
      browserDistribution: browserDistribution,
      topDomains: topDomains,
      fileStatistics: fileStatistics || {
        totalFiles: Number(filesCount?.count) || 0,
        bySize: [],
        totalDirectories: 0,
        totalTxtFiles: 0,
        totalOtherFiles: 0,
      },
      hostInfo: hostInfo ? {
        os: hostInfo.os || null,
        computerName: hostInfo.computer_name || null,
        ipAddress: hostInfo.ip_address || null,
        country: hostInfo.country || null,
        username: hostInfo.username || null,
        cpu: hostInfo.cpu || null,
        ram: hostInfo.ram || null,
        gpu: hostInfo.gpu || null,
      } : null,
    })
  } catch (error) {
    console.error("Error loading device overview:", error)
    return NextResponse.json(
      {
        error: "Failed to load device overview",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
