import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"
import { getOrSetCache } from "@/lib/redis"

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

    const formattedTlds = await getOrSetCache("top_tlds", 600, async () => {
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
        const formatted = topTlds.map(row => ({
          tld: row.tld,
          count: Number(row.count) || 0,
          affected_devices: Number(row.affected_devices) || 0
        }))

        console.log(
          `📊 [TOP-TLDS] Found ${formatted.length} top TLDs`,
        )
        console.log("📊 [TOP-TLDS] Sample data:", formatted.slice(0, 2))

        return formatted;
    });

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
