"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, RefreshCw, Pencil } from "lucide-react"
import type { Order } from "@/lib/supabase"
import SunoGenerationForm from "@/components/suno-generation-form"
import { useEffect, useState } from "react"

type SongGenerationWithLyricsProps = {
  order: Order | null
  lyrics: string | null
  isGeneratingLyrics: boolean
  onClose: () => void
  onRegenerateLyrics?: () => void
  onGenerateLyrics?: () => void
  onLyricsEdited?: (newLyrics: string) => void
  generatedStyle?: string | null
}

export default function SongGenerationWithLyrics({
  order,
  lyrics,
  isGeneratingLyrics,
  onClose,
  onRegenerateLyrics,
  onGenerateLyrics,
  onLyricsEdited,
  generatedStyle,
}: SongGenerationWithLyricsProps) {
  if (!order) return null

  const [suggestedStyle, setSuggestedStyle] = useState<string>("")
  const [isLoadingStyle, setIsLoadingStyle] = useState(false)
  const [styleError, setStyleError] = useState<string>("")
  const [modifications, setModifications] = useState<string>("")
  const [isEditingLyrics, setIsEditingLyrics] = useState(false)
  const [editError, setEditError] = useState<string>("")

  const handleEditLyrics = async () => {
    if (!modifications.trim() || !order) return

    setIsEditingLyrics(true)
    setEditError("")

    try {
      const response = await fetch("/api/orders/edit-lyric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          editInstructions: modifications,
          sendWhatsApp: false,
        }),
      })

      const data = await response.json()

      if (data.success && data.data?.lyric) {
        // Notify parent component about the edited lyrics
        if (onLyricsEdited) {
          onLyricsEdited(data.data.lyric)
        }
        setModifications("")
      } else {
        setEditError(data.message || "Error al editar la letra")
      }
    } catch (error) {
      setEditError("Error de conexión al editar la letra")
      console.error("Error editing lyrics:", error)
    } finally {
      setIsEditingLyrics(false)
    }
  }

  // Combinar estilos y referencias de canciones, evitando nombres de artistas
  const getCombinedStyle = () => {
    let combinedStyle = ""
    if (order.song_references && order.styles) {
      combinedStyle = `${order.styles}, ${order.song_references}`
    } else if (order.styles) {
      combinedStyle = order.styles
    } else if (order.song_references) {
      combinedStyle = order.song_references
    }
    
    // Asegurar que combinedStyle es un string antes de llamar replace
    if (typeof combinedStyle === 'string' && combinedStyle.trim()) {
      combinedStyle = combinedStyle
        .replace(/(por|de|interpretada por|interpretado por)\s+[^,;]+/gi, "")
        .replace(/\s+,/g, ",")
        .trim()
    }
    
    return combinedStyle
  }

  useEffect(() => {
    // Si ya hay un estilo generado guardado, usarlo directamente
    if (order.generated_style && order.generated_style.trim().length > 0) {
      setSuggestedStyle(order.generated_style)
      return
    }

    const combined = getCombinedStyle()
    if (lyrics && combined) {
      setIsLoadingStyle(true)
      setStyleError("")
      fetch("/api/gemini/generate-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          combinedStyle: combined,
          orderId: order.id,
          lyrics: lyrics,
          genre: order.genre,
          purpose: order.purpose,
          occasion: order.occasion,
          voice_gender: order.voice_gender,
        }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (data.success && data.style) {
            setSuggestedStyle(data.style)
          } else {
            setStyleError("No se pudo generar un estilo sugerido.")
          }
        })
        .catch(() => setStyleError("Error al conectar con Gemini."))
        .finally(() => setIsLoadingStyle(false))
    } else {
      setSuggestedStyle("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyrics, order.styles, order.song_references, order.generated_style])

  const getInitialSunoValues = () => {
    return {
      prompt: lyrics || "",
      style: suggestedStyle || getCombinedStyle(),
      title: `Canción para ${order.customer_name || "Cliente"}`,
      customMode: true,
      instrumental: false,
      model: "V4" as const,
      negativeTags: "",
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted p-4 rounded-md">
        <h3 className="text-lg font-medium mb-2">Información del Pedido</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="font-medium">Cliente:</div>
          <div>{order.customer_name || "N/A"}</div>

          <div className="font-medium">Tipo de Canción:</div>
          <div>{order.song_type || "Original"}</div>

          <div className="font-medium">Género:</div>
          <div>{order.genre || "No especificado"}</div>

          <div className="font-medium">Propósito:</div>
          <div>{order.purpose || "No especificado"}</div>

          {order.include_name && order.person_name && (
            <>
              <div className="font-medium">Incluir Nombre:</div>
              <div>
                {order.person_name} ({order.relationship || "No especificado"})
              </div>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium">Letra Generada</h3>
            <div className="flex gap-2">
              {!lyrics && !isGeneratingLyrics && onGenerateLyrics && (
                <Button variant="default" size="sm" onClick={onGenerateLyrics} className="flex items-center gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Generar Letra
                </Button>
              )}
              {lyrics && !isGeneratingLyrics && onRegenerateLyrics && (
                <Button variant="outline" size="sm" onClick={onRegenerateLyrics} className="flex items-center gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Regenerar Letra
                </Button>
              )}
            </div>
          </div>

          {isGeneratingLyrics ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Generando letra con IA...</span>
            </div>
          ) : lyrics ? (
            <>
              <div className="whitespace-pre-wrap bg-muted p-4 rounded-md max-h-60 overflow-y-auto">{lyrics}</div>
              {(order.styles || order.song_references) && (
                <div className="mt-3 p-3 bg-muted rounded-md border border-primary/20">
                  <div className="font-medium text-sm mb-1">Estilo Musical Sugerido:</div>
                  <div className="text-sm">
                    {isLoadingStyle ? (
                      <span className="text-muted-foreground">Generando estilo sugerido...</span>
                    ) : styleError ? (
                      <span className="text-destructive">{styleError}</span>
                    ) : suggestedStyle ? (
                      suggestedStyle
                    ) : (
                      <span className="text-muted-foreground">No especificado</span>
                    )}
                  </div>
                </div>
              )}
              {/* Campo para modificaciones */}
              <div className="mt-4 p-3 bg-muted/50 rounded-md border border-border">
                <div className="font-medium text-sm mb-2">Modificaciones a la Letra:</div>
                <Textarea
                  placeholder="Escribe aquí las modificaciones que deseas hacer a la letra... Ej: 'Cambiar el nombre María por Ana', 'Hacer el coro más emotivo', 'Agregar una estrofa sobre nuestro viaje a París'"
                  value={modifications}
                  onChange={(e) => setModifications(e.target.value)}
                  className="min-h-[80px] bg-background"
                  disabled={isEditingLyrics}
                />
                {editError && (
                  <p className="text-sm text-destructive mt-2">{editError}</p>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleEditLyrics}
                  disabled={!modifications.trim() || isEditingLyrics}
                  className="mt-2 flex items-center gap-1"
                >
                  {isEditingLyrics ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Aplicando cambios...
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4" />
                      Aplicar Modificaciones
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No se ha generado letra aún.</div>
          )}
        </CardContent>
      </Card>

      {lyrics && !isGeneratingLyrics && (
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-4">Generar Música con Suno AI</h3>
          <p className="text-sm text-muted-foreground mb-4">
            La letra generada ha sido añadida al campo de prompt. Puedes editarla o ajustar otras configuraciones antes
            de generar la música.
          </p>
          <SunoGenerationForm onClose={onClose} initialValues={getInitialSunoValues()} orderId={order.id} />
        </div>
      )}
    </div>
  )
}
