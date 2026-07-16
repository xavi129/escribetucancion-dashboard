'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  User, 
  Phone, 
  Mail, 
  Music, 
  CreditCard, 
  Truck,
  FileText,
  ExternalLink,
  Search,
  Link,
  Loader2,
  X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Order } from '@/lib/supabase'
import type { Conversation } from '@/lib/d1-client'

interface OrderSidebarProps {
  order: Partial<Order> | null
  conversation: Conversation | null
  onSendSong?: () => void
  onSendLyric?: () => void
  onLinkOrder?: (orderId: string) => void
}

export default function OrderSidebar({
  order,
  conversation,
  onSendSong,
  onSendLyric,
  onLinkOrder,
}: OrderSidebarProps) {
  const router = useRouter()
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Partial<Order>[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)

  const handleSearchOrders = async () => {
    if (!conversation?.phone_number && !searchQuery) return
    
    setSearching(true)
    try {
      const query = searchQuery || conversation?.phone_number || ''
      const response = await fetch(`/api/inbox/orders/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      if (data.success) {
        setSearchResults(data.orders || [])
      }
    } catch (error) {
      console.error('Error searching orders:', error)
    } finally {
      setSearching(false)
    }
  }

  const handleLinkOrder = async (orderId: string) => {
    if (!conversation?.id) return
    
    setLinking(true)
    try {
      const response = await fetch('/api/inbox/conversations/link-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          orderId,
        }),
      })
      
      const data = await response.json()
      if (data.success) {
        setSearchMode(false)
        setSearchResults([])
        onLinkOrder?.(orderId)
      }
    } catch (error) {
      console.error('Error linking order:', error)
    } finally {
      setLinking(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400'
      case 'in_progress': return 'bg-blue-500/20 text-blue-400'
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'paid': return 'bg-green-500/20 text-green-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <p className="text-center">Selecciona una conversación para ver detalles</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Customer Info */}
      <div className="p-4 border-b border-white/10">
        <h3 className="font-semibold mb-3">Cliente</h3>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{conversation.customer_name || 'Sin nombre'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{conversation.phone_number}</span>
          </div>

          {order?.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{order.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Order Info */}
      {order ? (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Orden</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/?orderId=${order.id}`)}
              className="text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Ver
            </Button>
          </div>

          <div className="space-y-3">
            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              {order.status && (
                <Badge className={getStatusColor(order.status)}>
                  {order.status}
                </Badge>
              )}
              {order.payment_status && (
                <Badge className={getStatusColor(order.payment_status)}>
                  {order.payment_status}
                </Badge>
              )}
            </div>

            {/* Order details */}
            <div className="space-y-2 text-sm">
              {order.song_type && (
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-muted-foreground" />
                  <span>{order.song_type}</span>
                </div>
              )}

              {order.delivery_type && (
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>{order.delivery_type}</span>
                </div>
              )}

              {order.total_price && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span>${order.total_price} MXN</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Orden</h3>
            {searchMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchMode(false)
                  setSearchResults([])
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {searchMode ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por teléfono o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchOrders()}
                />
                <Button 
                  size="sm" 
                  onClick={handleSearchOrders}
                  disabled={searching}
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {searchResults.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((o) => (
                    <div 
                      key={o.id} 
                      className="p-2 bg-white/5 rounded-lg text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">
                          {o.customer_name || 'Sin nombre'}
                        </span>
                        <Badge className={getStatusColor(o.status || '')}>
                          {o.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {o.song_type} • ${o.total_price} MXN
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => handleLinkOrder(o.id!)}
                        disabled={linking}
                      >
                        {linking ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Link className="h-3 w-3 mr-1" />
                        )}
                        Vincular
                      </Button>
                    </div>
                  ))}
                </div>
              ) : searching ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : searchQuery ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No se encontraron órdenes
                </p>
              ) : null}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                No hay orden vinculada
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs"
                onClick={() => {
                  setSearchMode(true)
                  setSearchQuery(conversation?.phone_number || '')
                  setTimeout(handleSearchOrders, 100)
                }}
              >
                <Search className="h-3 w-3 mr-1" />
                Buscar orden
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Lyric Preview */}
      {order?.generated_lyric && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Letra</h3>
            {onSendLyric && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSendLyric}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                Enviar
              </Button>
            )}
          </div>
          <div className="bg-white/5 rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {order.generated_lyric.slice(0, 500)}
              {order.generated_lyric.length > 500 && '...'}
            </p>
          </div>
        </div>
      )}

      {/* Audio Preview */}
      {order?.audio_url && (
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Audio</h3>
            <div className="flex gap-1">
              {order.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`${process.env.NEXT_PUBLIC_PLAYER_URL}/${order.id}`, '_blank')}
                  className="text-xs"
                  title="Abrir en Player"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Player
                </Button>
              )}
              {onSendSong && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSendSong}
                  className="text-xs"
                >
                  <Music className="h-3 w-3 mr-1" />
                  Enviar
                </Button>
              )}
            </div>
          </div>
          <audio 
            controls 
            className="w-full" 
            src={order.audio_url}
          />
        </div>
      )}
    </div>
  )
}
