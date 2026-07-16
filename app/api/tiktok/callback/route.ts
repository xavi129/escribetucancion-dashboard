import { NextRequest, NextResponse } from 'next/server'
import { initializeToken } from '@/lib/tiktok-auth'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const authCode = searchParams.get('auth_code') || searchParams.get('code')
  const state = searchParams.get('state')

  if (!authCode) {
    return NextResponse.redirect(new URL('/tiktok-ads?error=no_auth_code', request.url))
  }

  const appId = process.env.TIKTOK_APP_ID
  const appSecret = process.env.TIKTOK_APP_SECRET

  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL('/tiktok-ads?error=missing_credentials', request.url))
  }

  try {
    const tokenData = await initializeToken(authCode, appId, appSecret)

    if (!tokenData) {
      return NextResponse.redirect(new URL('/tiktok-ads?error=token_exchange_failed', request.url))
    }

    // Success - redirect to TikTok Ads page
    return NextResponse.redirect(new URL('/tiktok-ads?success=true', request.url))
  } catch (error) {
    console.error('TikTok OAuth callback error:', error)
    return NextResponse.redirect(new URL('/tiktok-ads?error=unknown', request.url))
  }
}
