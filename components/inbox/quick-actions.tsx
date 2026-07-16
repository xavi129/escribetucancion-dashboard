'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Music, 
  FileText, 
  CreditCard, 
  ExternalLink,
  Disc3,
  CheckCircle,
  Truck,
  Loader2,
  Send,
  Sparkles
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Order } from '@/lib/supabase'

interface QuickActionsProps {
  order: Partial<Order> | null
  phoneNumber: string
  conversationId: string
  onMessageSent?: (success: boolean, error?: string) => void
}

type ActionType = 'song_confirmation' | 'lyric_approval' | 'payment_reminder' | 'delivery_options' | 'song_player' | 'song_preview' | 'spotify' | 'send_to_leads' | 'generate_lyric'

export default function QuickActions({
  order,
  phoneNumber,
  conversationId,
  onMessageSent,
}: QuickActionsProps) {
  const router = useRouter()
  const [sending, setSending] = useState<ActionType | null>(null)

  const canSendSong = order?.audio_url
  const canSendLyric = order?.generated_lyric
  const canSendSpotify = order?.hyperfollow_url
  const customerName = order?.customer_name || 'Cliente'

  const sendInteractiveMessage = async (action: ActionType) => {
    setSending(action)
    try {
      // Special handling for send_to_leads - use direct Meta API
      if (action === 'send_to_leads') {
        try {
          // Send welcome message
          const welcomeMsg = `Hola ${customerName}, ¡muchas gracias por tu solicitud! Estamos procesando tu pedido para la canción personalizada.`
          
          const welcomeResponse = await fetch('/api/whatsapp/send-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber,
              message: welcomeMsg,
              conversationId,
            }),
          })

          if (!welcomeResponse.ok) {
            const welcomeError = await welcomeResponse.json()
            const errorMsg = welcomeError.error || 'Error sending welcome message'
            console.error('Error sending welcome message:', welcomeError)
            onMessageSent?.(false, errorMsg)
            return
          }

          // If has lyric, send it after a delay
          if (order?.generated_lyric) {
            await new Promise(resolve => setTimeout(resolve, 1500))
            
            const lyricMsg = `📝 *Letra de tu canción personalizada:*\n\n${order.generated_lyric}`
            const lyricResponse = await fetch('/api/whatsapp/send-direct', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phoneNumber,
                message: lyricMsg,
                conversationId,
              }),
            })

            if (!lyricResponse.ok) {
              const lyricError = await lyricResponse.json()
              const errorMsg = lyricError.error || 'Error sending lyric message'
              console.error('Error sending lyric message:', lyricError)
              onMessageSent?.(false, errorMsg)
              return
            }

            // Send confirmation instructions with buttons
            await new Promise(resolve => setTimeout(resolve, 1500))
            
            const interactiveResponse = await fetch('/api/whatsapp/send-interactive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phoneNumber,
                conversationId,
                action: 'lyric_approval',
                data: {
                  customerName,
                  lyric: order.generated_lyric,
                },
              }),
            })

            if (!interactiveResponse.ok) {
              const interactiveError = await interactiveResponse.json()
              const errorMsg = interactiveError.error || 'Error sending interactive message'
              console.error('Error sending interactive message:', interactiveError)
              onMessageSent?.(false, errorMsg)
              return
            }
          }

          // Only call onMessageSent on complete success
          onMessageSent?.(true)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error in send_to_leads sequence'
          console.error('Error in send_to_leads sequence:', error)
          onMessageSent?.(false, errorMsg)
        }
        return
      }

      // Special handling for generate_lyric
      if (action === 'generate_lyric') {
        const response = await fetch('/api/orders/generate-and-save-lyric', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            whatsapp: phoneNumber,
            forceRegenerate: false,
          }),
        })
        const result = await response.json()
        if (result.success) {
          onMessageSent?.(true)
        } else {
          const errorMsg = result.message || 'Error generating lyric'
          console.error('Error generating lyric:', result.message)
          onMessageSent?.(false, errorMsg)
        }
        return
      }

      // Special handling for song_preview - use direct Meta API
      if (action === 'song_preview') {
        const response = await fetch('/api/whatsapp/send-song-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order?.id,
            phoneNumber,
            conversationId,
          }),
        })
        const result = await response.json()
        if (result.success) {
          onMessageSent?.(true)
        } else {
          const errorMsg = result.error || 'Error sending song'
          console.error('Error sending song:', result.error)
          onMessageSent?.(false, errorMsg)
        }
        return
      }

      const response = await fetch('/api/whatsapp/send-interactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          conversationId,
          action,
          data: {
            customerName,
            audioUrl: order?.audio_url,
            lyric: order?.generated_lyric,
            totalPrice: order?.total_price,
            playUrl: order?.audio_url ? `${process.env.NEXT_PUBLIC_PLAYER_URL}/${order.id}` : undefined,
            hyperfollowUrl: order?.hyperfollow_url,
            orderId: order?.id,
          },
        }),
      })

      const result = await response.json()
      if (result.success) {
        onMessageSent?.(true)
      } else {
        const errorMsg = result.error || 'Error sending interactive message'
        console.error('Error sending interactive message:', result.error)
        onMessageSent?.(false, errorMsg)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error:', error)
      onMessageSent?.(false, errorMsg)
    } finally {
      setSending(null)
    }
  }

  const ActionButton = ({ 
    action, 
    icon: Icon, 
    label, 
    disabled = false 
  }: { 
    action: ActionType
    icon: React.ElementType
    label: string
    disabled?: boolean 
  }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => sendInteractiveMessage(action)}
      disabled={disabled || sending !== null}
      className="text-xs"
    >
      {sending === action ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : (
        <Icon className="h-3 w-3 mr-1" />
      )}
      {label}
    </Button>
  )

  return (
    <div className="p-3 border-b border-white/10 bg-white/5">
      <div className="flex flex-wrap gap-2">
        {/* Song Preview/Full - Direct Meta API */}
        <ActionButton
          action="song_preview"
          icon={Music}
          label="Enviar Canción"
          disabled={!canSendSong}
        />

        {/* Song Confirmation with Buttons */}
        <ActionButton
          action="song_confirmation"
          icon={CheckCircle}
          label="Confirmar Canción"
          disabled={!canSendSong}
        />

        {/* Lyric Approval with Buttons */}
        <ActionButton
          action="lyric_approval"
          icon={FileText}
          label="Aprobar Letra"
          disabled={!canSendLyric}
        />

        {/* Payment Reminder with CTA */}
        <ActionButton
          action="payment_reminder"
          icon={CreditCard}
          label="Recordatorio Pago"
        />

        {/* Delivery Options List */}
        <ActionButton
          action="delivery_options"
          icon={Truck}
          label="Opciones Entrega"
        />

        {/* Send to Leads - Welcome + Lyric + Instructions */}
        {order?.id && (
          <ActionButton
            action="send_to_leads"
            icon={Send}
            label="Enviar Bienvenida"
          />
        )}

        {/* Generate Lyric */}
        {order?.id && !canSendLyric && (
          <ActionButton
            action="generate_lyric"
            icon={Sparkles}
            label="Generar Letra"
          />
        )}

        {/* Spotify Link */}
        {canSendSpotify && (
          <ActionButton
            action="spotify"
            icon={Disc3}
            label="Link Spotify"
          />
        )}

        {/* View Order */}
        {order?.id && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/?orderId=${order.id}`)}
            className="text-xs"
            disabled={sending !== null}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Ver Orden
          </Button>
        )}
      </div>
    </div>
  )
}
