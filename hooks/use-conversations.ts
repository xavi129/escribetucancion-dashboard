'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ConversationWithOrder } from '@/lib/inbox-types'

interface ConversationFilters {
  search: string
  unreadOnly: boolean
  orderStatus: string
}

interface UseConversationsResult {
  conversations: ConversationWithOrder[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  refresh: () => void
  loadMore: () => void
}

export function useConversations(filters: ConversationFilters): UseConversationsResult {
  const [conversations, setConversations] = useState<ConversationWithOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchConversations = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams()
      params.set('page', pageNum.toString())
      params.set('limit', '10')
      if (filters.search) params.set('search', filters.search)
      if (filters.unreadOnly) params.set('unreadOnly', 'true')
      if (filters.orderStatus) params.set('orderStatus', filters.orderStatus)

      const response = await fetch(`/api/inbox/conversations?${params}`)
      const data = await response.json()

      if (data.success) {
        if (append) {
          setConversations(prev => [...prev, ...data.conversations])
        } else {
          setConversations(data.conversations)
        }
        setHasMore(data.pagination.hasMore)
        setError(null)
      } else {
        setError(data.error || 'Error al cargar conversaciones')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('[useConversations] Error:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filters.search, filters.unreadOnly, filters.orderStatus])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchConversations(nextPage, true)
    }
  }, [page, loadingMore, hasMore, fetchConversations])

  const refresh = useCallback(() => {
    setPage(1)
    setHasMore(true)
    fetchConversations(1, false)
  }, [fetchConversations])

  // Initial fetch
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    fetchConversations(1, false)
  }, [filters.search, filters.unreadOnly, filters.orderStatus])

  // Polling every 5 seconds (only for first page to check for new messages)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if we're on the first page and not currently loading
      if (page === 1 && !loading && !loadingMore) {
        fetchConversations(1, false)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [page, loading, loadingMore, fetchConversations])

  return {
    conversations,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  }
}
