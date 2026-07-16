import { NextResponse } from "next/server"
import { auth } from '@clerk/nextjs/server'
import { createMessageTemplate } from "@/lib/whatsapp-business"

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      console.warn("[WhatsApp API] Unauthorized access attempt to /templates/create")
      return NextResponse.json({ success: false, message: "Unauthorized: Please log in via Clerk" }, { status: 401 })
    }

    const { name, category, bodyText, language } = await request.json()

    if (!name || !category || !bodyText) {
      return NextResponse.json(
        { success: false, message: "Name, category, and bodyText are required" },
        { status: 400 }
      )
    }

    // Default language to Spanish (MX) if not provided, since the user communicates in Spanish
    const lang = language || 'es_MX'

    const result = await createMessageTemplate(name, category, bodyText, lang)

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
