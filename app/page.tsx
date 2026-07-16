import type { Metadata } from "next"
import TransactionsTable from "@/components/transactions-table"

export const metadata: Metadata = {
  title: "Orders Management",
  description: "CRUD panel for managing song orders",
}

export default function Page() {
  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Orders Management</h1>
      </div>
      <TransactionsTable />
    </div>
  )
}
