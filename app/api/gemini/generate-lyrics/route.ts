import { NextResponse } from "next/server"
import { generateTextWithFallback } from "@/lib/ai"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt) {
      return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
    }

    // Construir un prompt más específico para generar letras de canciones en español
    const enhancedPrompt = `Escribe letras de canciones en español basadas en los siguientes detalles:
${prompt}

INSTRUCCIONES DE FORMATO:
- La respuesta debe contener ÚNICAMENTE la letra de la canción, sin ningún texto introductorio ni explicativo.
- Marca las secciones entre paréntesis simples como: (Intro), (Verso 1), (Verso 2), (Estribillo), (Puente), (Outro), etc.
- Usa SIEMPRE estos nombres exactos de secciones: (Intro), (Verso), (Estribillo), (Puente), (Outro)
- NO uses variaciones como "Introducción", "Coro", "Chorus", etc. - mantén los nombres estándar
- No incluyas ninguna explicación, comentario o nota adicional.
- No incluyas comillas ni otros caracteres especiales alrededor de la letra.
- La letra DEBE estar en español.
- Mantén el texto en menos de 400 palabras en total.
- IMPORTANTE: NO incluyas NUNCA información sobre precios, costos, pagos o detalles financieros en la letra.
- NO uses dígitos numéricos (0-9). Escribe TODOS los números en letras (ejemplo: 'uno' en lugar de '1', 'mil novecientos noventa' en lugar de '1990').
- Esta regla de "no números" se aplica a TODO el contenido, incluso si el usuario proporcionó fechas o cantidades en números en los detalles.
- NUNCA menciones el género musical en la letra (como "bachata", "cumbia", "reggaeton", "corrido", "rap", "rock", etc.).
- En lugar de mencionar el género, usa palabras genéricas como "canción", "melodía", "música", "ritmo", etc.
- Enfócate en el contenido emocional, la historia personal y el contexto proporcionado.
- El estilo musical se aplicará después, así que NO lo menciones en la letra.`

    // Verificar si al menos una API key está disponible
    const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY
    if (!apiKey) {
      console.error("Neither GEMINI_API_KEY nor GROQ_API_KEY environment variables are set")
      return NextResponse.json({ message: "API configuration error" }, { status: 500 })
    }

    // Llamar a la API con fallback
    const result = await generateTextWithFallback({
      prompt: enhancedPrompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
    })

    let generatedText = result.text

    // Limpiar cualquier texto explicativo que pueda haber sido incluido a pesar de las instrucciones
    // Buscar el primer marcador de sección como (Verso), (Estribillo), etc.
    const firstSectionMatch = generatedText.match(/\([A-Za-zÀ-ÿ\s]+\)/)
    if (firstSectionMatch && firstSectionMatch.index !== undefined) {
      // Si encontramos un marcador de sección, eliminamos todo lo que viene antes
      generatedText = generatedText.substring(firstSectionMatch.index)
    }

    console.log(`[generate-lyrics] Generado con: ${result.provider}`)

    return NextResponse.json({
      success: true,
      lyrics: generatedText,
      provider: result.provider,
    })
  } catch (error) {
    console.error("Error processing AI request:", error)
    return NextResponse.json(
      {
        success: false,
        message: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
