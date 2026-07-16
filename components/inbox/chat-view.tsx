'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, Loader2, Check, CheckCheck, Clock, Smile } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import type { Message } from '@/lib/d1-client'
import type { ConversationWithOrder } from '@/lib/inbox-types'
import WindowStatusIndicator from './window-status-indicator'
import QuickActions from './quick-actions'
import TemplateSelector from './template-selector'
import MediaMessage from './media-message'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '✅']

interface ChatViewProps {
  conversation: ConversationWithOrder
  messages: Message[]
  onSendMessage: (content: string, type?: string) => Promise<void>
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  sending: boolean
}

export default function ChatView({
  conversation,
  messages,
  onSendMessage,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  sending,
}: ChatViewProps) {
  const [inputValue, setInputValue] = useState('')
  const [showReactions, setShowReactions] = useState<string | null>(null)
  const [reacting, setReacting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(true)
  const lastMessageCountRef = useRef(0)

  const handleReaction = async (messageId: string, wamid: string | null, emoji: string) => {
    if (!wamid || reacting) return
    
    setReacting(true)
    try {
      const response = await fetch('/api/whatsapp/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: conversation.phone_number,
          messageId: wamid,
          emoji,
        }),
      })

      // Check if the response is ok
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`HTTP Error ${response.status}: ${errorText}`)
        
        // Show user-friendly error message
        toast.error(`Error al enviar reacción: ${response.status === 429 ? 'Demasiadas solicitudes' : 'Error del servidor'}`)
        return
      }

      // Optionally parse and validate response body
      const result = await response.json().catch(() => null)
      if (result && !result.success) {
        console.error('API Error:', result.error || 'Unknown API error')
        toast.error('Error al enviar reacción')
        return
      }

      // Success - could show success toast if desired
      // toast.success('Reacción enviada')
      
    } catch (error) {
      console.error('Network error sending reaction:', error)
      toast.error('Error de conexión al enviar reacción')
    } finally {
      setReacting(false)
      setShowReactions(null)
    }
  }

  // Check if user is at the bottom
  const isAtBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return true
    
    const { scrollTop, scrollHeight, clientHeight } = container
    // More precise detection - within 10 pixels of bottom
    return Math.abs(scrollHeight - scrollTop - clientHeight) < 10
  }, [])

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return

    // Check if at bottom for auto-scroll behavior
    shouldScrollRef.current = isAtBottom()

    // Check if at top for loading more messages
    if (container.scrollTop < 100 && hasMore && !loadingMore) {
      onLoadMore()
    }
  }, [isAtBottom, hasMore, loadingMore, onLoadMore])

  // Scroll to bottom when messages change (only if user was at bottom or it's initial load)
  useEffect(() => {
    // Only scroll if message count actually changed and we should scroll
    if (messages.length !== lastMessageCountRef.current && messages.length > 0 && shouldScrollRef.current) {
      lastMessageCountRef.current = messages.length
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        })
      })
    }
  }, [messages.length])

  // Always scroll to bottom when conversation changes
  useEffect(() => {
    shouldScrollRef.current = true
    lastMessageCountRef.current = 0 // Reset message count
    
    // Use requestAnimationFrame for initial scroll
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'auto',
          block: 'end'
        })
      })
    }
  }, [conversation.id])

  const handleSend = async () => {
    if (!inputValue.trim() || sending) return
    
    const message = inputValue
    setInputValue('')
    
    // Set flag to scroll after message is added
    shouldScrollRef.current = true
    
    await onSendMessage(message)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-400" />
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" />
      case 'pending':
        return <Clock className="h-3 w-3 text-muted-foreground" />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">
              {conversation.customer_name || conversation.phone_number}
            </h3>
            {conversation.customer_name && (
              <p className="text-sm text-muted-foreground">{conversation.phone_number}</p>
            )}
          </div>
          <WindowStatusIndicator lastIncomingAt={conversation.last_incoming_at} />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions
        order={conversation.order || null}
        phoneNumber={conversation.phone_number}
        conversationId={conversation.id}
        onMessageSent={(success, error) => {
          if (success) {
            // Trigger refresh after sending interactive message
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          } else {
            // Handle error state - you can add toast notification here if needed
            console.warn('Message send failed:', error)
          }
        }}
      />

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Load more indicator at top */}
            {loadingMore && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Cargando mensajes anteriores...</span>
              </div>
            )}
            
            {/* No more messages indicator */}
            {!hasMore && messages.length > 0 && (
              <div className="flex items-center justify-center p-4">
                <span className="text-xs text-muted-foreground">Inicio de la conversación</span>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No hay mensajes
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'} group relative mb-4 w-full`}
                >
                  {/* Reaction button for incoming messages */}
                  {msg.direction === 'incoming' && msg.wamid && (
                    <div className="flex items-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-full"
                        onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)}
                      >
                        <Smile className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}

                  <div className="relative">
                    {/* Reaction picker */}
                    {showReactions === msg.id && (
                      <div className="absolute bottom-full left-0 mb-1 bg-zinc-800 rounded-full px-2 py-1 flex gap-1 shadow-lg z-10">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, msg.wamid, emoji)}
                            disabled={reacting}
                            className="hover:scale-125 transition-transform text-lg px-1"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <div
                      className={`inline-block min-w-[80px] max-w-[400px] rounded-2xl px-4 py-2 ${
                        msg.direction === 'outgoing'
                          ? msg.source === 'agent'
                            ? 'bg-blue-600 text-white rounded-br-md border-l-4 border-blue-400' // Mensajes del agente - azul con borde
                            : 'bg-green-600 text-white rounded-br-md' // Mensajes del operador - verde
                          : 'bg-white/10 text-white rounded-bl-md' // Mensajes entrantes - gris
                      }`}
                      style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}
                    >
                      {/* Source indicator for agent messages */}
                      {msg.direction === 'outgoing' && msg.source === 'agent' && (
                        <div className="flex items-center gap-1 mb-2 text-xs opacity-90">
                          <div className="w-2 h-2 rounded-full bg-blue-300"></div>
                          <span className="font-medium">Agente Automático</span>
                        </div>
                      )}
                      
                      {/* Media content */}
                      {msg.media_url && (msg.type === 'image' || msg.type === 'audio' || msg.type === 'document') ? (
                        <MediaMessage
                          type={msg.type as 'image' | 'audio' | 'document'}
                          mediaId={msg.media_url}
                          content={msg.content}
                        />
                      ) : (
                        /* Text content */
                        <div className="text-left">
                          <span className="inline-block">{msg.content}</span>
                        </div>
                      )}
                      
                      {/* Timestamp and status */}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-xs opacity-70">
                          {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                        </span>
                        {msg.direction === 'outgoing' && getStatusIcon(msg.status)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10 bg-white/5">
        <div className="flex gap-2">
          <TemplateSelector
            onSelectTemplate={async (templateName) => {
              await onSendMessage(templateName, 'template')
            }}
            disabled={sending}
            context={{
              customerName: conversation.customer_name || undefined,
              totalPrice: conversation.order?.total_price || undefined,
              playUrl: conversation.order?.audio_url || undefined,
            }}
          />
          <Input
            placeholder="Escribe un mensaje..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={sending}
            className="flex-1 bg-white/5 border-white/10"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            className="bg-green-600 hover:bg-green-700"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
