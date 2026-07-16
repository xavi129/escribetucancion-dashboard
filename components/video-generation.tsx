"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Video, Play, Download, ExternalLink, AlertCircle, CheckCircle, RefreshCw, Send } from "lucide-react"
import { type Order } from "@/lib/supabase"

interface VideoGenerationProps {
  order: Order
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

interface VideoStatusResponse {
  success: boolean
  taskId?: string
  status?: string
  videoUrl?: string
  videoInfo?: {
    taskId: string
    musicId: string
    successFlag: string
    createTime: string
    completeTime: string
    errorCode: number
    errorMessage: string
  }
  error?: string
}

export default function VideoGeneration({ order, isOpen, onClose, onRefresh }: VideoGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [videoStatus, setVideoStatus] = useState<VideoStatusResponse | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setError(null)
      setSuccessMessage(null)
      setVideoStatus(null)
    }
  }, [isOpen])

  const handleGenerateVideo = async () => {
    try {
      setIsGenerating(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccessMessage(`✅ Video en generación. Task ID: ${data.taskId}. El proceso toma 2-5 minutos.`)
        if (onRefresh) onRefresh()
      } else {
        setError(data.error || data.details || 'Error al generar video')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('Error generating video:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCheckStatus = async () => {
    try {
      setIsCheckingStatus(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch('/api/video/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })

      const data: VideoStatusResponse = await response.json()
      setVideoStatus(data)

      if (data.success && (data.status === 'SUCCESS' || data.status === 'success') && data.videoUrl) {
        setSuccessMessage('✅ Video encontrado y listo para enviar')
        if (onRefresh) onRefresh()
      } else if (data.status === 'PENDING' || data.status === 'pending') {
        setSuccessMessage('⏳ Video aún en proceso de generación...')
      } else if (data.status === 'CREATE_TASK_FAILED' || data.status === 'GENERATE_MP4_FAILED') {
        setError(`❌ Error en generación: ${data.status}`)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al verificar estado')
      console.error('Error checking status:', err)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleSendWhatsApp = async (videoUrl?: string) => {
    try {
      setIsSendingWhatsApp(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch('/api/video/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: order.id,
          videoUrl: videoUrl || videoStatus?.videoUrl || order.video_url
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccessMessage(`✅ Video enviado por WhatsApp a ${data.sentTo}`)
        if (onRefresh) onRefresh()
      } else {
        setError(data.error || 'Error al enviar WhatsApp')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('Error sending WhatsApp:', err)
    } finally {
      setIsSendingWhatsApp(false)
    }
  }

  const getStatusBadge = (status?: string) => {
    const normalizedStatus = status?.toUpperCase()
    switch (normalizedStatus) {
      case 'PENDING':
        return <Badge className="bg-yellow-500/20 text-yellow-200">⏳ Procesando</Badge>
      case 'SUCCESS':
        return <Badge className="bg-green-500/20 text-green-200">✅ Completado</Badge>
      case 'CREATE_TASK_FAILED':
      case 'GENERATE_MP4_FAILED':
        return <Badge className="bg-red-500/20 text-red-200">❌ Error</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-200">Desconocido</Badge>
    }
  }

  const canGenerateVideo = order.suno_task_id && order.suno_audio_id
  const hasVideoUrl = order.video_url || videoStatus?.videoUrl

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl glass-panel border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-400" />
            Generación de Video Musical
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <h3 className="font-medium mb-2">Información de la Orden</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400">Cliente:</span>
                <span className="ml-2">{order.customer_name}</span>
              </div>
              <div>
                <span className="text-gray-400">WhatsApp:</span>
                <span className="ml-2">{order.whatsapp || 'No disponible'}</span>
              </div>
              <div>
                <span className="text-gray-400">Task ID (Música):</span>
                <span className="ml-2 text-xs font-mono">{order.suno_task_id || 'No disponible'}</span>
              </div>
              <div>
                <span className="text-gray-400">Audio ID:</span>
                <span className="ml-2 text-xs font-mono">{order.suno_audio_id || 'No disponible'}</span>
              </div>
              {order.video_task_id && (
                <div className="col-span-2">
                  <span className="text-gray-400">Task ID (Video):</span>
                  <span className="ml-2 text-xs font-mono">{order.video_task_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Requirements Check */}
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <h4 className="font-medium mb-2">Requisitos</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                {order.suno_task_id ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                )}
                <span>Suno Task ID</span>
              </div>
              <div className="flex items-center gap-2">
                {order.suno_audio_id ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                )}
                <span>Suno Audio ID</span>
              </div>
            </div>
          </div>

          {/* Video Status from API */}
          {videoStatus && (
            <div className="bg-white/5 p-4 rounded-lg border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Estado del Video (KIE.ai)</h4>
                {getStatusBadge(videoStatus.status)}
              </div>
              {videoStatus.videoUrl && (
                <div className="mt-2">
                  <span className="text-gray-400 text-sm">URL del Video:</span>
                  <a 
                    href={videoStatus.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400 hover:text-blue-300 text-sm underline flex items-center gap-1 inline-flex"
                  >
                    Ver video <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {videoStatus.videoInfo?.errorMessage && (
                <p className="text-red-400 text-sm mt-2">{videoStatus.videoInfo.errorMessage}</p>
              )}
            </div>
          )}

          {/* Current Video URL */}
          {order.video_url && (
            <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20">
              <h4 className="font-medium mb-2 text-green-200 flex items-center gap-2">
                <Video className="h-4 w-4" />
                Video Guardado
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <a 
                  href={order.video_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm underline flex items-center gap-1"
                >
                  Ver video <ExternalLink className="h-3 w-3" />
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(order.video_url!, '_blank')}
                  className="border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Reproducir
                </Button>
              </div>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}
          {successMessage && (
            <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
              <p className="text-green-200 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
            {/* Generate Video Button */}
            {canGenerateVideo && !order.video_url && (
              <Button
                onClick={handleGenerateVideo}
                disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Generar Video
                  </>
                )}
              </Button>
            )}

            {/* Check Status Button */}
            {order.suno_task_id && (
              <Button
                onClick={handleCheckStatus}
                disabled={isCheckingStatus}
                variant="outline"
                className="border-white/10 bg-white/5 hover:bg-white/10"
              >
                {isCheckingStatus ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Verificar Estado
                  </>
                )}
              </Button>
            )}

            {/* Send WhatsApp Button */}
            {hasVideoUrl && order.whatsapp && (
              <Button
                onClick={() => handleSendWhatsApp()}
                disabled={isSendingWhatsApp}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSendingWhatsApp ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar por WhatsApp
                  </>
                )}
              </Button>
            )}

            {/* Close Button */}
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-white/5 hover:bg-white/10 ml-auto"
            >
              Cerrar
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>• <strong>Generar Video:</strong> Inicia la generación del video (2-5 minutos)</p>
            <p>• <strong>Verificar Estado:</strong> Consulta el estado en KIE.ai y recupera el video si está listo</p>
            <p>• <strong>Enviar por WhatsApp:</strong> Envía el link del video al cliente manualmente</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}