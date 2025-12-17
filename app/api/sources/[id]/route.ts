import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { executeQuery } from "@/lib/mysql"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const id = params.id
    await executeQuery("DELETE FROM sources WHERE id = ?", [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete source" }, { status: 500 })
  }
}
