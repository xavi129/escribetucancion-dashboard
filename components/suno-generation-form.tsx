"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Download, Loader2, Music, RefreshCw, Scissors } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { supabase } from "@/lib/supabase"

// Define the form schema with Zod
const formSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(3000, {
      message: "Prompt must be less than 3000 characters in custom mode or 400 characters in non-custom mode",
    }),
  style: z.string().max(200, "Style must be less than 200 characters").optional(),
  title: z.string().max(80, "Title must be less than 80 characters").optional(),
  customMode: z.boolean().default(true),
  instrumental: z.boolean().default(false),
  model: z.enum(["V3_5", "V4"]).default("V3_5"),
  negativeTags: z.string().optional(),
})

type SunoFormValues = z.infer<typeof formSchema>

type SunoGenerationFormProps = {
  onClose: () => void
  initialValues?: Partial<SunoFormValues>
  orderId?: string // ID del pedido para guardar el audio_url
}

// Tipo para las pistas generadas
type GeneratedTrack = {
  id: string
  audio_url: string
  image_url: string
  title: string
  duration: number
  demoUrl?: string
  demoDuration?: number
  isProcessing?: boolean
}

export default function SunoGenerationForm({ onClose, initialValues, orderId }: SunoGenerationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; taskId?: string } | null>(null)
  const [generatedTracks, setGeneratedTracks] = useState<GeneratedTrack[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  // Initialize the form with default values or provided initial values
  const form = useForm<SunoFormValues>({
    resolver: zodResolver(formSchema) as Resolver<SunoFormValues>,
    defaultValues: {
      prompt: "",
      style: "",
      title: "",
      customMode: true,
      instrumental: false,
      model: "V3_5",
      negativeTags: "",
      ...initialValues,
    },
  })

  // Watch customMode and instrumental to update validation
  const customMode = form.watch("customMode")
  const instrumental = form.watch("instrumental")

  // Limpiar el intervalo de polling cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [pollInterval])

  // Update validation based on customMode and instrumental
  const validateForm = () => {
    const values = form.getValues()
    let isValid = true

    if (customMode) {
      if (instrumental) {
        // Custom mode + instrumental: style and title required
        if (!values.style || !values.title) {
          isValid = false
          if (!values.style) form.setError("style", { message: "Style is required in custom instrumental mode" })
          if (!values.title) form.setError("title", { message: "Title is required in custom instrumental mode" })
        }
      } else {
        // Custom mode + vocals: style, prompt, and title required
        if (!values.style || !values.prompt || !values.title) {
          isValid = false
          if (!values.style) form.setError("style", { message: "Style is required in custom vocal mode" })
          if (!values.prompt) form.setError("prompt", { message: "Prompt is required in custom vocal mode" })
          if (!values.title) form.setError("title", { message: "Title is required in custom vocal mode" })
        }
      }
    } else {
      // Non-custom mode: only prompt required
      if (!values.prompt) {
        isValid = false
        form.setError("prompt", { message: "Prompt is required" })
      }
    }

    return isValid
  }

  // Consultar el estado de una tarea
  const checkTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch("/api/suno/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: taskId,
          action: "retrieve",
        }),
      })

      if (!response.ok) {
        console.error(`Error checking task status: ${response.status} ${response.statusText}`)
        return null
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error("Error checking task status:", error)
      return null
    }
  }

  // Iniciar el polling para verificar el estado de la tarea
  const startPolling = (taskId: string) => {
    setIsPolling(true)

    // Verificar inmediatamente
    checkTaskStatus(taskId).then(handleTaskResponse)

    // Configurar el intervalo de polling (cada 5 segundos)
    const interval = setInterval(() => {
      checkTaskStatus(taskId).then(handleTaskResponse)
    }, 5000)

    setPollInterval(interval)
  }

  // Manejar la respuesta de la tarea
  const handleTaskResponse = (response: any) => {
    if (!response || !response.success) {
      return
    }

    const taskData = response.data

    // Verificar si la tarea tiene una respuesta
    if (taskData.response && taskData.response.data && taskData.response.data.length > 0) {
      // Detener el polling
      if (pollInterval) {
        clearInterval(pollInterval)
        setPollInterval(null)
      }
      setIsPolling(false)

      // Procesar los tracks generados
      const tracks: GeneratedTrack[] = taskData.response.data.map((track: any) => ({
        id: track.id,
        audio_url: track.audio_url,
        image_url: track.image_url,
        title: track.title || form.getValues().title || "Generated Track",
        duration: track.duration || 180,
      }))

      setGeneratedTracks(tracks)

      // Guardar el audio_url de la primera canción en la base de datos
      if (orderId && tracks.length > 0) {
        saveAudioUrl(tracks[0].audio_url)
      }

      // Procesar automáticamente los audios para crear las versiones demo
      tracks.forEach((track) => processAudio(track))
    }
  }

  // Handle form submission
  // Guardar el audio_url en la base de datos
  const saveAudioUrl = async (audioUrl: string) => {
    if (!orderId || !audioUrl) return

    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from("orders")
        .update({
          audio_url: audioUrl,
          updated_at: now,
        })
        .eq("id", orderId)

      if (error) {
        console.error("Error saving audio_url to database:", error)
      } else {
        console.log("Audio URL saved successfully:", audioUrl)
      }
    } catch (error) {
      console.error("Error in saveAudioUrl:", error)
    }
  }

  const onSubmit = async (values: SunoFormValues) => {
    if (!validateForm()) return

    setIsSubmitting(true)
    setResult(null)
    setError(null)
    setGeneratedTracks([])

    try {
      // Preparar los datos para enviar a la API
      const apiData = {
        ...values,
        // Convertir los valores del formulario a los esperados por la API
        customMode: values.customMode,
        lyric: values.customMode ? values.prompt : undefined, // En modo personalizado, usamos el prompt como letra
        model: values.model === "V3_5" ? "chirp-v3.5" : "chirp-v4", // Convertir el modelo al formato esperado por la API
        orderId: orderId, // Incluir el orderId para recuperar/generar el estilo automáticamente
      }

      console.log("Sending data to API:", JSON.stringify(apiData, null, 2))

      const response = await fetch("/api/suno/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiData),
      })

      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        let errorMessage = `Error: ${response.status} ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
          console.error("API error response:", errorData)
          setError(errorMessage)
        } catch (parseError) {
          // Si no podemos analizar la respuesta como JSON, intentamos obtener el texto
          const errorText = await response.text()
          console.error("API error (text):", errorText)
          setError(`${errorMessage}. Details: ${errorText.substring(0, 100)}...`)
        }

        setResult({
          success: false,
          message: "Failed to create music generation task",
        })

        return
      }

      // Intentar analizar la respuesta como JSON
      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error("Error parsing API response:", parseError)
        const responseText = await response.text()
        setError(`Invalid response format. Details: ${responseText.substring(0, 100)}...`)

        setResult({
          success: false,
          message: "Error processing API response",
        })

        return
      }

      if (data.success) {
        setResult({
          success: true,
          message: "Music generation task created successfully!",
          taskId: data.taskId,
        })

        // Si hay un taskId, iniciar el polling para verificar el estado
        if (data.taskId) {
          startPolling(data.taskId)
        }

        // Si hay datos de pistas generadas inmediatamente, actualizar el estado
        if (data.data && data.data.length > 0) {
          const tracks: GeneratedTrack[] = data.data.map((track: any) => ({
            id: track.id,
            audio_url: track.audio_url,
            image_url: track.image_url,
            title: track.title || values.title || "Generated Track",
            duration: track.duration || 180,
          }))

          setGeneratedTracks(tracks)

          // Guardar el audio_url en la base de datos si se proporcionó un orderId
          if (orderId && tracks.length > 0) {
            saveAudioUrl(tracks[0].audio_url)
          }

          // Procesar automáticamente los audios para crear las versiones demo
          tracks.forEach((track) => processAudio(track))
        }
      } else {
        setResult({
          success: false,
          message: data.message || "Failed to create music generation task",
        })

        setError(data.message || data.details || "An error occurred while creating the music generation task")
      }
    } catch (error) {
      console.error("Error submitting form:", error)
      setResult({
        success: false,
        message: "An error occurred while submitting the form",
      })

      setError(error instanceof Error ? error.message : "Network error or server is unavailable")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Verificar manualmente el estado de la tarea
  const checkTaskStatusManually = async () => {
    if (!result?.taskId) return

    setIsPolling(true)
    const response = await checkTaskStatus(result.taskId)
    handleTaskResponse(response)
    setIsPolling(false)
  }

  // Procesar el audio para crear versiones demo y completa
  const processAudio = async (track: GeneratedTrack) => {
    // Actualizar el estado para mostrar que se está procesando
    setGeneratedTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, isProcessing: true } : t)))

    try {
      const response = await fetch("/api/audio/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioUrl: track.audio_url,
          duration: track.duration,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Actualizar el track con las URLs de las versiones procesadas
        setGeneratedTracks((prev) =>
          prev.map((t) =>
            t.id === track.id
              ? {
                  ...t,
                  demoUrl: data.demoUrl,
                  demoDuration: data.demoDuration,
                  isProcessing: false,
                }
              : t,
          ),
        )
      } else {
        console.error("Error processing audio:", data.message)
        setGeneratedTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, isProcessing: false } : t)))
      }
    } catch (error) {
      console.error("Error calling audio processing API:", error)
      setGeneratedTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, isProcessing: false } : t)))
    }
  }

  // Simular la recepción de pistas generadas (para demostración)
  const mockReceiveGeneratedTracks = () => {
    const tracks: GeneratedTrack[] = [
      {
        id: "8551662c",
        audio_url: "https://example.com/track1.mp3",
        image_url: "https://example.com/cover1.jpeg",
        title: form.getValues().title || "Generated Track 1",
        duration: 198.44,
      },
      {
        id: "bd151873",
        audio_url: "https://example.com/track2.mp3",
        image_url: "https://example.com/cover2.jpeg",
        title: form.getValues().title || "Generated Track 2",
        duration: 228.28,
      },
    ]

    setGeneratedTracks(tracks)

    // Procesar automáticamente los audios para crear las versiones demo
    tracks.forEach((track) => processAudio(track))
  }

  // Función para descargar un archivo
  const downloadFile = (url: string, fileName: string) => {
    // En un entorno real, esto descargaría el archivo
    // Para esta demostración, simplemente simularemos la descarga
    console.log(`Downloading ${fileName} from ${url}`)

    // Crear un elemento <a> temporal para la descarga
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="basic">Configuración Básica</TabsTrigger>
              <TabsTrigger value="advanced">Configuración Avanzada</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="customMode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Modo Personalizado</FormLabel>
                        <FormDescription>Habilitar para mayor control sobre la música generada</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="instrumental"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Solo Instrumental</FormLabel>
                        <FormDescription>Generar música sin letra</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Letra/Prompt*</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Escribe la letra de la canción o describe la música que quieres generar..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {customMode
                          ? "Límite: 3000 caracteres en modo personalizado"
                          : "Límite: 400 caracteres en modo no personalizado"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {customMode && (
                  <>
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título{instrumental || !customMode ? "" : "*"}</FormLabel>
                          <FormControl>
                            <Input placeholder="Ingresa un título para tu música" {...field} />
                          </FormControl>
                          <FormDescription>Límite: 80 caracteres</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estilo{instrumental || !customMode ? "" : "*"}</FormLabel>
                          <FormControl>
                            <Input placeholder="ej., Jazz, Clásica, Electrónica" {...field} />
                          </FormControl>
                          <FormDescription>Límite: 200 caracteres</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar modelo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="V3_5">V3.5</SelectItem>
                          <SelectItem value="V4">V4</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Selecciona la versión del modelo a utilizar para la generación</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="negativeTags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Etiquetas Negativas</FormLabel>
                      <FormControl>
                        <Input placeholder="Estilos musicales a excluir, ej., Heavy Metal" {...field} />
                      </FormControl>
                      <FormDescription>
                        Especifica estilos musicales que quieres excluir de la generación
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && result.success && (
            <Alert>
              <AlertTitle>Éxito</AlertTitle>
              <AlertDescription>
                {result.message}
                {result.taskId && (
                  <div className="mt-2">
                    ID de tarea: {result.taskId}
                    {isPolling ? (
                      <span className="ml-2 inline-flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        Verificando estado...
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onClick={checkTaskStatusManually}
                        disabled={isPolling}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Verificar estado
                      </Button>
                    )}
                  </div>
                )}
                <p className="mt-2 text-sm">
                  El proceso de generación de música ha comenzado. Este proceso normalmente toma unos minutos.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Music className="mr-2 h-4 w-4" />
                  Generar Música
                </>
              )}
            </Button>
            {/* Este botón es solo para demostración */}
            {result?.success && generatedTracks.length === 0 && !isPolling && (
              <Button type="button" onClick={mockReceiveGeneratedTracks}>
                Simular Respuesta
              </Button>
            )}
          </div>
        </form>
      </Form>

      {generatedTracks.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Pistas Generadas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {generatedTracks.map((track) => (
              <Card key={track.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{track.title}</CardTitle>
                  <CardDescription>
                    Duración: {Math.floor(track.duration / 60)}:
                    {Math.floor(track.duration % 60)
                      .toString()
                      .padStart(2, "0")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                    <Music className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <audio className="w-full mt-2" controls src={track.audio_url}>
                    Tu navegador no soporta el elemento de audio.
                  </audio>
                </CardContent>
                <CardFooter className="pt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="mr-2">
                    ID: {track.id}
                  </Badge>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile(track.audio_url, `${track.title}-completa.mp3`)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Versión Completa
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Descargar la canción completa</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {track.isProcessing ? (
                    <Button variant="outline" size="sm" disabled>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Procesando...
                    </Button>
                  ) : track.demoUrl ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(track.demoUrl!, `${track.title}-demo.mp3`)}
                          >
                            <Scissors className="h-4 w-4 mr-1" />
                            Versión Demo
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Descargar una versión recortada para enviar a clientes</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => processAudio(track)}>
                      <Scissors className="h-4 w-4 mr-1" />
                      Crear Demo
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="mt-4 p-4 bg-muted rounded-md">
            <h4 className="font-medium mb-2">Acerca de las versiones:</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                <strong>Versión Completa:</strong> Canción completa para entregar después del pago del cliente.
              </li>
              <li>
                <strong>Versión Demo:</strong> Muestra de la mitad de duración para enviar a clientes para aprobación
                antes del pago.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
