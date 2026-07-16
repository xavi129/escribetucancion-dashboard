// TikTok OAuth Token Management
// Handles token refresh automatically

import { supabase } from './supabase'

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3'

interface TikTokTokenData {
  access_token: string
  refresh_token: string
  expires_at: number // Unix timestamp
  advertiser_ids: string[]
}

interface TikTokTokenResponse {
  code: number
  message: string
  data: {
    access_token: string
    refresh_token?: string
    refresh_token_expires_in?: number
    access_token_expires_in?: number
    advertiser_ids: string[]
  }
}

// Cache token in memory to avoid DB calls on every request
let cachedToken: TikTokTokenData | null = null

/**
 * Get stored token from Supabase
 */
async function getStoredToken(): Promise<TikTokTokenData | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'tiktok_token')
      .single()

    if (error || !data) {
      return null
    }

    return JSON.parse(data.value) as TikTokTokenData
  } catch {
    return null
  }
}

/**
 * Store token in Supabase
 */
async function storeToken(tokenData: TikTokTokenData): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'tiktok_token',
      value: JSON.stringify(tokenData),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'key'
    })

  if (error) {
    console.error('Error storing TikTok token:', error)
  }

  // Update cache
  cachedToken = tokenData
}

/**
 * Refresh the access token using refresh_token
 */
async function refreshAccessToken(refreshToken: string): Promise<TikTokTokenData | null> {
  const appId = process.env.TIKTOK_APP_ID
  const appSecret = process.env.TIKTOK_APP_SECRET

  if (!appId || !appSecret) {
    console.error('TikTok App ID or Secret not configured')
    return null
  }

  try {
    const response = await fetch(`${TIKTOK_API_BASE}/oauth2/refresh_token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        refresh_token: refreshToken,
      }),
    })

    const data: TikTokTokenResponse = await response.json()

    if (data.code !== 0) {
      console.error('TikTok token refresh failed:', data.message)
      return null
    }

    const tokenData: TikTokTokenData = {
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token || refreshToken,
      expires_at: Date.now() + (data.data.access_token_expires_in || 86400) * 1000,
      advertiser_ids: data.data.advertiser_ids,
    }

    await storeToken(tokenData)
    return tokenData
  } catch (error) {
    console.error('Error refreshing TikTok token:', error)
    return null
  }
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string | null> {
  // First check environment variable (for initial setup)
  const envToken = process.env.TIKTOK_ACCESS_TOKEN
  
  // Try to get stored token
  let tokenData = cachedToken || await getStoredToken()

  // If no stored token but env token exists, use env token
  if (!tokenData && envToken) {
    return envToken
  }

  if (!tokenData) {
    return null
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired = Date.now() > tokenData.expires_at - 5 * 60 * 1000

  if (isExpired && tokenData.refresh_token) {
    console.log('TikTok token expired, refreshing...')
    const newToken = await refreshAccessToken(tokenData.refresh_token)
    if (newToken) {
      return newToken.access_token
    }
    // If refresh failed, try env token as fallback
    return envToken || null
  }

  return tokenData.access_token
}

/**
 * Initialize token storage from OAuth callback
 */
export async function initializeToken(
  authCode: string,
  appId: string,
  appSecret: string
): Promise<TikTokTokenData | null> {
  try {
    const response = await fetch(`${TIKTOK_API_BASE}/oauth2/access_token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        auth_code: authCode,
      }),
    })

    const data: TikTokTokenResponse = await response.json()

    if (data.code !== 0) {
      console.error('TikTok token exchange failed:', data.message)
      return null
    }

    const tokenData: TikTokTokenData = {
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token || '',
      expires_at: Date.now() + (data.data.access_token_expires_in || 86400) * 1000,
      advertiser_ids: data.data.advertiser_ids,
    }

    await storeToken(tokenData)
    return tokenData
  } catch (error) {
    console.error('Error initializing TikTok token:', error)
    return null
  }
}

/**
 * Get the advertiser ID
 */
export async function getAdvertiserId(): Promise<string | null> {
  // First check environment variable
  const envAdvertiserId = process.env.TIKTOK_ADVERTISER_ID
  if (envAdvertiserId) {
    return envAdvertiserId
  }

  // Try to get from stored token
  const tokenData = cachedToken || await getStoredToken()
  if (tokenData && tokenData.advertiser_ids.length > 0) {
    return tokenData.advertiser_ids[0]
  }

  return null
}
