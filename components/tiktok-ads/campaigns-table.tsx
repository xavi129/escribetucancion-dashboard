"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TikTokCampaign } from "@/lib/tiktok-types"
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/tiktok-utils"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

interface CampaignsTableProps {
  campaigns: TikTokCampaign[]
  loading: boolean
}

type SortField = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'conversions'
type SortDirection = 'asc' | 'desc'

export default function CampaignsTable({ campaigns, loading }: CampaignsTableProps) {
  const [sortField, setSortField] = useState<SortField>('spend')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    const modifier = sortDirection === 'asc' ? 1 : -1
    return (aValue - bValue) * modifier
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      'CAMPAIGN_STATUS_ENABLE': { color: 'bg-green-100 text-green-800', label: 'Activa' },
      'CAMPAIGN_STATUS_DISABLE': { color: 'bg-yellow-100 text-yellow-800', label: 'Pausada' },
      'CAMPAIGN_STATUS_DELETE': { color: 'bg-red-100 text-red-800', label: 'Eliminada' },
      'ACTIVE': { color: 'bg-green-100 text-green-800', label: 'Activa' },
      'PAUSED': { color: 'bg-yellow-100 text-yellow-800', label: 'Pausada' },
      'DELETED': { color: 'bg-red-100 text-red-800', label: 'Eliminada' },
    }
    const info = statusMap[status] || { color: 'bg-gray-100 text-gray-800', label: status }
    return <Badge className={info.color}>{info.label}</Badge>
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-1" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-gray-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campañas</CardTitle>
          <CardDescription>Rendimiento por campaña</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No hay campañas activas en este período
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campañas</CardTitle>
        <CardDescription>
          Rendimiento detallado por campaña ({campaigns.length} campañas)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('spend')}
              >
                <div className="flex items-center">
                  Gasto
                  <SortIcon field="spend" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('impressions')}
              >
                <div className="flex items-center">
                  Impresiones
                  <SortIcon field="impressions" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('clicks')}
              >
                <div className="flex items-center">
                  Clics
                  <SortIcon field="clicks" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('ctr')}
              >
                <div className="flex items-center">
                  CTR
                  <SortIcon field="ctr" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('conversions')}
              >
                <div className="flex items-center">
                  Conversiones
                  <SortIcon field="conversions" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCampaigns.map((campaign) => (
              <TableRow key={campaign.campaignId}>
                <TableCell className="font-medium max-w-[200px] truncate" title={campaign.campaignName}>
                  {campaign.campaignName}
                </TableCell>
                <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                <TableCell>{formatCurrency(campaign.spend)}</TableCell>
                <TableCell>{formatNumber(campaign.impressions)}</TableCell>
                <TableCell>{formatNumber(campaign.clicks)}</TableCell>
                <TableCell>{formatPercentage(campaign.ctr)}</TableCell>
                <TableCell>{formatNumber(campaign.conversions)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
