import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

// ============================================
// SINGLESTORE EXPRESSIONS (CONSTANTS)
// ============================================
const HOSTNAME_EXPR = `
  SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(url, '/', 3), '://', -1), '/', 1), ':', 1)
`

const PATH_EXPR = `
  CASE
    WHEN url LIKE '%/%' THEN CONCAT('/', SUBSTRING_INDEX(url, '/', -1))
    ELSE '/'
  END
`

function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  const whereClause = `WHERE (
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

function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: any[] } {
  if (mode === 'domain-only') {
    const whereClause = `WHERE ${HOSTNAME_EXPR} LIKE ? AND url IS NOT NULL`
    return { whereClause, params: [`%${keyword}%`] }
  } else {
    const whereClause = `WHERE url LIKE ? AND url IS NOT NULL`
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
    const { targetDomain, searchType = 'domain' } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    let whereClause = ''
    let params: any[] = []
    
    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const mode = body.keywordMode || 'full-url'
      const built = buildKeywordWhereClause(keyword, mode)
      whereClause = built.whereClause
      params = built.params
    } else {
    let normalizedDomain = targetDomain.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0]
      const built = buildDomainWhereClause(normalizedDomain)
      whereClause = built.whereClause
      params = built.params
    }

    const summary = await getSummaryStats(whereClause, params)

    return NextResponse.json({
      success: true,
      targetDomain,
      searchType,
      summary,
    })
  } catch (error) {
    console.error("❌ Error in summary API:", error)
    return NextResponse.json({ error: "Failed to get summary statistics" }, { status: 500 })
  }
}

async function getSummaryStats(whereClause: string, params: any[]) {
  // Execute all counts in parallel
  // NOTE: Reuse params for each query is fine as they don't mutate
  const [subRes, pathRes, credRes, reusedRes, devRes] = await Promise.all([
    executeQuery(`SELECT COUNT(DISTINCT ${HOSTNAME_EXPR}) as total FROM credentials ${whereClause}`, params),
    executeQuery(`SELECT COUNT(DISTINCT ${PATH_EXPR}) as total FROM credentials ${whereClause}`, params),
    executeQuery(`SELECT COUNT(*) as total FROM credentials ${whereClause}`, params),
    executeQuery(`SELECT COUNT(*) as total FROM (
      SELECT username, password, url FROM credentials ${whereClause} GROUP BY username, password, url HAVING count(*) > 1
    ) as sub`, params),
    executeQuery(`SELECT COUNT(DISTINCT device_id) as total FROM credentials ${whereClause}`, params)
  ])

  return {
    totalSubdomains: Number((subRes as any[])[0]?.total) || 0,
    totalPaths: Number((pathRes as any[])[0]?.total) || 0,
    totalCredentials: Number((credRes as any[])[0]?.total) || 0,
    totalReusedCredentials: Number((reusedRes as any[])[0]?.total) || 0,
    totalDevices: Number((devRes as any[])[0]?.total) || 0,
  }
}
