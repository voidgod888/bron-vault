import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { targetDomain, filters, pagination, searchQuery, searchType = 'domain' } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    // Normalize Domain
    let cleanDomain = targetDomain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0]

    // Cleaner log: only show search if present
    const logData: any = { type: searchType, domain: cleanDomain }
    if (searchQuery && searchQuery.trim()) {
      logData.search = searchQuery.trim()
    }
    console.log("🚀 API Called (Optimized):", logData)

    // Call the new data getter function
    const credentialsData = await getCredentialsDataOptimized(cleanDomain, filters, pagination, searchQuery, searchType, body.keywordMode)

    return NextResponse.json({
      success: true,
      targetDomain: cleanDomain,
      searchType,
      credentials: credentialsData.data || [],
      pagination: credentialsData.pagination,
    })

  } catch (error) {
    console.error("❌ Error in credentials API:", error)
    return NextResponse.json(
      { error: "Failed to get credentials data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

async function getCredentialsDataOptimized(
  query: string,
  filters?: any,
  pagination?: any,
  searchQuery?: string,
  searchType: 'domain' | 'keyword' = 'domain',
  keywordMode: 'domain-only' | 'full-url' = 'full-url'
) {
  const page = Number(pagination?.page) || 1
  const limit = Number(pagination?.limit) || 50
  const offset = Number((page - 1) * limit)
  
  // Setup Sort
  const allowedSortColumns = ['created_at', 'url', 'username', 'log_date', 'device_id']
  let sortBy = allowedSortColumns.includes(pagination?.sortBy) ? pagination.sortBy : 'created_at'
  const sortOrder = (pagination?.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  // ==========================================
  // BUILD WHERE CLAUSE
  // ==========================================
  
  let whereConditions: string[] = []
  const params: any[] = []

  if (searchType === 'domain') {
    // DOMAIN MATCHING
    // Logic: Domain column exact match OR Domain column ends with .target.com (using LIKE) OR URL pattern
    whereConditions.push(`(
      c.domain = ? OR
      c.domain LIKE ? OR
      c.url LIKE ?
    )`)
    params.push(query)
    params.push(`%.${query}`)
    params.push(`%${query}%`)
  } else {
    // KEYWORD SEARCH
    if (keywordMode === 'domain-only') {
      whereConditions.push(`(c.domain LIKE ?)`)
      params.push(`%${query}%`)
    } else {
      whereConditions.push(`(c.url LIKE ? OR c.domain LIKE ?)`)
      params.push(`%${query}%`)
      params.push(`%${query}%`)
    }
  }

  // Additional Filters
  if (filters?.subdomain) {
    whereConditions.push(`c.url LIKE ?`)
    params.push(`%${filters.subdomain}%`)
  }
  if (filters?.path) {
    whereConditions.push(`c.url LIKE ?`)
    params.push(`%${filters.path}%`)
  }
  if (filters?.browser) {
    whereConditions.push(`c.browser = ?`)
    params.push(filters.browser)
  }
  if (filters?.deviceId) {
    whereConditions.push(`c.device_id = ?`)
    params.push(filters.deviceId)
  }

  const hasGlobalSearch = searchQuery && searchQuery.trim().length > 0

  if (hasGlobalSearch) {
    const searchTerm = searchQuery.trim()
    
    // Search in table C (url/username) OR table D (device_name)
    whereConditions.push(`(
      c.url LIKE ? OR
      c.username LIKE ? OR
      d.device_name LIKE ?
    )`)
    params.push(`%${searchTerm}%`)
    params.push(`%${searchTerm}%`)
    params.push(`%${searchTerm}%`)
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : ''

  // ==========================================
  // EXECUTE COUNT
  // ==========================================
  
  let countQuery = ''
  
  if (hasGlobalSearch) {
    // Must JOIN because searching device_name
    countQuery = `
      SELECT COUNT(*) as total
      FROM credentials c
      LEFT JOIN devices d ON c.device_id = d.device_id
      ${whereClause}
    `
  } else {
    // Main table only
    countQuery = `
      SELECT COUNT(*) as total
      FROM credentials c
      ${whereClause}
    `
  }

  const countResult = (await executeQuery(countQuery, params)) as any[]
  const total = Number(countResult[0]?.total || 0)

  // ==========================================
  // EXECUTE DATA
  // ==========================================

  // Handle Sort
  let orderByClause = ''
  if (sortBy === 'log_date') {
    orderByClause = `ORDER BY COALESCE(STR_TO_DATE(si.log_date, '%Y-%m-%d'), c.created_at) ${sortOrder}`
  } else if (sortBy === 'device_id') {
    orderByClause = `ORDER BY c.device_id ${sortOrder}`
  } else {
    orderByClause = `ORDER BY c.${sortBy} ${sortOrder}`
  }

  const dataQuery = `
    SELECT 
      c.id as id,
      c.url,
      c.username as username,
      c.password as password,
      c.browser as browser,
      c.device_id as deviceId,
      d.device_name as deviceName,
      c.created_at as createdAt,
      si.log_date as logDate
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause}
    ${orderByClause}
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `

  const data = (await executeQuery(dataQuery, params)) as any[]

  return {
    data: data.map((row: any) => ({
      id: row.id,
      url: row.url || '',
      username: row.username || '', 
      password: row.password || '',
      browser: row.browser || 'Unknown',
      deviceId: row.deviceId || '',
      deviceName: row.deviceName || '',
      createdAt: row.createdAt || '',
      logDate: row.logDate || null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
