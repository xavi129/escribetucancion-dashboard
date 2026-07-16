import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsapp, orderId, songFileUrl } = body

    if (!whatsapp && !orderId) {
      return NextResponse.json(
        { success: false, error: "WhatsApp number or orderId is required" },
        { status: 400 }
      )
    }

    // Construir la consulta
    let query = supabase.from("orders").select("*")

    if (orderId) {
      query = query.eq("id", orderId)
    } else if (whatsapp) {
      query = query.eq("whatsapp", whatsapp).order("created_at", { ascending: false }).limit(1)
    }

    const { data: order, error: orderError } = await query.single()

    if (orderError || !order) {
      return NextResponse.json(
        { 
          success: false, 
          error: "No se encontró la orden",
          details: orderError?.message 
        },
        { status: 404 }
      )
    }

    // Validar que el pago esté confirmado
    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { 
          success: false, 
          error: "La orden no puede completarse sin pago confirmado",
          currentPaymentStatus: order.payment_status 
        },
        { status: 400 }
      )
    }

    // Preparar los datos de actualización
    const updateData: any = {
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Si se proporciona URL del archivo de la canción, guardarla
    if (songFileUrl) {
      updateData.audio_url = songFileUrl
    }

    // Actualizar la orden
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Error al actualizar el estado de la orden",
          details: updateError.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Orden completada exitosamente",
      data: {
        orderId: updatedOrder.id,
        orderStatus: updatedOrder.status,
        paymentStatus: updatedOrder.payment_status,
        completedAt: updatedOrder.completed_at,
        audioUrl: updatedOrder.audio_url,
        whatsapp: updatedOrder.whatsapp,
        customerName: updatedOrder.customer_name
      }
    })

  } catch (error) {
    console.error("Error en complete-order:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Error interno del servidor: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    )
  }
}
