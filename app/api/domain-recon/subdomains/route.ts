import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

// ============================================
// SINGLESTORE EXPRESSIONS (CONSTANTS)
// ============================================

/**
 * Extract Hostname (Domain)
 * SingleStore/MySQL compatible expression
 * SUBSTRING_INDEX magic to parse domain from URL
 */
const HOSTNAME_EXPR = `
  SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 3), '://', -1), '/', 1), ':', 1)
`

/**
 * Extract Path
 * SingleStore/MySQL compatible expression
 */
const PATH_EXPR = `
  CASE
    WHEN c.url LIKE '%/%' THEN CONCAT('/', SUBSTRING_INDEX(c.url, '/', -1))
    ELSE '/'
  END
`

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build WHERE clause for domain matching that supports subdomains
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  // Use LIKE for case-insensitive matching
  const whereClause = `WHERE (
    c.domain = ? OR
    c.domain LIKE ? OR
    c.url LIKE ? OR
    c.url LIKE ? OR
    c.url LIKE ? OR
    c.url LIKE ?
  )`
  
  return {
    whereClause,
    params: [
      targetDomain,                              // Exact domain match
      `%.${targetDomain}`,                       // Subdomain match
      `%://${targetDomain}/%`,                   // URL exact
      `%://${targetDomain}:%`,                   // URL exact with port
      `%://%.${targetDomain}/%`,                 // URL subdomain
      `%://%.${targetDomain}:%`                  // URL subdomain with port
    ]
  }
}

/**
 * Build WHERE clause for keyword search
 */
function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: any[] } {
  if (mode === 'domain-only') {
    const whereClause = `WHERE ${HOSTNAME_EXPR} LIKE ? AND c.url IS NOT NULL`
    return {
      whereClause,
      params: [`%${keyword}%`]
    }
  } else {
    const whereClause = `WHERE c.url LIKE ? AND c.url IS NOT NULL`
    return {
      whereClause,
      params: [`%${keyword}%`]
    }
  }
}

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { targetDomain, filters, pagination, searchType = 'domain' } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const keywordMode = body.keywordMode || 'full-url'
      const subdomainsData = await getSubdomainsData(keyword, filters, pagination, 'keyword', keywordMode)

      return NextResponse.json({
        success: true,
        targetDomain: keyword,
        searchType: 'keyword',
        subdomains: subdomainsData.data || [],
        pagination: subdomainsData.pagination,
      })
    } else {
      let normalizedDomain = targetDomain.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
      normalizedDomain = normalizedDomain.replace(/^www\./, '')
      normalizedDomain = normalizedDomain.replace(/\/$/, '')
      normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

      const subdomainsData = await getSubdomainsData(normalizedDomain, filters, pagination, 'domain')

    return NextResponse.json({
      success: true,
      targetDomain: normalizedDomain,
        searchType: 'domain',
      subdomains: subdomainsData.data || [],
      pagination: subdomainsData.pagination,
    })
    }
  } catch (error) {
    console.error("❌ Error in subdomains API:", error)
    return NextResponse.json(
      {
        error: "Failed to get subdomains data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

async function getSubdomainsData(
  query: string,
  filters?: any,
  pagination?: any,
  searchType: 'domain' | 'keyword' = 'domain',
  keywordMode: 'domain-only' | 'full-url' = 'full-url'
) {
  // Validate and sanitize pagination parameters
  const page = Math.max(1, Number(pagination?.page) || 1)
  const limit = Math.max(1, Math.min(Number(pagination?.limit) || 50, 1000))
  const offset = Math.max(0, (page - 1) * limit)
  
  const allowedSortColumns = ['credential_count', 'full_hostname', 'path']
  const sortBy = allowedSortColumns.includes(pagination?.sortBy) 
    ? pagination.sortBy 
    : 'credential_count'
  const sortOrder = (pagination?.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  // Build WHERE clause
  const { whereClause, params: baseParams } = searchType === 'keyword' 
    ? buildKeywordWhereClause(query, keywordMode)
    : buildDomainWhereClause(query)

  // Clone params
  const params: any[] = [...baseParams]

  // Build final WHERE clause with filters
  let finalWhereClause = whereClause
  if (filters?.subdomain) {
    finalWhereClause += ` AND ${HOSTNAME_EXPR} LIKE ?`
    params.push(`%${filters.subdomain}%`)
  }

  if (filters?.path) {
    finalWhereClause += ` AND c.url LIKE ?`
    params.push(`%${filters.path}%`)
  }

  // ============================================
  // TOTAL COUNT
  // ============================================
  const countQuery = `
    SELECT COUNT(DISTINCT CONCAT(
      ${HOSTNAME_EXPR}, 
      ${PATH_EXPR}
    )) as total
    FROM credentials c
    ${finalWhereClause}
  `

  const countResult = (await executeQuery(countQuery, params)) as any[]
  const total = Number(countResult[0]?.total || 0)

  // ============================================
  // DATA QUERY
  // ============================================
  const sortByExpr = sortBy === 'full_hostname' 
    ? "full_hostname"
    : sortBy === 'path' 
      ? "path"
      : 'credential_count'

  const dataQuery = `
    SELECT 
      ${HOSTNAME_EXPR} as full_hostname,
      ${PATH_EXPR} as path,
      COUNT(*) as credential_count
    FROM credentials c
    ${finalWhereClause}
    GROUP BY full_hostname, path
    ORDER BY ${sortByExpr} ${sortOrder}
    LIMIT ${limit} OFFSET ${offset}
  `

  const data = (await executeQuery(dataQuery, params)) as any[]

  return {
    data: data.map((row: any) => ({
      fullHostname: row.full_hostname || '',
      path: row.path || '/',
      credentialCount: Number(row.credential_count || 0),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
