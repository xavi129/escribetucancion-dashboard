"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Loader2, MoreHorizontal, Music, Plus, Search, MessageSquare, Mail, Send, Video, Scissors } from "lucide-react"
import { supabase, type Order } from "@/lib/supabase"
import { formatPhoneNumber } from "@/lib/phone-utils"
import TransactionForm from "@/components/transaction-form"
import TransactionDetails from "@/components/transaction-details"
import DeleteConfirmation from "@/components/delete-confirmation"
import SongGenerationWithLyrics from "@/components/song-generation-with-lyrics"
import VideoGeneration from "@/components/video-generation"

export default function TransactionsTable() {
  const [transactions, setTransactions] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [editingTransaction, setEditingTransaction] = useState<Order | null>(null)
  const [viewingTransaction, setViewingTransaction] = useState<Order | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<Order | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSunoFormOpen, setIsSunoFormOpen] = useState(false)
  const [selectedOrderForSuno, setSelectedOrderForSuno] = useState<Order | null>(null)
  const [generatingLyrics, setGeneratingLyrics] = useState(false)
  const [generatedLyrics, setGeneratedLyrics] = useState<string | null>(null)
  const [isManualUrlModalOpen, setIsManualUrlModalOpen] = useState(false)
  const [selectedOrderForManualUrl, setSelectedOrderForManualUrl] = useState<Order | null>(null)
  const [manualSongUrl, setManualSongUrl] = useState("")
  const [isSubmittingManualUrl, setIsSubmittingManualUrl] = useState(false)
  const [isSendingToLeads, setIsSendingToLeads] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("file")
  const [updatingAutoResponderId, setUpdatingAutoResponderId] = useState<string | null>(null)
  
  // Estados para modal de Spotify Link
  const [isSpotifyLinkModalOpen, setIsSpotifyLinkModalOpen] = useState(false)
  const [selectedOrderForSpotifyLink, setSelectedOrderForSpotifyLink] = useState<Order | null>(null)
  const [hyperfollowUrl, setHyperfollowUrl] = useState("")
  const [isSubmittingSpotifyLink, setIsSubmittingSpotifyLink] = useState(false)
  
  // Estados para modal de Marketing
  const [isMarketingModalOpen, setIsMarketingModalOpen] = useState(false)
  const [selectedOrderForMarketing, setSelectedOrderForMarketing] = useState<Order | null>(null)
  const [marketingParam1, setMarketingParam1] = useState("")
  const [marketingParam2, setMarketingParam2] = useState("")
  const [isSendingMarketing, setIsSendingMarketing] = useState(false)

  // Estados para modal de Video Generation
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [selectedOrderForVideo, setSelectedOrderForVideo] = useState<Order | null>(null)
  
  // Estados para generación de video
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null)

  const pageSize = 10

  const fetchTransactions = async () => {
    setLoading(true)

    try {
      // Construir la query base con filtros
      let countQuery = supabase.from("orders").select("*", { count: "exact", head: true })
      let dataQuery = supabase.from("orders").select("*")

      if (searchTerm) {
        const searchFilter = `customer_name.ilike.%${searchTerm}%,whatsapp.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        countQuery = countQuery.or(searchFilter)
        dataQuery = dataQuery.or(searchFilter)
      }

      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "lead_or_early_lead") {
          countQuery = countQuery.in("status", ["lead", "early_lead"])
          dataQuery = dataQuery.in("status", ["lead", "early_lead"])
        } else {
          countQuery = countQuery.eq("status", statusFilter)
          dataQuery = dataQuery.eq("status", statusFilter)
        }
      }

      // Obtener el count total (sin paginación)
      const { count, error: countError } = await countQuery

      if (countError) throw countError
      setTotalCount(count || 0)

      // Obtener los datos con paginación
      const { data, error } = await dataQuery
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

      if (error) throw error

      setTransactions(data as Order[])
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [currentPage, searchTerm, statusFilter])

  const handleEdit = (transaction: Order) => {
    setEditingTransaction(transaction)
    setIsFormOpen(true)
  }

  const handleView = (transaction: Order) => {
    setViewingTransaction(transaction)
    setIsViewOpen(true)
  }

  const handleDelete = (transaction: Order) => {
    setDeletingTransaction(transaction)
    setIsDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return

    try {
      const { error } = await supabase.from("orders").delete().eq("id", deletingTransaction.id)

      if (error) throw error

      fetchTransactions()
      setIsDeleteOpen(false)
      setDeletingTransaction(null)
    } catch (error) {
      console.error("Error deleting transaction:", error)
    }
  }

  const handleFormClose = (refreshData = false) => {
    setIsFormOpen(false)
    setEditingTransaction(null)
    if (refreshData) fetchTransactions()
  }

  const handleSunoFormClose = () => {
    setIsSunoFormOpen(false)
    setSelectedOrderForSuno(null)
    setGeneratedLyrics(null)
  }

  const generateLyrics = async (transaction: Order) => {
    setGeneratingLyrics(true)
    setGeneratedLyrics(null)

    try {
      // Construir un prompt para Gemini basado en los detalles de la orden
      const prompt = buildLyricsPrompt(transaction)

      // Añadir una solicitud para sugerir un estilo musical para Suno
      const enhancedPrompt = `${prompt}\n\nAdemás, sugiere un estilo musical específico para Suno AI que sea compatible con esta letra, sin mencionar nombres de artistas específicos. Formato: ESTILO MUSICAL: [tu sugerencia de estilo]`

      // Llamar a la API de Gemini para generar la letra
      const response = await fetch("/api/gemini/generate-lyrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: enhancedPrompt }),
      })

      // Primero verificar si la respuesta es exitosa
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Error from API (${response.status}):`, errorText)
        setGeneratedLyrics(
          `Error generando letras: ${response.status} ${response.statusText}. Por favor intenta de nuevo.`,
        )
        return
      }

      // Intentar analizar la respuesta como JSON
      let data
      try {
        data = await response.json()
      } catch (error) {
        console.error("Error parsing API response:", error)
        setGeneratedLyrics("Error al procesar la respuesta de la API. Por favor intenta de nuevo.")
        return
      }

      if (data.success) {
        // Procesar la respuesta para extraer la letra y el estilo sugerido
        let lyrics = data.lyrics
        let suggestedStyle = ""

        // Buscar la sugerencia de estilo musical en el formato "ESTILO MUSICAL: [sugerencia]"
        const styleMatch = lyrics.match(/ESTILO MUSICAL:\s*(.+)$/m)
        if (styleMatch && styleMatch[1]) {
          suggestedStyle = styleMatch[1].trim()
          // Eliminar la línea de estilo musical de la letra
          lyrics = lyrics.replace(/ESTILO MUSICAL:\s*.+$/m, "").trim()
        }

        // Actualizar el estado con la letra procesada
        setGeneratedLyrics(lyrics)

        // Guardar la letra generada en la base de datos
        try {
          const saveResponse = await fetch("/api/orders/save-lyric", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderId: transaction.id,
              lyric: lyrics,
            }),
          })

          const saveData = await saveResponse.json()
          if (!saveData.success) {
            console.error("Error saving lyric:", saveData.message)
          }
        } catch (saveError) {
          console.error("Error calling save-lyric API:", saveError)
        }

        // Si encontramos un estilo sugerido, actualizar el estilo en la orden seleccionada
        if (suggestedStyle && selectedOrderForSuno) {
          setSelectedOrderForSuno({
            ...selectedOrderForSuno,
            styles: suggestedStyle
          })
        }
      } else {
        console.error("Error generating lyrics:", data.message)
        setGeneratedLyrics(`Error generando letras: ${data.message || "Intenta de nuevo."}`)
      }
    } catch (error) {
      console.error("Error calling Gemini API:", error)
      setGeneratedLyrics("Error al conectar con la API. Por favor verifica tu conexión e intenta de nuevo.")
    } finally {
      setGeneratingLyrics(false)
    }
  }

  const handleGenerateSong = async (transaction: Order) => {
    setSelectedOrderForSuno(transaction)
    setIsSunoFormOpen(true)

    // Si ya tiene letra generada, cargarla directamente
    if (transaction.generated_lyric) {
      console.log("Cargando letra existente desde la base de datos")
      setGeneratedLyrics(transaction.generated_lyric)
    } else {
      // Si no tiene letra, generarla
      console.log("No hay letra generada, generando nueva letra...")
      generateLyrics(transaction)
    }
  }

  // Función para extraer estilos musicales de referencias de canciones
  const extractStylesFromReferences = (references: string): string => {
    if (!references) return ""

    // Lista de palabras clave que indican estilos musicales
    const styleKeywords = [
      "rock", "pop", "balada", "ranchera", "regional", "urbano", "trap", "reggaeton",
      "salsa", "cumbia", "merengue", "bachata", "bolero", "mariachi", "norteño", "banda",
      "electrónica", "dance", "hip hop", "rap", "jazz", "blues", "folk", "country",
      "indie", "alternativo", "metal", "punk", "clásica", "romántica", "acústica"
    ]

    // Buscar palabras clave de estilo en las referencias
    const foundStyles = styleKeywords.filter(style =>
      references.toLowerCase().includes(style.toLowerCase())
    )

    // Si encontramos estilos específicos, los devolvemos
    if (foundStyles.length > 0) {
      return foundStyles.join(", ")
    }

    // Si no encontramos estilos específicos, extraemos características generales
    // sin mencionar nombres de artistas
    return "similar a las referencias proporcionadas en cuanto a estructura y sentimiento"
  }

  // Función para construir un prompt detallado para Gemini
  const buildLyricsPrompt = (transaction: Order): string => {
    let prompt = `Escribe letras para una canción ${transaction.song_type || "original"}`

    if (transaction.genre) {
      prompt += ` en el género ${transaction.genre}`
    }

    if (transaction.purpose) {
      prompt += ` para ${transaction.purpose}`
    }

    if (transaction.occasion) {
      prompt += ` para una ocasión de ${transaction.occasion}`
    }

    prompt += ".\n\n"

    if (transaction.include_name && transaction.person_name) {
      prompt += `Incluye el nombre "${transaction.person_name}" en la letra.`

      if (transaction.relationship) {
        prompt += ` Esta canción es para ${transaction.relationship}.`
      }

      prompt += "\n\n"
    }

    // Filtrar detalles para no incluir información de precios
    if (transaction.details) {
      // Eliminar cualquier mención a precios o pagos en los detalles
      const filteredDetails = transaction.details
        .replace(/\b\d+(\.\d+)?\s*(pesos|dólares|euros|USD|MXN|EUR)\b/gi, "[detalles personales]")
        .replace(/\b(precio|costo|pago|tarifa)\b/gi, "[detalles personales]")

      prompt += `Detalles adicionales: ${filteredDetails}\n\n`
    }

    // Procesar referencias de canciones para extraer estilos sin mencionar artistas específicos
    let combinedStyles = ""

    if (transaction.song_references) {
      const extractedStyles = extractStylesFromReferences(transaction.song_references)
      combinedStyles += extractedStyles

      // Añadir información sobre las referencias sin mencionar nombres específicos
      prompt += `Inspiración musical: Canción con elementos de ${extractedStyles}\n\n`
    }

    // Añadir estilos específicos mencionados por el cliente
    if (transaction.styles) {
      if (combinedStyles) {
        combinedStyles += ", " + transaction.styles
      } else {
        combinedStyles = transaction.styles
      }
      prompt += `Preferencias de estilo: ${transaction.styles}\n\n`
    }

    // Añadir los estilos combinados para Suno
    if (combinedStyles) {
      prompt += `Estilo musical para la producción: ${combinedStyles}\n\n`
    }

    prompt +=
      "La letra debe ser emocional, significativa y adecuada para una grabación profesional. IMPORTANTE: La letra DEBE estar en español y NO debe incluir ninguna referencia a precios, pagos o información financiera."

    return prompt
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  // Función para generar los números de página a mostrar
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 10 // Máximo de números visibles
    const sidePages = 3 // Páginas a cada lado de la actual

    if (totalPages <= maxVisible) {
      // Si hay pocas páginas, mostrar todas
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    // Siempre mostrar primera página
    pages.push(1)

    // Calcular el rango de páginas alrededor de la actual
    let start = Math.max(2, currentPage - sidePages)
    let end = Math.min(totalPages - 1, currentPage + sidePages)

    // Ajustar el rango si estamos cerca del inicio o del final
    if (currentPage <= sidePages + 2) {
      end = Math.min(maxVisible - 1, totalPages - 1)
    } else if (currentPage >= totalPages - sidePages - 1) {
      start = Math.max(2, totalPages - maxVisible + 2)
    }

    // Agregar puntos suspensivos después de la primera página si hay un salto
    if (start > 2) {
      pages.push("...")
    }

    // Agregar páginas del rango calculado
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    // Agregar puntos suspensivos antes de la última página si hay un salto
    if (end < totalPages - 1) {
      pages.push("...")
    }

    // Siempre mostrar última página
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      new: { color: "bg-blue-100 text-blue-800", label: "New" },
      in_progress: { color: "bg-yellow-100 text-yellow-800", label: "In Progress" },
      completed: { color: "bg-green-100 text-green-800", label: "Completed" },
      cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled" },
      lead: { color: "bg-purple-100 text-purple-800", label: "Lead" },
      early_lead: { color: "bg-indigo-100 text-indigo-800", label: "Early Lead" },
      contacted: { color: "bg-cyan-100 text-cyan-800", label: "Contacted" },
      upload_spotify: { color: "bg-green-500 text-white", label: "Upload Spotify" },
      confirmed: { color: "bg-emerald-100 text-emerald-800", label: "Confirmed" },
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

  const handleMarkAsCompleted = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status:", error)
    }
  }

  const handleMarkAsLead = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "lead",
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status to lead:", error)
    }
  }

  const handleMarkAsNew = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "new",
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status to new:", error)
    }
  }

  const handleMarkAsContacted = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "contacted", // Assuming 'contacted' is a valid status
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status to contacted:", error)
    }
  }

  const handleMarkAsInProgress = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "in_progress",
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status to in_progress:", error)
    }
  }

  const handleMarkAsError = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "error",
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status to error:", error)
    }
  }

  const handleToggleAutoResponder = async (transaction: Order, shouldEnable: boolean) => {
    setUpdatingAutoResponderId(transaction.id)

    try {
      const { error } = await supabase
        .from("orders")
        .update({ responder_auto: shouldEnable, updated_at: new Date().toISOString() })
        .eq("id", transaction.id)

      if (error) throw error

      setTransactions((prev) =>
        prev.map((order) => (order.id === transaction.id ? { ...order, responder_auto: shouldEnable } : order)),
      )
    } catch (error) {
      console.error("Error toggling responder_auto:", error)
      alert("Error al actualizar el estado de respuestas automáticas")
    } finally {
      setUpdatingAutoResponderId(null)
    }
  }

  const handleConfirmPayment = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()

      const hasSpotifyUpload = transaction.spotify_upload === true
      const hasVideo = transaction.video === true

      // Si tiene audio_url, procesar según los flags
      if (transaction.audio_url) {
        // Determinar el nuevo estado basado en los flags
        let newStatus: string
        let shouldGenerateVideo = false

        if (hasSpotifyUpload && hasVideo) {
          // Both flags: generate video and set status to upload_spotify
          newStatus = "upload_spotify"
          shouldGenerateVideo = true
        } else if (hasSpotifyUpload) {
          // Only spotify_upload: set status to upload_spotify
          newStatus = "upload_spotify"
        } else if (hasVideo) {
          // Only video: generate video, video webhook will update to completed when done
          newStatus = "generating_video"
          shouldGenerateVideo = true
        } else {
          // Neither flag: mark as completed
          newStatus = "completed"
        }

        // Primero actualizar el pago a confirmado con el estado correspondiente
        const updateData: Record<string, unknown> = {
          payment_status: "paid",
          status: newStatus,
          updated_at: now,
        }

        // Solo set completed_at si el estado es completed y no se generará video
        if (newStatus === "completed" && !shouldGenerateVideo) {
          updateData.completed_at = now
        }

        const { error: paymentError } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", transaction.id)

        if (paymentError) throw paymentError

        // Generar video si es necesario
        if (shouldGenerateVideo) {
          try {
            const videoResponse = await fetch("/api/video/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: transaction.id }),
            })

            if (videoResponse.ok) {
              console.log("Video generation initiated successfully")
            } else {
              const errorData = await videoResponse.json().catch(() => ({}))
              console.error("Error initiating video generation:", errorData)

              // Update order status to failed_video_generation
              await supabase
                .from("orders")
                .update({
                  status: "failed_video_generation",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", transaction.id)

              console.log("Order status updated to failed_video_generation")
            }
          } catch (videoError) {
            console.error("Exception initiating video generation:", videoError)

            // Update order status to failed_video_generation
            await supabase
              .from("orders")
              .update({
                status: "failed_video_generation",
                updated_at: new Date().toISOString(),
              })
              .eq("id", transaction.id)

            console.log("Order status updated to failed_video_generation due to exception")
          }
        }

        // Enviar canción por WhatsApp si tiene número
        if (transaction.whatsapp) {
          try {
            const response = await fetch("/api/whatsapp/send-song", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ orderId: transaction.id }),
            })

            const data = await response.json()

            if (data.success) {
              let message = "✅ Pago confirmado y canción enviada por WhatsApp"
              if (hasSpotifyUpload) {
                message += " (pendiente subir a Spotify)"
              }
              if (hasVideo) {
                message += " (generando video)"
              }
              alert(message)
            } else {
              alert(`⚠️ Pago confirmado pero error al enviar canción: ${data.message}`)
            }
          } catch (whatsappError) {
            console.error("Error al enviar canción por WhatsApp:", whatsappError)
            alert("⚠️ Pago confirmado pero error al enviar la canción por WhatsApp")
          }
        } else {
          let message = "✅ Pago confirmado"
          if (hasSpotifyUpload) {
            message += " (pendiente subir a Spotify)"
          }
          if (hasVideo) {
            message += " (generando video)"
          }
          alert(message)
        }
      } else {
        // Solo actualizar el pago sin marcar como completado (no tiene audio aún)
        const { error } = await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            updated_at: now,
          })
          .eq("id", transaction.id)

        if (error) throw error

        alert("✅ Pago confirmado")
      }

      fetchTransactions()
    } catch (error) {
      console.error("Error confirming payment:", error)
      alert("❌ Error al confirmar el pago")
    }
  }

  const handleSendWhatsAppMessage = async (transaction: Order) => {
    if (!transaction.whatsapp) {
      alert("Este cliente no tiene número de WhatsApp registrado")
      return
    }

    try {
      // Formatear el número de teléfono usando la utilidad internacional
      const phoneNumber = formatPhoneNumber(transaction.whatsapp)

      // Crear un mensaje personalizado
      const messageBody = `Hola ${transaction.customer_name || "cliente"}, ¡muchas gracias por tu solicitud!. Hemos recibido tu pedido y estamos emocionados de comenzar a crear tu canción personalizada. Por favor, confirma que todo es correcto.`
      console.log("phoneNumber formateado:", phoneNumber)
      // Llamar a la API para enviar el mensaje
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber, messageBody }),
      })

      const data = await response.json()

      if (data.success) {
        alert("Mensaje enviado correctamente")

        // Actualizar el estado a "contacted" si el mensaje se envió correctamente
        await handleMarkAsContacted(transaction)
      } else {
        alert(`Error al enviar mensaje: ${data.message}`)
      }
    } catch (error) {
      console.error("Error al enviar mensaje de WhatsApp:", error)
      alert("Error al enviar el mensaje de WhatsApp")
    }
  }

  const handleGenerateSongFromLyric = async (transaction: Order) => {
    // Verificar que tenga letra generada
    if (!transaction.generated_lyric || transaction.generated_lyric.trim() === "") {
      alert("❌ Esta orden no tiene letra generada. Por favor, genera la letra primero.")
      return
    }

    // Verificar si ya tiene canción (a menos que se quiera regenerar)
    if (transaction.audio_url) {
      const shouldRegenerate = confirm(
        "Esta orden ya tiene una canción generada. ¿Deseas regenerarla?\n\n" +
        "Cancela para usar la existente o Acepta para generar una nueva."
      )
      if (!shouldRegenerate) {
        return
      }
    }

    try {
      const response = await fetch("/api/orders/generate-song", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: transaction.id,
          forceRegenerate: !!transaction.audio_url,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(
          `✅ Generación de canción iniciada exitosamente!\n\n` +
          `La canción se generará en aproximadamente 2-5 minutos.\n` +
          `Recibirás una notificación cuando esté lista.\n\n` +
          `Task ID: ${data.data?.taskId || "N/A"}`
        )
        // Actualizar la tabla para reflejar el nuevo estado
        fetchTransactions()
      } else {
        alert(`❌ Error al iniciar la generación: ${data.error || data.message || "Error desconocido"}`)
      }
    } catch (error) {
      console.error("Error al generar canción:", error)
      alert(`❌ Error al generar canción: ${error instanceof Error ? error.message : "Error desconocido"}`)
    }
  }

  const handleSendSongWhatsApp = async (transaction: Order) => {
    if (!transaction.whatsapp) {
      alert("Este cliente no tiene número de WhatsApp registrado")
      return
    }

    if (!transaction.audio_url) {
      alert("No hay canción generada para este pedido")
      return
    }

    try {
      const response = await fetch("/api/whatsapp/send-song", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: transaction.id }),
      })

      const data = await response.json()

      if (data.success) {
        const previewMsg = data.isPreview ? " (vista previa de 70 segundos)" : ""
        alert(`Canción enviada correctamente${previewMsg}`)
      } else {
        alert(`Error al enviar canción: ${data.message}`)
      }
    } catch (error) {
      console.error("Error al enviar canción por WhatsApp:", error)
      alert("Error al enviar la canción por WhatsApp")
    }
  }

  const handleOpenManualUrlModal = (transaction: Order) => {
    setSelectedOrderForManualUrl(transaction)
    setManualSongUrl(transaction.audio_url || "")
    setSelectedFile(null)
    setUploadMethod("file")
    setIsManualUrlModalOpen(true)
  }

  const handleSubmitManualUrl = async () => {
    if (!selectedOrderForManualUrl) {
      alert("Error: No se seleccionó ninguna orden")
      return
    }

    // Validar según el método seleccionado
    if (uploadMethod === "file" && !selectedFile) {
      alert("Por favor selecciona un archivo para subir")
      return
    }

    if (uploadMethod === "url" && !manualSongUrl.trim()) {
      alert("Por favor ingresa una URL válida")
      return
    }

    if (!selectedOrderForManualUrl.whatsapp) {
      alert("Este cliente no tiene número de WhatsApp registrado")
      return
    }

    setIsSubmittingManualUrl(true)

    try {
      let finalUrl = manualSongUrl.trim()

      // Si se seleccionó un archivo, obtener presigned URL y subir directamente a R2
      if (uploadMethod === "file" && selectedFile) {
        // Paso 1: Obtener presigned URL del servidor
        const presignedResponse = await fetch("/api/upload/r2/presigned-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            orderId: selectedOrderForManualUrl.id,
          }),
        })

        const presignedData = await presignedResponse.json()

        if (!presignedData.success) {
          throw new Error(presignedData.message || "Error al generar presigned URL")
        }

        // Paso 2: Subir el archivo directamente a R2 usando la presigned URL
        // Esto evita pasar por Vercel, ahorrando bandwidth
        console.log("Iniciando subida a R2:", {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          objectKey: presignedData.objectKey,
        })

        try {
          // NO incluir Content-Type en los headers cuando usamos presigned URLs simples
          // La presigned URL no incluye headers en la firma, así que agregar headers puede causar 403
          // R2 detectará automáticamente el tipo de contenido
          const uploadResponse = await fetch(presignedData.presignedUrl, {
            method: "PUT",
            body: selectedFile,
            // No incluir headers - la presigned URL ya está firmada sin headers
          })

          console.log("Respuesta de R2:", {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            ok: uploadResponse.ok,
          })

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text()
            console.error("Error completo en upload a R2:", {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              errorText,
              headers: Object.fromEntries(uploadResponse.headers.entries()),
              presignedUrl: presignedData.presignedUrl.substring(0, 150),
            })

            // Mensajes de error más específicos
            if (uploadResponse.status === 403) {
              throw new Error(`403 Forbidden: Verifica que:\n1. El token R2 tenga permisos de escritura\n2. El bucket tenga CORS configurado\n3. Las credenciales sean correctas\n\nError: ${errorText.substring(0, 300)}`)
            }

            throw new Error(`Error al subir archivo a R2: ${uploadResponse.status} ${uploadResponse.statusText}\n${errorText.substring(0, 500)}`)
          }

          console.log("✅ Archivo subido exitosamente a R2:", presignedData.objectKey)
        } catch (fetchError) {
          console.error("❌ Error de red al subir archivo:", fetchError)
          // Si es un error de CORS o red
          if (fetchError instanceof TypeError) {
            if (fetchError.message.includes("Failed to fetch")) {
              throw new Error("Error de CORS: El bucket R2 necesita tener CORS configurado.\n\nConsulta R2_CORS_CONFIG.md para instrucciones detalladas.")
            }
          }
          throw fetchError
        }

        // Usar la URL pública proporcionada por el servidor
        finalUrl = presignedData.publicUrl
      }

      // Guardar la URL en la base de datos y actualizar el status
      const now = new Date().toISOString()
      // Determinar el nuevo estado de la orden según el estado de pago
      // Si el pago está confirmado, marcar como completado, sino como pendiente de pago
      const newStatus = selectedOrderForManualUrl.payment_status === "paid" ? "completed" : "pending_payment"
      const completedAt = selectedOrderForManualUrl.payment_status === "paid" ? now : null

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          audio_url: finalUrl,
          status: newStatus,
          updated_at: now,
          completed_at: completedAt,
        })
        .eq("id", selectedOrderForManualUrl.id)

      if (updateError) {
        throw updateError
      }

      // Enviar por WhatsApp
      const response = await fetch("/api/whatsapp/send-song", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: selectedOrderForManualUrl.id }),
      })

      const data = await response.json()

      if (data.success) {
        const previewMsg = data.isPreview ? " (vista previa de 70 segundos)" : " (canción completa)"
        alert(`✅ ${uploadMethod === "file" ? "Archivo subido," : ""} URL guardada y canción enviada${previewMsg}`)
        setIsManualUrlModalOpen(false)
        setManualSongUrl("")
        setSelectedFile(null)
        setUploadMethod("file")
        setSelectedOrderForManualUrl(null)
        fetchTransactions() // Refrescar la tabla
      } else {
        alert(`Error al enviar canción: ${data.message}`)
      }
    } catch (error) {
      console.error("Error al procesar:", error)
      alert(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsSubmittingManualUrl(false)
    }
  }

  // Funciones para modal de Spotify Link
  const handleOpenSpotifyLinkModal = (transaction: Order) => {
    setSelectedOrderForSpotifyLink(transaction)
    setHyperfollowUrl(transaction.hyperfollow_url || "https://distrokid.com/hyperfollow/escribetucancioncom/")
    setIsSpotifyLinkModalOpen(true)
  }

  const handleSubmitSpotifyLink = async () => {
    if (!selectedOrderForSpotifyLink) {
      alert("Error: No se seleccionó ninguna orden")
      return
    }

    if (!hyperfollowUrl.trim()) {
      alert("Por favor ingresa el link de Hyperfollow")
      return
    }

    if (!selectedOrderForSpotifyLink.whatsapp) {
      alert("Este cliente no tiene número de WhatsApp registrado")
      return
    }

    setIsSubmittingSpotifyLink(true)

    try {
      const response = await fetch("/api/whatsapp/send-spotify-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: selectedOrderForSpotifyLink.id,
          hyperfollowUrl: hyperfollowUrl.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert("✅ Link de Spotify enviado correctamente y orden completada")
        setIsSpotifyLinkModalOpen(false)
        setHyperfollowUrl("")
        setSelectedOrderForSpotifyLink(null)
        fetchTransactions() // Refrescar la tabla
      } else {
        alert(`Error al enviar link de Spotify: ${data.message}`)
      }
    } catch (error) {
      console.error("Error al enviar link de Spotify:", error)
      alert(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsSubmittingSpotifyLink(false)
    }
  }

  const handleMarkAsUploadSpotify = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "upload_spotify",
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status to upload_spotify:", error)
    }
  }

  const handleMarkAsConfirmed = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "confirmed",
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status to confirmed:", error)
    }
  }

  const handleMarkAsCancelled = async (transaction: Order) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          updated_at: now,
        })
        .eq("id", transaction.id)

      if (error) throw error

      fetchTransactions()
    } catch (error) {
      console.error("Error updating order status to cancelled:", error)
    }
  }

  const handleSendEmailToLead = async (transaction: Order) => {
    if (!transaction.email) {
      alert("Este cliente no tiene correo electrónico registrado")
      return
    }

    try {
      // Usar siempre el número fijo de WhatsApp: 000000000000
      const whatsappNumber = "000000000000" // Número fijo sin el signo +
      const whatsappLink = `https://wa.me/${whatsappNumber}`

      // Crear el asunto y mensaje del correo
      const subject = "Tu canción personalizada - Escribe Tu Canción"
      const message = `
        <p>Hola ${transaction.customer_name || "cliente"},</p>
        <p>¡Muchas gracias por tu interés en nuestro servicio de canciones personalizadas!</p>
        <p>Hemos recibido tu solicitud y estamos emocionados de poder crear una canción única para ti.</p>
        <p><strong>Para continuar con el proceso, es necesario que nos contactes por WhatsApp al número 000000000000o haciendo clic en el botón de WhatsApp que encontrarás a continuación.</strong></p>
        <p>Si tienes alguna pregunta o deseas proporcionar más detalles sobre tu canción, también puedes responder a este correo a la dirección support@example.com, pero te recomendamos usar WhatsApp para una comunicación más rápida y efectiva.</p>
        <p>¡Esperamos crear algo especial para ti!</p>
        <p>Saludos cordiales,<br>El equipo de Escribe Tu Canción</p>
      `

      // Llamar a la API para enviar el correo
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: transaction.email,
          subject,
          message,
          whatsappLink
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert("Correo enviado correctamente")

        // Actualizar el estado a "contacted" si el correo se envió correctamente
        await handleMarkAsContacted(transaction)
      } else {
        alert(`Error al enviar correo: ${data.message || "Error desconocido"}`)
      }
    } catch (error) {
      console.error("Error al enviar correo electrónico:", error)
      alert("Error al enviar el correo electrónico")
    }
  }

  const handleSendToLeads = async (transaction: Order) => {
    setIsSendingToLeads(transaction.id)

    try {
      const response = await fetch("/api/whatsapp/send-to-leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ record: transaction }),
      })

      const data = await response.json()

      if (data.success) {
        alert("✅ Registro enviado a leads correctamente")

        // Actualizar el estado a "contacted" si el envío se completó correctamente
        await handleMarkAsContacted(transaction)
      } else {
        alert(`Error al enviar a leads: ${data.message || "Error desconocido"}`)
        
        // Actualizar el estado a "error" cuando hay error al enviar a leads
        await handleMarkAsError(transaction)
      }
    } catch (error) {
      console.error("Error al enviar a leads:", error)
      alert("Error al enviar el registro a leads")
      
      // Actualizar el estado a "error" cuando hay excepción al enviar a leads
      await handleMarkAsError(transaction)
    } finally {
      setIsSendingToLeads(null)
    }
  }

  const handleOpenMarketingModal = (transaction: Order) => {
    setSelectedOrderForMarketing(transaction)
    
    // Parámetro 1: Nombre del cliente
    const param1 = transaction.customer_name || ""
    
    // Parámetro 2: Primeros 4 dígitos del transaction_id
    let param2 = ""
    if (transaction.transaction_id) {
      // Extraer solo los números del transaction_id y tomar los primeros 4
      const numbersOnly = transaction.transaction_id.replace(/\D/g, "")
      param2 = numbersOnly.substring(0, 4)
    }
    
    setMarketingParam1(param1)
    setMarketingParam2(param2)
    setIsMarketingModalOpen(true)
  }

  const handleSendMarketing = async () => {
    if (!selectedOrderForMarketing) return

    if (!selectedOrderForMarketing.whatsapp) {
      alert("Este cliente no tiene número de WhatsApp registrado")
      return
    }

    setIsSendingMarketing(true)

    try {
      const response = await fetch("/api/whatsapp/send-marketing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: selectedOrderForMarketing.whatsapp,
          param1: marketingParam1.trim() || undefined,
          param2: marketingParam2.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert("✅ Plantilla de marketing enviada correctamente")
        setIsMarketingModalOpen(false)
        setSelectedOrderForMarketing(null)
        setMarketingParam1("")
        setMarketingParam2("")
      } else {
        alert(`❌ Error al enviar: ${data.message || data.error || "Error desconocido"}`)
      }
    } catch (error) {
      console.error("Error al enviar plantilla de marketing:", error)
      alert("❌ Error al enviar la plantilla de marketing")
    } finally {
      setIsSendingMarketing(false)
    }
  }

  const handleOpenVideoModal = (transaction: Order) => {
    setSelectedOrderForVideo(transaction)
    setIsVideoModalOpen(true)
  }

  const handleCloseVideoModal = () => {
    setIsVideoModalOpen(false)
    setSelectedOrderForVideo(null)
  }

  const handleGenerateVideo = async (transaction: Order) => {
    // Verificar que tenga audio_url
    if (!transaction.audio_url || transaction.audio_url.trim() === "") {
      alert("❌ Esta orden no tiene canción generada. Por favor, genera la canción primero.")
      return
    }

    // Verificar si ya tiene video generado
    if (transaction.video_url) {
      const shouldRegenerate = confirm(
        "Esta orden ya tiene un video generado. ¿Deseas regenerarlo?\n\n" +
        "Cancela para usar el existente o Acepta para generar uno nuevo."
      )
      if (!shouldRegenerate) {
        return
      }
    }

    // Intentar usar taskId y audioId guardados en la orden
    // Si no están disponibles, solicitarlos al usuario
    let taskId = transaction.suno_task_id
    let audioId = transaction.suno_audio_id

    if (!taskId || !audioId) {
      // Si no están guardados, solicitar al usuario
      // Esto puede pasar si la orden fue creada antes de implementar el guardado automático
      taskId = prompt("Ingresa el taskId de la generación de audio original:\n\n(Nota: En futuras generaciones, este valor se guardará automáticamente)")
      if (!taskId || taskId.trim() === "") {
        alert("❌ Se requiere el taskId para generar el video")
        return
      }

      audioId = prompt("Ingresa el audioId (ID del track) de la generación de audio original:\n\n(Nota: En futuras generaciones, este valor se guardará automáticamente)")
      if (!audioId || audioId.trim() === "") {
        alert("❌ Se requiere el audioId para generar el video")
        return
      }
    }

    setGeneratingVideo(transaction.id)

    try {
      const response = await fetch("/api/suno/generate-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: transaction.id,
          taskId: taskId.trim(),
          audioId: audioId.trim(),
          forceRegenerate: !!transaction.video_url,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(
          `✅ Generación de video iniciada exitosamente!\n\n` +
          `El video se generará en aproximadamente 5-10 minutos.\n` +
          `Recibirás una notificación cuando esté listo.\n\n` +
          `Task ID: ${data.data?.taskId || "N/A"}`
        )
        // Actualizar la tabla para reflejar el nuevo estado
        fetchTransactions()
      } else {
        alert(`❌ Error al iniciar la generación: ${data.error || data.message || "Error desconocido"}`)
      }
    } catch (error) {
      console.error("Error al generar video:", error)
      alert(`❌ Error al generar video: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setGeneratingVideo(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search transactions..."
              className="w-full pl-10 bg-white/5 border-white/10 focus:border-primary/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value)}>
            <SelectTrigger className="w-full sm:w-auto bg-white/5 border-white/10">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="early_lead">Early Lead</SelectItem>
              <SelectItem value="lead_or_early_lead">Lead + Early Lead</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="upload_spotify">Upload Spotify</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="plantilla">Plantilla</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              Add Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-panel border-white/10">
            <DialogHeader>
              <DialogTitle>{editingTransaction ? "Edit Order" : "Add New Order"}</DialogTitle>
            </DialogHeader>
            <TransactionForm transaction={editingTransaction} onClose={handleFormClose} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
        <CardHeader className="p-6 border-b border-white/5">
          <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Orders</CardTitle>
          <CardDescription className="text-gray-400">Manage your customer song orders</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-none border-0">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/5 hover:bg-white/5">
                  <TableHead className="text-gray-300">Transaction ID</TableHead>
                  <TableHead className="text-gray-300">Customer</TableHead>
                  <TableHead className="text-gray-300">WhatsApp</TableHead>
                  <TableHead className="text-gray-300">Auto Reply</TableHead>
                  <TableHead className="text-gray-300">Song Type</TableHead>
                  <TableHead className="text-gray-300">Total Price</TableHead>
                  <TableHead className="text-gray-300">Payment Status</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300">Created At</TableHead>
                  <TableHead className="w-[120px] text-gray-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction, index) => (
                    <TableRow key={transaction.id} className="border-white/5 hover:bg-white/5 transition-colors animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${Math.min(index * 50, 500)}ms`, animationFillMode: 'both' }}>
                      <TableCell className="font-medium">
                        {transaction.transaction_id || "-"}
                        {transaction.delivery_type === "express" && (
                          <Badge className="ml-2 bg-red-500/20 text-red-200 hover:bg-red-500/30 border-red-500/20">Priority</Badge>
                        )}
                        {transaction.spotify_upload && (
                          <Badge className="ml-2 bg-green-500/20 text-green-200 hover:bg-green-500/30 border-green-500/20">Spotify</Badge>
                        )}
                      </TableCell>
                      <TableCell>{transaction.customer_name || "-"}</TableCell>
                      <TableCell>{transaction.whatsapp || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={transaction.responder_auto ?? false}
                            onCheckedChange={(checked) => handleToggleAutoResponder(transaction, checked)}
                            disabled={updatingAutoResponderId === transaction.id}
                            aria-label="Toggle auto reply"
                          />
                          <span className="text-xs text-muted-foreground">
                            {transaction.responder_auto ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{transaction.song_type || "-"}</span>
                          {transaction.song_type?.toLowerCase().includes("estandar") && (
                            <Badge className="bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 border-blue-500/20">Estándar</Badge>
                          )}
                          {transaction.song_type?.toLowerCase().includes("premium") && (
                            <Badge className="bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 border-purple-500/20">Premium</Badge>
                          )}
                          {transaction.video && (
                            <Badge className="ml-2 bg-pink-500/20 text-pink-200 hover:bg-pink-500/30 border-pink-500/20 flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              Video
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{transaction.total_price ? `$${transaction.total_price.toFixed(2)}` : "-"}</TableCell>
                      <TableCell>{getPaymentStatusBadge(transaction.payment_status)}</TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell>{new Date(transaction.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleGenerateSong(transaction)}
                            title="Generate Song"
                            className="h-8 w-8"
                          >
                            <Music className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenVideoModal(transaction)}
                            title="Generate Video"
                            className="h-8 w-8"
                          >
                            <Video className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-panel border-white/10">
                              <DropdownMenuItem onClick={() => handleView(transaction)}>View details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(transaction)}>Edit</DropdownMenuItem>
                              {transaction.status !== "completed" && (
                                <DropdownMenuItem onClick={() => handleMarkAsCompleted(transaction)}>
                                  Mark as Completed
                                </DropdownMenuItem>
                              )}
                              {transaction.status !== "lead" && transaction.status !== "completed" && (
                                <DropdownMenuItem onClick={() => handleMarkAsLead(transaction)}>
                                  Mark as Lead
                                </DropdownMenuItem>
                              )}
                              {transaction.status === "lead" && (
                                <DropdownMenuItem onClick={() => handleMarkAsNew(transaction)}>
                                  Actualizar a New
                                </DropdownMenuItem>
                              )}
                              {transaction.status !== "contacted" && transaction.status !== "completed" && (
                                <DropdownMenuItem onClick={() => handleMarkAsContacted(transaction)}>
                                  Mark as Contacted
                                </DropdownMenuItem>
                              )}
                              {transaction.status !== "confirmed" && transaction.status !== "completed" && (
                                <DropdownMenuItem onClick={() => handleMarkAsConfirmed(transaction)}>
                                  Mark as Confirmed
                                </DropdownMenuItem>
                              )}
                              {transaction.status !== "cancelled" && transaction.status !== "completed" && (
                                <DropdownMenuItem onClick={() => handleMarkAsCancelled(transaction)}>
                                  <span className="text-red-400">Mark as Cancelled</span>
                                </DropdownMenuItem>
                              )}
                              {/* {transaction.status !== "in_progress" && transaction.status !== "completed" && (
                                <DropdownMenuItem onClick={() => handleMarkAsInProgress(transaction)}>
                                  Marcar en progreso
                                </DropdownMenuItem>
                              )} */}
                              {transaction.payment_status === "pending" && (
                                <DropdownMenuItem onClick={() => handleConfirmPayment(transaction)}>
                                  <span className="text-green-400">✓ Confirmar Pago</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleGenerateSong(transaction)}>
                                Generate Song (Formulario)
                              </DropdownMenuItem>
                              {transaction.generated_lyric && (
                                <DropdownMenuItem onClick={() => handleGenerateSongFromLyric(transaction)}>
                                  <Music className="h-4 w-4 mr-2" />
                                  Generar Canción desde Letra
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleOpenManualUrlModal(transaction)}>
                                <Music className="h-4 w-4 mr-2" />
                                Subir URL de Canción
                              </DropdownMenuItem>
                              {transaction.audio_url && (
                                <DropdownMenuItem onClick={() => handleSendSongWhatsApp(transaction)}>
                                  <Music className="h-4 w-4 mr-2" />
                                  {transaction.payment_status === "paid"
                                    ? "Enviar Canción Completa"
                                    : "Enviar Preview (70s)"}
                                </DropdownMenuItem>
                              )}
                              {transaction.audio_url && (
                                <DropdownMenuItem
                                  onClick={() => handleGenerateVideo(transaction)}
                                  disabled={generatingVideo === transaction.id}
                                >
                                  <Video className="h-4 w-4 mr-2" />
                                  {generatingVideo === transaction.id 
                                    ? "Generando Video..." 
                                    : transaction.video_url 
                                      ? "Regenerar Video" 
                                      : "Generar Video"}
                                </DropdownMenuItem>
                              )}
                              {transaction.video_url && (
                                <DropdownMenuItem onClick={() => transaction.video_url && window.open(transaction.video_url, "_blank")}>
                                  <Video className="h-4 w-4 mr-2 text-green-400" />
                                  Ver Video Generado
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleOpenVideoModal(transaction)}>
                                <Video className="h-4 w-4 mr-2 text-purple-400" />
                                Generar Video Musical
                              </DropdownMenuItem>
                              {/* Opciones para Spotify */}
                              {transaction.spotify_upload && transaction.status !== "completed" && (
                                <DropdownMenuItem onClick={() => handleMarkAsUploadSpotify(transaction)}>
                                  <Music className="h-4 w-4 mr-2" />
                                  Marcar como Upload Spotify
                                </DropdownMenuItem>
                              )}
                              {(transaction.status === "upload_spotify" || (transaction.spotify_upload && transaction.spotify_song_name)) && (
                                <DropdownMenuItem onClick={() => handleOpenSpotifyLinkModal(transaction)}>
                                  <Music className="h-4 w-4 mr-2 text-green-400" />
                                  Enviar Link Spotify y Completar
                                </DropdownMenuItem>
                              )}
                              {/* <DropdownMenuItem onClick={() => handleSendWhatsAppMessage(transaction)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Enviar WhatsApp confirmation
                              </DropdownMenuItem> */}
                              <DropdownMenuItem onClick={() => handleSendEmailToLead(transaction)}>
                                <Mail className="h-4 w-4 mr-2" />
                                Enviar Email con link WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleSendToLeads(transaction)}
                                disabled={isSendingToLeads === transaction.id}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                {isSendingToLeads === transaction.id ? "Enviando..." : "Enviar a Leads"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenMarketingModal(transaction)}>
                                <Send className="h-4 w-4 mr-2" />
                                Enviar Marketing
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(transaction)} className="text-red-400 focus:text-red-400">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage((prev) => Math.max(1, prev - 1))
                }}
                aria-disabled={currentPage === 1}
                tabIndex={currentPage === 1 ? -1 : undefined}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "hover:bg-white/10"}
              />
            </PaginationItem>
            {getPageNumbers().map((page, i) => {
              if (page === "...") {
                return (
                  <PaginationItem key={`ellipsis-${i}`}>
                    <span className="px-2 text-muted-foreground">...</span>
                  </PaginationItem>
                )
              }
              const pageNumber = page as number
              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setCurrentPage(pageNumber)
                    }}
                    isActive={currentPage === pageNumber}
                    className={currentPage === pageNumber ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-white/10"}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              )
            })}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }}
                aria-disabled={currentPage === totalPages}
                tabIndex={currentPage === totalPages ? -1 : undefined}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-white/10"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-panel border-white/10">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {viewingTransaction && <TransactionDetails transaction={viewingTransaction} />}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="glass-panel border-white/10">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <DeleteConfirmation
            itemName={deletingTransaction?.customer_name || "this order"}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setIsDeleteOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isSunoFormOpen} onOpenChange={handleSunoFormClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass-panel border-white/10">
          <DialogHeader>
            <DialogTitle>Generate Song with Lyrics</DialogTitle>
          </DialogHeader>
          {selectedOrderForSuno && (
            <SongGenerationWithLyrics
              order={selectedOrderForSuno}
              lyrics={generatedLyrics}
              isGeneratingLyrics={generatingLyrics}
              onClose={handleSunoFormClose}
              onRegenerateLyrics={() => generateLyrics(selectedOrderForSuno)}
              onGenerateLyrics={() => generateLyrics(selectedOrderForSuno)}
              onLyricsEdited={(newLyrics) => setGeneratedLyrics(newLyrics)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isManualUrlModalOpen} onOpenChange={setIsManualUrlModalOpen}>
        <DialogContent className="max-w-lg glass-panel border-white/10">
          <DialogHeader>
            <DialogTitle>Subir URL de Canción</DialogTitle>
          </DialogHeader>
          {selectedOrderForManualUrl && (
            <div className="space-y-4">
              <div className="bg-white/5 p-3 rounded-md border border-white/10">
                <p className="text-sm">
                  <span className="font-medium">Cliente:</span> {selectedOrderForManualUrl.customer_name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">WhatsApp:</span> {selectedOrderForManualUrl.whatsapp}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Estado de Pago:</span>{" "}
                  <span className={selectedOrderForManualUrl.payment_status === "paid" ? "text-green-400 font-medium" : "text-yellow-400 font-medium"}>
                    {selectedOrderForManualUrl.payment_status === "paid" ? "Pagado" : "Pendiente"}
                  </span>
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Método de Subida</label>
                  <Select value={uploadMethod} onValueChange={(value: "url" | "file") => setUploadMethod(value)} disabled={isSubmittingManualUrl}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="url">Ingresar URL</SelectItem>
                      <SelectItem value="file">Subir Archivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {uploadMethod === "url" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">URL de la Canción</label>
                    <Input
                      type="url"
                      placeholder="https://example.com/song.mp3"
                      value={manualSongUrl}
                      onChange={(e) => setManualSongUrl(e.target.value)}
                      disabled={isSubmittingManualUrl}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Archivo de Audio</label>
                    <Input
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.m4a,.mp4"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setSelectedFile(file)
                        if (file) {
                          // Opcional: mostrar el nombre del archivo
                          console.log("Archivo seleccionado:", file.name, file.size, "bytes")
                        }
                      }}
                      disabled={isSubmittingManualUrl}
                      className="bg-white/5 border-white/10"
                    />
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">
                        Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Formatos aceptados: MP3, WAV, OGG, M4A, MP4
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {selectedOrderForManualUrl.payment_status === "paid"
                    ? "✅ Se enviará el link de la canción completa"
                    : "⚠️ Se enviará el link de preview (70s segundos)"}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsManualUrlModalOpen(false)
                    setManualSongUrl("")
                    setSelectedFile(null)
                    setUploadMethod("file")
                    setSelectedOrderForManualUrl(null)
                  }}
                  disabled={isSubmittingManualUrl}
                  className="border-white/10 bg-white/5 hover:bg-white/10"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitManualUrl}
                  disabled={isSubmittingManualUrl || (uploadMethod === "url" && !manualSongUrl.trim()) || (uploadMethod === "file" && !selectedFile)}
                >
                  {isSubmittingManualUrl ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Music className="mr-2 h-4 w-4" />
                      Guardar y Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para enviar Link de Spotify/Hyperfollow */}
      <Dialog open={isSpotifyLinkModalOpen} onOpenChange={setIsSpotifyLinkModalOpen}>
        <DialogContent className="max-w-lg glass-panel border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-green-400" />
              Enviar Link de Spotify y Completar Orden
            </DialogTitle>
          </DialogHeader>
          {selectedOrderForSpotifyLink && (
            <div className="space-y-4">
              <div className="bg-white/5 p-3 rounded-md border border-white/10">
                <p className="text-sm">
                  <span className="font-medium">Cliente:</span> {selectedOrderForSpotifyLink.customer_name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">WhatsApp:</span> {selectedOrderForSpotifyLink.whatsapp}
                </p>
                {selectedOrderForSpotifyLink.spotify_song_name && (
                  <p className="text-sm">
                    <span className="font-medium">Nombre de Canción:</span>{" "}
                    <span className="text-green-400">{selectedOrderForSpotifyLink.spotify_song_name}</span>
                  </p>
                )}
              </div>

              <div className="bg-green-500/10 p-3 rounded-md border border-green-500/20">
                <p className="text-sm text-green-200">
                  🎧 Al enviar este link, se notificará al cliente que su canción ya está en proceso de publicación
                  en las plataformas de streaming y la orden se marcará como <strong>completada</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Link de Hyperfollow (DistroKid)</label>
                <Input
                  type="url"
                  placeholder="https://distrokid.com/hyperfollow/..."
                  value={hyperfollowUrl}
                  onChange={(e) => setHyperfollowUrl(e.target.value)}
                  disabled={isSubmittingSpotifyLink}
                  className="bg-white/5 border-white/10"
                />
                <p className="text-xs text-muted-foreground">
                  Este link permite al cliente preguardar su correo para ser notificado cuando la canción esté disponible.
                </p>
              </div>

              <div className="bg-blue-500/10 p-3 rounded-md border border-blue-500/20 text-sm">
                <p className="font-medium text-blue-200 mb-1">📱 Mensaje que se enviará:</p>
                <p className="text-blue-100/80 text-xs">
                  ¡Ya enviamos tu canción a las plataformas de streaming! En este link puedes preguardar tu correo para que te avisemos cuando publiquen tu canción. Esto puede tomar de 1 a 2 días hábiles.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSpotifyLinkModalOpen(false)
                    setHyperfollowUrl("")
                    setSelectedOrderForSpotifyLink(null)
                  }}
                  disabled={isSubmittingSpotifyLink}
                  className="border-white/10 bg-white/5 hover:bg-white/10"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitSpotifyLink}
                  disabled={isSubmittingSpotifyLink || !hyperfollowUrl.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmittingSpotifyLink ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Music className="mr-2 h-4 w-4" />
                      Enviar y Completar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para enviar Plantilla de Marketing */}
      <Dialog open={isMarketingModalOpen} onOpenChange={setIsMarketingModalOpen}>
        <DialogContent className="max-w-md glass-panel border-white/10">
          <DialogHeader>
            <DialogTitle>Enviar Plantilla de Marketing</DialogTitle>
          </DialogHeader>
          {selectedOrderForMarketing && (
            <div className="space-y-4">
              <div className="bg-white/5 p-3 rounded-md border border-white/10">
                <p className="text-sm">
                  <span className="font-medium">Cliente:</span> {selectedOrderForMarketing.customer_name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">WhatsApp:</span> {selectedOrderForMarketing.whatsapp}
                </p>
              </div>

              <div className="bg-white/5 p-3 rounded-md border border-white/10">
                <p className="text-sm text-muted-foreground">
                  Plantilla: <span className="font-medium text-white">shipment_confirmation_5</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta plantilla requiere variables {'{{1}}'} y {'{{2}}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="marketing-param1">Parámetro 1 ({"{{1}}"}) - Nombre del Cliente</Label>
                <Input
                  id="marketing-param1"
                  type="text"
                  placeholder="Nombre del cliente"
                  value={marketingParam1}
                  onChange={(e) => setMarketingParam1(e.target.value)}
                  disabled={isSendingMarketing}
                  className="bg-white/5 border-white/10"
                  maxLength={30}
                />
                <p className="text-xs text-muted-foreground">
                  Máximo 30 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="marketing-param2">Parámetro 2 ({"{{2}}"}) - Primeros 4 dígitos del Pedido</Label>
                <Input
                  id="marketing-param2"
                  type="text"
                  placeholder="Primeros 4 dígitos del ID del pedido"
                  value={marketingParam2}
                  onChange={(e) => setMarketingParam2(e.target.value)}
                  disabled={isSendingMarketing}
                  className="bg-white/5 border-white/10"
                  maxLength={30}
                />
                <p className="text-xs text-muted-foreground">
                  Máximo 30 caracteres
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMarketingModalOpen(false)
                    setSelectedOrderForMarketing(null)
                    setMarketingParam1("")
                    setMarketingParam2("")
                  }}
                  disabled={isSendingMarketing}
                  className="border-white/10 bg-white/5 hover:bg-white/10"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSendMarketing}
                  disabled={isSendingMarketing}
                >
                  {isSendingMarketing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para Generación de Video */}
      {selectedOrderForVideo && (
        <VideoGeneration
          order={selectedOrderForVideo}
          isOpen={isVideoModalOpen}
          onClose={handleCloseVideoModal}
          onRefresh={fetchTransactions}
        />
      )}
    </div>
  )
}
