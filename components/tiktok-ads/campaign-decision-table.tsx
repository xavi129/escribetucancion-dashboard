"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CampaignDecision, CampaignDecisionStatus } from "@/lib/tiktok-types"
import { formatCurrency, formatNumber } from "@/lib/tiktok-utils"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

interface CampaignDecisionTableProps {
  campaigns: CampaignDecision[]
  loading: boolean
}

type SortField = "spend" | "estimatedNetProfit" | "estimatedRoas" | "cpa" | "conversions"
type SortDirection = "asc" | "desc"

const decisionStyles: Record<CampaignDecisionStatus, string> = {
  scale: "bg-green-100 text-green-800 hover:bg-green-100",
  maintain: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  review: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  pause: "bg-red-100 text-red-800 hover:bg-red-100",
}

export default function CampaignDecisionTable({ campaigns, loading }: CampaignDecisionTableProps) {
  const [sortField, setSortField] = useState<SortField>("estimatedNetProfit")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection(field === "estimatedNetProfit" ? "asc" : "desc")
    }
  }

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const modifier = sortDirection === "asc" ? 1 : -1
    return (a[sortField] - b[sortField]) * modifier
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />
    return sortDirection === "asc"
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-1" />
        </CardHeader>
        <CardContent>
          <div className="h-[320px] bg-gray-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Decision por campana</CardTitle>
          <CardDescription>Rentabilidad estimada por campana</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No hay campanas con gasto en este periodo.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision por campana</CardTitle>
        <CardDescription>
          Revenue y costos distribuidos por share de conversiones hasta tener atribucion por pedido.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Campana</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("spend")}>
                  <div className="flex items-center">
                    Gasto
                    <SortIcon field="spend" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("conversions")}>
                  <div className="flex items-center">
                    Conv.
                    <SortIcon field="conversions" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("cpa")}>
                  <div className="flex items-center">
                    CPA
                    <SortIcon field="cpa" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("estimatedRoas")}>
                  <div className="flex items-center">
                    ROAS est.
                    <SortIcon field="estimatedRoas" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("estimatedNetProfit")}>
                  <div className="flex items-center">
                    Utilidad est.
                    <SortIcon field="estimatedNetProfit" />
                  </div>
                </TableHead>
                <TableHead className="min-w-[260px]">Razon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCampaigns.map((campaign) => (
                <TableRow key={campaign.campaignId}>
                  <TableCell className="font-medium max-w-[260px] truncate" title={campaign.campaignName}>
                    {campaign.campaignName}
                  </TableCell>
                  <TableCell>
                    <Badge className={decisionStyles[campaign.decision]}>
                      {campaign.decisionLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(campaign.spend)}</TableCell>
                  <TableCell>{formatNumber(campaign.conversions)}</TableCell>
                  <TableCell>{campaign.conversions > 0 ? formatCurrency(campaign.cpa) : "-"}</TableCell>
                  <TableCell>{campaign.spend > 0 ? `${campaign.estimatedRoas.toFixed(2)}x` : "-"}</TableCell>
                  <TableCell className={campaign.estimatedNetProfit >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(campaign.estimatedNetProfit)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {campaign.decisionReason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
