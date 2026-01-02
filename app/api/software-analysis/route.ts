import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db";
import { validateRequest } from "@/lib/auth";
import { getOrSetCache } from "@/lib/redis";

interface SoftwareData {
  software_name: string;
  version: string | null;
  count: number;
}

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await getOrSetCache("software_analysis", 600, async () => {
        // Query to get software grouped by name and version for attack surface management
        // SingleStore: COUNT(DISTINCT device_id)
        const results = await executeQuery(`
          SELECT software_name, version, COUNT(DISTINCT device_id) as count
          FROM software
          WHERE software_name IS NOT NULL AND software_name != ''
          GROUP BY software_name, version
          ORDER BY count DESC, software_name, version
          LIMIT 10
        `) as any[];

        if (!Array.isArray(results)) {
           throw new Error("Invalid data format from DB");
        }

        // Convert to array format
        const softwareAnalysis: SoftwareData[] = results.map((row) => ({
          software_name: row.software_name,
          version: row.version,
          count: row.count
        }));

        return {
          success: true,
          softwareAnalysis
        };
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error("Software analysis error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
}
