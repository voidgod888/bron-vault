import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain } = body

    if (!domain) {
      return NextResponse.json({ success: false, error: "Domain is required" }, { status: 400 })
    }

    const rows = await executeQuery(
      `SELECT * FROM scanned_hosts WHERE domain = ?`,
      [domain]
    ) as any[]

    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: null })
    }

    const scanData = rows[0]

    // Parse ports if stored as JSON string
    if (typeof scanData.ports === 'string') {
      try {
        scanData.ports = JSON.parse(scanData.ports)
      } catch (e) {
        scanData.ports = []
      }
    }

    return NextResponse.json({ success: true, data: scanData })

  } catch (error) {
    console.error("Error fetching network info:", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}
