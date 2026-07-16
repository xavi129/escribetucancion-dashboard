import type { Order } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type TransactionDetailsProps = {
  transaction: Order
}

export default function TransactionDetails({ transaction }: TransactionDetailsProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      new: { color: "bg-blue-100 text-blue-800", label: "New" },
      in_progress: { color: "bg-yellow-100 text-yellow-800", label: "In Progress" },
      completed: { color: "bg-green-100 text-green-800", label: "Completed" },
      cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled" },
    }

    const statusInfo = statusMap[status] || { color: "bg-gray-100 text-gray-800", label: status }

    return <Badge className={`${statusInfo.color}`}>{statusInfo.label}</Badge>
  }

  const getPaymentStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      paid: { color: "bg-green-100 text-green-800", label: "Paid" },
      refunded: { color: "bg-red-100 text-red-800", label: "Refunded" },
    }

    const statusInfo = statusMap[status] || { color: "bg-gray-100 text-gray-800", label: status }

    return <Badge className={`${statusInfo.color}`}>{statusInfo.label}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Details about the customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm font-medium">Customer Name:</div>
              <div>{transaction.customer_name || "N/A"}</div>

              <div className="text-sm font-medium">Email:</div>
              <div>{transaction.email || "N/A"}</div>

              <div className="text-sm font-medium">WhatsApp:</div>
              <div>{transaction.whatsapp || "N/A"}</div>

              <div className="text-sm font-medium">Country:</div>
              <div>{transaction.country || "N/A"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>Basic order information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm font-medium">Transaction ID:</div>
              <div>{transaction.transaction_id || "N/A"}</div>

              <div className="text-sm font-medium">Status:</div>
              <div>{getStatusBadge(transaction.status)}</div>

              <div className="text-sm font-medium">Created:</div>
              <div>{formatDate(transaction.created_at)}</div>

              <div className="text-sm font-medium">Updated:</div>
              <div>{formatDate(transaction.updated_at)}</div>

              <div className="text-sm font-medium">Completed:</div>
              <div>{formatDate(transaction.completed_at)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Song Details</CardTitle>
          <CardDescription>Information about the requested song</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Song Type:</div>
              <div>{transaction.song_type || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Purpose:</div>
              <div>{transaction.purpose || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Occasion:</div>
              <div>{transaction.occasion || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Genre:</div>
              <div>{transaction.genre || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Voice Gender:</div>
              <div>{transaction.voice_gender || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Styles:</div>
              <div>{transaction.styles || "N/A"}</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Include Name:</div>
            <div>{transaction.include_name ? "Yes" : "No"}</div>
          </div>

          {transaction.include_name && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Person's Name:</div>
                <div>{transaction.person_name || "N/A"}</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Relationship:</div>
                <div>{transaction.relationship || "N/A"}</div>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Song References:</div>
            <div className="whitespace-pre-wrap">{transaction.song_references || "N/A"}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Additional Details:</div>
            <div className="whitespace-pre-wrap">{transaction.details || "N/A"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
          <CardDescription>Details about payment and delivery</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Delivery Type:</div>
              <div className="flex items-center gap-2">
                {transaction.delivery_type || "N/A"}
                {transaction.delivery_type === "express" && <Badge className="bg-red-100 text-red-800">Priority</Badge>}
              </div>
              
              <div className="text-sm font-medium">Spotify Upload:</div>
              <div className="flex items-center gap-2">
                {transaction.spotify_upload ? "Sí" : "No"}
                {transaction.spotify_upload && <Badge className="bg-green-100 text-green-800">Spotify</Badge>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Payment Method:</div>
              <div>{transaction.payment_method || "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Base Price:</div>
              <div>{transaction.base_price !== null ? `$${transaction.base_price.toFixed(2)}` : "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Delivery Extra:</div>
              <div>{transaction.delivery_extra !== null ? `$${transaction.delivery_extra.toFixed(2)}` : "N/A"}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Total Price:</div>
              <div className="font-bold">
                {transaction.total_price !== null ? `$${transaction.total_price.toFixed(2)}` : "N/A"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Payment Status:</div>
              <div>{getPaymentStatusBadge(transaction.payment_status)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
