// TikTok Ads Cache Layer
// Requirements: 8.3, 8.4

import { CacheEntry, CACHE_TTL } from './tiktok-types'

// In-memory cache store
const cache = new Map<string, CacheEntry<unknown>>()

/**
 * Get cached data if it exists and is not expired
 */
export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined
  
  if (!entry) {
    return null
  }
  
  const now = Date.now()
  const isExpired = now > entry.timestamp + entry.ttl
  
  if (isExpired) {
    cache.delete(key)
    return null
  }
  
  return entry.data
}

/**
 * Set data in cache with TTL
 */
export function setInCache<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
  }
  cache.set(key, entry)
}

/**
 * Invalidate a specific cache entry
 */
export function invalidateCache(key: string): void {
  cache.delete(key)
}

/**
 * Invalidate all cache entries matching a prefix
 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * Check if cache entry exists and is valid
 */
export function isCacheValid(key: string): boolean {
  const entry = cache.get(key)
  
  if (!entry) {
    return false
  }
  
  const now = Date.now()
  return now <= entry.timestamp + entry.ttl
}

/**
 * Get cache entry metadata (for testing)
 */
export function getCacheMetadata(key: string): { timestamp: number; ttl: number } | null {
  const entry = cache.get(key)
  
  if (!entry) {
    return null
  }
  
  return {
    timestamp: entry.timestamp,
    ttl: entry.ttl,
  }
}

// Cache key generators
export const CACHE_KEYS = {
  metrics: (period: string) => `tiktok:metrics:${period}`,
  campaigns: (period: string) => `tiktok:campaigns:${period}`,
  dailySpend: (period: string) => `tiktok:daily:${period}`,
}
