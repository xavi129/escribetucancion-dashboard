"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

type DeleteConfirmationProps = {
  onConfirm: () => void
  onCancel: () => void
  itemName: string
}

export default function DeleteConfirmation({ onConfirm, onCancel, itemName }: DeleteConfirmationProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-red-100 p-2">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h4 className="text-lg font-medium">Are you sure you want to delete {itemName}?</h4>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. This will permanently delete the transaction and all associated data.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </div>
  )
}
