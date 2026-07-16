import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/inbox/orders/search
 * 
 * Search orders by phone number, email, or customer name.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query = url.searchParams.get('q') || ''

    if (!query || query.length < 3) {
      return NextResponse.json({
        success: true,
        orders: [],
      })
    }

    // Clean phone number for search (remove non-digits)
    const cleanPhone = query.replace(/\D/g, '')

    // Search in Supabase orders (field is 'whatsapp', not 'phone')
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, customer_name, email, whatsapp, status, payment_status, song_type, delivery_type, total_price, audio_url, generated_lyric, created_at')
      .or(`whatsapp.ilike.%${cleanPhone}%,email.ilike.%${query}%,customer_name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[Orders Search] Error:', error)
      return NextResponse.json(
        { success: false, error: 'Error al buscar órdenes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      orders: orders || [],
    })
  } catch (error) {
    console.error('[Orders Search] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al buscar órdenes' },
      { status: 500 }
    )
  }
}
