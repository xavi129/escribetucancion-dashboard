import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente para uso en el navegador (con restricciones RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente para uso en servidor con permisos administrativos (sin restricciones RLS)
// Solo se inicializa si la service key está disponible (servidor)
export const supabaseAdmin = typeof process.env.SUPABASE_SERVICE_ROLE_KEY !== 'undefined'
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

export type Order = {
  id: string
  transaction_id: string | null
  customer_name: string | null
  whatsapp: string | null
  email: string | null
  country: string | null
  song_type: string | null
  purpose: string | null
  occasion: string | null
  include_name: boolean | null
  person_name: string | null
  relationship: string | null
  genre: string | null
  song_references: string | null
  voice_gender: string | null
  styles: string | null
  details: string | null
  delivery_type: string | null
  payment_method: string | null
  base_price: number | null
  delivery_extra: number | null
  total_price: number | null
  addons_total_price: number | null
  payment_status: string
  status: string
  created_at: string
  updated_at: string
  completed_at: string | null
  spotify_upload: boolean | null
  responder_auto: boolean | null
  generated_lyric: string | null
  generated_style: string | null
  audio_url: string | null
  audio_url_alt: string | null
  // Campos de Suno API
  suno_task_id: string | null
  suno_audio_id: string | null
  // Campos de medios generados
  video: boolean | null
  video_url: string | null
  video_task_id: string | null
  image_url: string | null
  image_url_alt: string | null
  spotify_song_name: string | null
  lyric_revision_count: number | null
  hyperfollow_url: string | null
  // Campos de moneda y pago
  currency: string | null
  dlocal_payment_id: string | null
}

/**
 * Construye la URL del reproductor según el estado de pago
 * @param audioUrl - URL del archivo de audio generado por Suno
 * @param paymentStatus - Estado del pago ('pending', 'paid', 'refunded')
 * @param orderId - ID opcional de la orden. Si se proporciona y es preview, se usa el ID en lugar de la URL completa
 * @returns URL completa del reproductor (preview para pending, play para paid)
 */
export function buildPlayUrl(audioUrl: string, paymentStatus: string, orderId?: string): string {
  if (!audioUrl) return ""
  
  // Base URL del reproductor (ajustar según tu dominio)
  const playerBaseUrl = process.env.NEXT_PUBLIC_PLAYER_URL || "https://play.escribetucancion.com"
  
  // Si el pago está pendiente, usar preview (70 segundos)
  // Si está pagado, usar play (canción completa)
  const playerType = paymentStatus === "paid" ? "play" : "preview"
  
  // Si tenemos orderId, usar el ID directamente en lugar de la URL completa del audio
  // El reproductor detecta orderId cuando songUrlParams.length === 1 && isOrderId(songUrlParams[0])
  // Esto funciona tanto para /play/[orderId] como para /preview/[orderId]
  if (orderId) {
    return `${playerBaseUrl}/${playerType}/${orderId}`
  }
  
  // Si no hay orderId, usar la URL completa del audio (compatibilidad hacia atrás)
  // Extraer solo el dominio y la ruta, removiendo CUALQUIER protocolo
  // Remover todas las variantes posibles: https://, http://, https:/, http:/, https:, http:
  let urlWithoutProtocol = audioUrl.trim()
  
  // Remover protocolos de forma exhaustiva - hacerlo múltiples veces hasta que no haya cambios
  let cleaned = urlWithoutProtocol
  let previous = ""
  while (cleaned !== previous) {
    previous = cleaned
    // Remover https:// o http:// (con dos barras)
    cleaned = cleaned.replace(/^https?:\/\//i, "")
    // Remover https:/ o http:/ (con una barra)
    cleaned = cleaned.replace(/^https?:\//i, "")
    // Remover https: o http: (sin barras)
    cleaned = cleaned.replace(/^https?:/i, "")
  }
  
  urlWithoutProtocol = cleaned.trim()
  
  return `${playerBaseUrl}/${playerType}/https:/${urlWithoutProtocol}`
}
