import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { executeQuery } from "@/lib/db"

export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const sources = await executeQuery("SELECT * FROM sources ORDER BY created_at DESC")
    return NextResponse.json({ sources })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, identifier } = body

    if (!name || !identifier) {
      return NextResponse.json({ error: "Name and Identifier are required" }, { status: 400 })
    }

    await executeQuery(
      "INSERT INTO sources (name, identifier, type, enabled) VALUES (?, ?, 'telegram', TRUE)",
      [name, identifier]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Add source error:", error)
    return NextResponse.json({ error: "Failed to add source" }, { status: 500 })
  }
}
