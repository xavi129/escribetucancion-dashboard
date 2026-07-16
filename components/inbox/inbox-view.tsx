'use client'

import { useState } from 'react'
import { useConversations } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'
import ConversationList from './conversation-list'
import ChatView from './chat-view'
import OrderSidebar from './order-sidebar'
import { Loader2 } from 'lucide-react'

export default function InboxView() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    unreadOnly: false,
    orderStatus: '',
  })

  const { 
    conversations, 
    loading: conversationsLoading, 
    loadingMore: conversationsLoadingMore,
    hasMore: conversationsHasMore,
    error: conversationsError,
    refresh: refreshConversations,
    loadMore: loadMoreConversations
  } = useConversations(filters)

  const selectedConversation = conversations.find(c => c.id === selectedConversationId)

  const {
    messages,
    loading: messagesLoading,
    loadingMore: messagesLoadingMore,
    hasMore: messagesHasMore,
    refresh: refreshMessages,
    loadMore: loadMoreMessages,
    sendMessage,
    sending,
  } = useMessages(selectedConversationId)

  const handleSelectConversation = async (id: string) => {
    setSelectedConversationId(id)
    
    // Mark conversation as read
    try {
      await fetch('/api/inbox/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: id,
          action: 'markAsRead',
        }),
      })
      // Refresh to update unread count in the list
      refreshConversations()
    } catch (error) {
      console.error('Error marking conversation as read:', error)
    }
  }

  const handleSendMessage = async (content: string, type: string = 'text') => {
    if (!selectedConversation) return

    await sendMessage({
      phoneNumber: selectedConversation.phone_number,
      message: content,
      type,
      conversationId: selectedConversation.id,
    })

    refreshMessages()
    refreshConversations()
  }

  return (
    <div className="flex h-full">
      {/* Conversation List - Left Panel */}
      <div className="w-80 border-r border-white/10 flex flex-col">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          filters={filters}
          onFilterChange={setFilters}
          loading={conversationsLoading}
          loadingMore={conversationsLoadingMore}
          hasMore={conversationsHasMore}
          onLoadMore={loadMoreConversations}
        />
      </div>

      {/* Chat View - Center Panel */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ChatView
            conversation={selectedConversation}
            messages={messages}
            onSendMessage={handleSendMessage}
            loading={messagesLoading}
            loadingMore={messagesLoadingMore}
            hasMore={messagesHasMore}
            onLoadMore={loadMoreMessages}
            sending={sending}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg">Selecciona una conversación</p>
              <p className="text-sm mt-1">para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>

      {/* Order Sidebar - Right Panel */}
      <div className="w-80 border-l border-white/10">
        <OrderSidebar
          order={selectedConversation?.order || null}
          conversation={selectedConversation || null}
          onSendSong={() => handleSendMessage(selectedConversation?.order?.audio_url || '', 'audio')}
          onSendLyric={() => handleSendMessage(selectedConversation?.order?.generated_lyric || '')}
          onLinkOrder={() => refreshConversations()}
        />
      </div>
    </div>
  )
}
