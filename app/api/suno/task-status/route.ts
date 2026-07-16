import { NextResponse } from "next/server"
import { checkTaskStatus } from "@/lib/suno-api"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Extract task ID
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json({ success: false, message: "Task ID is required" }, { status: 400 })
    }

    // Check task status
    const result = await checkTaskStatus(taskId)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error checking Suno task status:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error checking task status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
