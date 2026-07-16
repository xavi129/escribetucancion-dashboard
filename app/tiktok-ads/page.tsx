import type { Metadata } from "next"
import TikTokAdsView from "@/components/tiktok-ads/tiktok-ads-view"

export const metadata: Metadata = {
  title: "TikTok Ads - Dashboard",
  description: "Métricas y análisis de publicidad en TikTok",
}

export default function TikTokAdsPage() {
  return (
    <div className="container mx-auto py-10">
      <TikTokAdsView />
    </div>
  )
}
