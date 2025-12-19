import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

// ============================================
// SINGLESTORE EXPRESSIONS (CONSTANTS)
// ============================================
const HOSTNAME_EXPR = `
  SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 3), '://', -1), '/', 1), ':', 1)
`

const PATH_EXPR = `
  CASE
    WHEN c.url LIKE '%/%' THEN CONCAT('/', SUBSTRING_INDEX(c.url, '/', -1))
    ELSE '/'
  END
`

function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  // Use LIKE for case-insensitive matching
  const whereClause = `WHERE (
    c.domain = ? OR
    c.domain LIKE ? OR
    c.url LIKE ? OR
    c.url LIKE ? OR
    c.url LIKE ? OR
    c.url LIKE ?
  ) AND c.domain IS NOT NULL`
  
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

function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: any[] } {
  if (mode === 'domain-only') {
    const whereClause = `WHERE ${HOSTNAME_EXPR} LIKE ? AND c.url IS NOT NULL`
    return { whereClause, params: [`%${keyword}%`] }
  } else {
    const whereClause = `WHERE c.url LIKE ? AND c.url IS NOT NULL`
    return { whereClause, params: [`%${keyword}%`] }
  }
}

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { targetDomain, timelineGranularity, searchType = 'domain', type } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    let whereClause = ''
    let params: any[] = []
    
    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const keywordMode = body.keywordMode || 'full-url'
      const built = buildKeywordWhereClause(keyword, keywordMode)
      whereClause = built.whereClause
      params = built.params
    } else {
    let normalizedDomain = targetDomain.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0]
      const built = buildDomainWhereClause(normalizedDomain)
      whereClause = built.whereClause
      params = built.params
    }

    console.log("🔍 Overview API called:", { targetDomain, searchType, timelineGranularity, type })

    if (type === 'stats') {
      // Fast data: Subdomains + Paths only
      const [topSubdomains, topPaths] = await Promise.all([
        getTopSubdomains(whereClause, params, 10, searchType, body.keywordMode || 'full-url', targetDomain).catch((e) => { 
          console.error("❌ Subdomains Error:", e)
          return []
        }),
        getTopPaths(whereClause, params, 10).catch((e) => { 
          console.error("❌ Paths Error:", e)
          return []
        }),
      ])

      return NextResponse.json({
        success: true,
        targetDomain,
        searchType,
        topSubdomains: topSubdomains || [],
        topPaths: topPaths || [],
      })
    }

    if (type === 'timeline') {
      // Slow data: Timeline only
      const timelineData = await getTimelineData(whereClause, params, timelineGranularity || 'auto').catch((e) => { 
        console.error("❌ Timeline Error:", e)
        return []
      })

      return NextResponse.json({
        success: true,
        targetDomain,
        searchType,
        timeline: timelineData || [],
      })
    }

    // Default: Return all data
    const [timelineData, topSubdomains, topPaths] = await Promise.all([
      getTimelineData(whereClause, params, timelineGranularity || 'auto').catch((e) => { 
        console.error("❌ Timeline Error:", e)
        return []
      }),
      getTopSubdomains(whereClause, params, 10, searchType, body.keywordMode || 'full-url', targetDomain).catch((e) => { 
        console.error("❌ Subdomains Error:", e)
        return []
      }),
      getTopPaths(whereClause, params, 10).catch((e) => { 
        console.error("❌ Paths Error:", e)
        return []
      }),
    ])

    return NextResponse.json({
      success: true,
      targetDomain,
      searchType,
      timeline: timelineData || [],
      topSubdomains: topSubdomains || [],
      topPaths: topPaths || [],
    })

  } catch (error) {
    console.error("❌ Error in overview API:", error)
    return NextResponse.json({ error: "Failed to get overview data" }, { status: 500 })
  }
}

async function getTimelineData(whereClause: string, params: any[], granularity: string) {
  // Use COALESCE logic similar to ClickHouse for date
  // Assumes log_date is YYYY-MM-DD
  const dateExpr = `
    CASE
      WHEN si.log_date IS NOT NULL AND si.log_date != '' THEN STR_TO_DATE(si.log_date, '%Y-%m-%d')
      ELSE DATE(c.created_at)
    END
  `

  // 1. Get Range for Auto Granularity
  const dateRangeResult = (await executeQuery(
    `SELECT 
      MIN(${dateExpr}) as min_date,
      MAX(${dateExpr}) as max_date,
      DATEDIFF(MAX(${dateExpr}), MIN(${dateExpr})) as day_range
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause}`,
    params
  )) as any[]

  const range = dateRangeResult[0]
  if (!range || !range.min_date) {
    return []
  }

  let actualGranularity = granularity
  if (granularity === 'auto') {
    const days = Number(range?.day_range) || 0
    if (days < 30) {
      actualGranularity = 'daily'
    } else if (days <= 90) {
      actualGranularity = 'weekly'
    } else {
      actualGranularity = 'monthly'
    }
  }

  let query = ''
  if (actualGranularity === 'daily') {
    query = `SELECT DATE(${dateExpr}) as date, COUNT(*) as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause} GROUP BY date ORDER BY date ASC`
  } else if (actualGranularity === 'weekly') {
    query = `SELECT DATE_FORMAT(${dateExpr}, '%Y-%u') as week, MIN(DATE(${dateExpr})) as date, COUNT(*) as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause} GROUP BY week ORDER BY date ASC`
  } else {
    // Monthly
    query = `SELECT DATE_FORMAT(${dateExpr}, '%Y-%m') as month, MIN(DATE(${dateExpr})) as date, COUNT(*) as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause} GROUP BY month ORDER BY date ASC`
  }

  const result = (await executeQuery(query, params)) as any[]

  return result.map((row: any) => ({
    date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
    credentialCount: Number(row.credential_count) || 0,
  })).filter((i: any) => i.date)
}

async function getTopSubdomains(
  whereClause: string, 
  params: any[],
  limit: number,
  searchType: string,
  keywordMode: string,
  keyword: string
) {
  let query = ''
  let queryParams: any[] = [...params]
  
  // NOTE: In SingleStore, derived table with WHERE inside might be optimized automatically
  if (searchType === 'keyword' && keywordMode === 'domain-only' && keyword) {
    // MySQL requires alias for derived tables
    query = `SELECT full_hostname, credential_count FROM (
        SELECT ${HOSTNAME_EXPR} as full_hostname, COUNT(*) as credential_count
        FROM credentials c ${whereClause} GROUP BY full_hostname
      ) as sub WHERE full_hostname LIKE ? ORDER BY credential_count DESC LIMIT ${Number(limit)}`
    queryParams.push(`%${keyword}%`)
  } else {
    query = `SELECT ${HOSTNAME_EXPR} as full_hostname, COUNT(*) as credential_count
    FROM credentials c ${whereClause} GROUP BY full_hostname ORDER BY credential_count DESC LIMIT ${Number(limit)}`
  }
  
  const result = (await executeQuery(query, queryParams)) as any[]

  return result.map((row: any) => ({
    fullHostname: row.full_hostname || '',
    credentialCount: Number(row.credential_count) || 0,
  }))
}

async function getTopPaths(whereClause: string, params: any[], limit: number) {
  const result = (await executeQuery(
    `SELECT ${PATH_EXPR} as path, COUNT(*) as credential_count
    FROM credentials c
    ${whereClause}
    GROUP BY path
    ORDER BY credential_count DESC
    LIMIT ${Number(limit)}`,
    params
  )) as any[]

  return result.map((row: any) => ({
    path: row.path || '/',
    credentialCount: Number(row.credential_count) || 0,
  }))
}
