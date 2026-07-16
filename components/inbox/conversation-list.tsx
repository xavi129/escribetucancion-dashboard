'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ConversationWithOrder } from '@/lib/inbox-types'

interface ConversationListProps {
  conversations: ConversationWithOrder[]
  selectedId: string | null
  onSelect: (id: string) => void
  filters: {
    search: string
    unreadOnly: boolean
    orderStatus: string
  }
  onFilterChange: (filters: any) => void
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
}: ConversationListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400'
      case 'in_progress': return 'bg-blue-500/20 text-blue-400'
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold mb-3">Conversaciones</h2>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3">
          <Button
            variant={filters.unreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange({ ...filters, unreadOnly: !filters.unreadOnly })}
            className="text-xs"
          >
            No leídos
          </Button>
          <select
            value={filters.orderStatus}
            onChange={(e) => onFilterChange({ ...filters, orderStatus: e.target.value })}
            className="text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En progreso</option>
            <option value="completed">Completado</option>
          </select>
        </div>
      </div>

      {/* Conversation Count */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-white/10">
        {conversations.length} conversaciones
      </div>

      {/* Conversation List */}
      <div 
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
          // Load more when user scrolls to bottom
          if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loadingMore) {
            onLoadMore()
          }
        }}
      >
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No hay conversaciones
          </div>
        ) : (
          <>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${
                  selectedId === conv.id ? 'bg-white/10' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Name and unread indicator */}
                    <div className="flex items-center gap-2">
                      {conv.unread_count > 0 && (
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      )}
                      <span className="font-medium truncate">
                        {conv.customer_name || conv.phone_number}
                      </span>
                    </div>

                    {/* Phone number (if name exists) */}
                    {conv.customer_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {conv.phone_number}
                      </p>
                    )}

                    {/* Last message preview */}
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {conv.last_message || 'Sin mensajes'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {/* Timestamp */}
                    {conv.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.last_message_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    )}

                    {/* Order status badge */}
                    {conv.order?.status && (
                      <Badge className={`text-xs ${getStatusColor(conv.order.status)}`}>
                        {conv.order.status}
                      </Badge>
                    )}

                    {/* Unread count */}
                    {conv.unread_count > 0 && (
                      <Badge className="bg-green-500 text-white text-xs">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Load more indicator */}
            {loadingMore && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Cargando más...</span>
              </div>
            )}
            
            {/* End of list indicator */}
            {!hasMore && conversations.length > 0 && (
              <div className="flex items-center justify-center p-4">
                <span className="text-xs text-muted-foreground">No hay más conversaciones</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
