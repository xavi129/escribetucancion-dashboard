import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, lyric } = body

    if (!orderId) {
      return NextResponse.json({ success: false, message: "Order ID is required" }, { status: 400 })
    }

    if (!lyric) {
      return NextResponse.json({ success: false, message: "Lyric is required" }, { status: 400 })
    }

    // Update the order with the generated lyric
    const { data, error } = await supabase
      .from("orders")
      .update({ 
        generated_lyric: lyric,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single()

    if (error) {
      console.error("Error saving lyric to database:", error)
      return NextResponse.json(
        { success: false, message: "Error saving lyric to database", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Lyric saved successfully",
      data: data
    })
  } catch (error) {
    console.error("Error processing save-lyric request:", error)
    return NextResponse.json(
      {
        success: false,
        message: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}
