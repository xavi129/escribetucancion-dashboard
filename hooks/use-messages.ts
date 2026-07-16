'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Message } from '@/lib/d1-client'

interface SendMessageParams {
  phoneNumber: string
  message: string
  type?: string
  conversationId?: string
  templateName?: string
  templateParams?: any[]
  audioUrl?: string
}

interface UseMessagesResult {
  messages: Message[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  refresh: () => void
  loadMore: () => void
  sendMessage: (params: SendMessageParams) => Promise<boolean>
  sending: boolean
}

export function useMessages(conversationId: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchMessages = useCallback(async (pageNum: number = 1, append: boolean = false, isPolling = false) => {
    if (!conversationId) {
      setMessages([])
      return
    }

    try {
      // Only show loading on initial fetch, not polling or loading more
      if (!isPolling && !append) {
        setLoading(true)
      } else if (append) {
        setLoadingMore(true)
      }
      
      const response = await fetch(`/api/inbox/messages?conversationId=${conversationId}&page=${pageNum}&limit=10`)
      const data = await response.json()

      if (data.success) {
        const newMessages = data.messages as Message[]
        
        if (append) {
          // Prepend older messages to the beginning
          setMessages(prev => [...newMessages, ...prev])
        } else {
          // Replace all messages (initial load or refresh)
          setMessages(newMessages)
        }
        
        setHasMore(data.pagination.hasMore)
        setError(null)
      } else {
        setError(data.error || 'Error al cargar mensajes')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('[useMessages] Error:', err)
    } finally {
      if (!isPolling && !append) {
        setLoading(false)
      } else if (append) {
        setLoadingMore(false)
      }
    }
  }, [conversationId])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && conversationId) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchMessages(nextPage, true)
    }
  }, [page, loadingMore, hasMore, conversationId, fetchMessages])

  const refresh = useCallback(() => {
    setPage(1)
    setHasMore(true)
    fetchMessages(1, false)
  }, [fetchMessages])

  // Fetch when conversation changes
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    fetchMessages(1, false)
  }, [conversationId])

  // Polling every 5 seconds when conversation is selected (only for first page)
  useEffect(() => {
    if (!conversationId) return

    const interval = setInterval(() => {
      // Only poll if we're on the first page to check for new messages
      if (page === 1) {
        fetchMessages(1, false, true)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [conversationId, page, fetchMessages])

  const sendMessage = useCallback(async (params: SendMessageParams): Promise<boolean> => {
    try {
      setSending(true)
      
      const response = await fetch('/api/whatsapp/send-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh messages after sending (reset to first page)
        setPage(1)
        setHasMore(true)
        await fetchMessages(1, false)
        return true
      } else {
        setError(data.error || 'Error al enviar mensaje')
        return false
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('[useMessages] Send error:', err)
      return false
    } finally {
      setSending(false)
    }
  }, [fetchMessages])

  return {
    messages,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    sendMessage,
    sending,
  }
}
