import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { audioUrl, duration } = body

    if (!audioUrl) {
      return NextResponse.json({ message: "Audio URL is required" }, { status: 400 })
    }

    // En un entorno real, aquí procesaríamos el audio para crear una versión recortada
    // Esto requeriría herramientas como ffmpeg en el servidor

    // Para esta demostración, simularemos que procesamos el audio
    // y devolveremos URLs simuladas para las versiones

    // Extraer el nombre del archivo de la URL
    const fileName = audioUrl.split("/").pop() || "track.mp3"
    const baseFileName = fileName.split(".")[0]

    // Simular URLs para las versiones procesadas
    const demoUrl = `https://example.com/demo-${baseFileName}.mp3`
    const fullUrl = audioUrl // La versión completa es la original

    // Calcular la duración de la demo (mitad de la duración original)
    const demoDuration = duration ? Math.floor(duration / 2) : 90

    return NextResponse.json({
      success: true,
      demoUrl,
      fullUrl,
      demoDuration,
      fullDuration: duration || 180,
      message: "Audio processed successfully",
    })
  } catch (error) {
    console.error("Error processing audio:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
