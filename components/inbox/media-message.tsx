'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Image, FileAudio, FileText, Download, Loader2, Play } from 'lucide-react'

interface MediaMessageProps {
  type: 'image' | 'audio' | 'document'
  mediaId: string
  content: string // Caption or filename
}

export default function MediaMessage({ type, mediaId, content }: MediaMessageProps) {
  const [loading, setLoading] = useState(false)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadMedia = async () => {
    if (mediaUrl || loading) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/inbox/media?mediaId=${mediaId}`)
      const data = await response.json()
      
      if (data.success) {
        setMediaUrl(data.url)
      } else {
        setError(data.error || 'Error al cargar media')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    window.open(`/api/inbox/media?mediaId=${mediaId}&download=true`, '_blank')
  }

  // Image message
  if (type === 'image') {
    return (
      <div className="space-y-2">
        {mediaUrl ? (
          <img
            src={mediaUrl}
            alt={content || 'Imagen'}
            className="max-w-full rounded-lg max-h-64 object-contain"
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={loadMedia}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Image className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Cargando...' : 'Ver imagen'}
          </Button>
        )}
        {content && <p className="text-sm">{content}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  // Audio message
  if (type === 'audio') {
    return (
      <div className="space-y-2">
        {mediaUrl ? (
          <audio controls className="w-full max-w-xs">
            <source src={mediaUrl} />
            Tu navegador no soporta audio.
          </audio>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={loadMedia}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Cargando...' : 'Reproducir audio'}
          </Button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  // Document message
  if (type === 'document') {
    return (
      <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{content || 'Documento'}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return null
}
