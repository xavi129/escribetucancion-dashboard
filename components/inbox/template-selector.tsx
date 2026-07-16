'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FileText, Send, Loader2 } from 'lucide-react'
import { getCategoryLabel } from '@/lib/template-service'

interface Template {
  id: string
  name: string
  category: string
  content: string
  variables: string[]
}

interface TemplateCategory {
  name: string
  templates: Template[]
}

interface TemplateSelectorProps {
  onSelectTemplate: (templateName: string) => Promise<void>
  disabled?: boolean
  context?: {
    customerName?: string
    totalPrice?: number
    playUrl?: string
  }
}

export default function TemplateSelector({
  onSelectTemplate,
  disabled,
  context,
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadTemplates()
    }
  }, [open])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/inbox/templates')
      const data = await response.json()
      if (data.success) {
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (templateName: string) => {
    setSending(templateName)
    try {
      await onSelectTemplate(templateName)
      setOpen(false)
    } finally {
      setSending(null)
    }
  }

  const previewContent = (template: Template) => {
    let content = template.content
    template.variables.forEach((varName, index) => {
      const placeholder = `{{${index + 1}}}`
      let value = ''
      switch (varName) {
        case 'customer_name':
          value = context?.customerName || '[Nombre]'
          break
        case 'total_price':
          value = context?.totalPrice?.toString() || '[Precio]'
          break
        case 'play_url':
          value = context?.playUrl || '[URL]'
          break
        case 'order_number':
          value = '[Número de pedido]'
          break
        default:
          value = `[${varName}]`
      }
      content = content.replace(placeholder, value)
    })
    return content
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="text-xs"
        >
          <FileText className="h-3 w-3 mr-1" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Seleccionar Template</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay templates disponibles
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category.name}>
                <h3 className="font-semibold text-sm mb-2">
                  {getCategoryLabel(category.name)}
                </h3>
                <div className="space-y-2">
                  {category.templates.map((template) => (
                    <div
                      key={template.id}
                      className="border border-white/10 rounded-lg p-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{template.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {previewContent(template)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSelect(template.name)}
                          disabled={sending === template.name}
                          className="shrink-0"
                        >
                          {sending === template.name ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
