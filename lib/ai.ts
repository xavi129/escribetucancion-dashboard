import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"

// Configurar proveedores
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})

// Modelos
const geminiModel = google("gemini-2.5-flash-lite")
const groqModel = groq("meta-llama/llama-4-scout-17b-16e-instruct")

export interface GenerateTextOptions {
  prompt: string
  temperature?: number
  maxOutputTokens?: number
}

export interface GenerateTextResult {
  text: string
  provider: "gemini" | "groq"
}

/**
 * Genera texto usando Gemini como principal y Groq como fallback.
 * Si Gemini falla, automáticamente intenta con Groq.
 */
export async function generateTextWithFallback(
  options: GenerateTextOptions
): Promise<GenerateTextResult> {
  const { prompt, temperature = 0.7, maxOutputTokens = 2048 } = options

  // Intentar con Gemini primero
  try {
    console.log("[AI] Intentando generar con Gemini...")

    const result = await generateText({
      model: geminiModel,
      prompt,
      temperature,
      maxOutputTokens,
    })

    console.log("[AI] Generación exitosa con Gemini")
    return {
      text: result.text,
      provider: "gemini",
    }
  } catch (geminiError) {
    console.error("[AI] Error con Gemini, intentando fallback a Groq:", geminiError)

    // Verificar si tenemos API key de Groq
    if (!process.env.GROQ_API_KEY) {
      console.error("[AI] No hay GROQ_API_KEY configurada para fallback")
      throw geminiError
    }

    // Intentar con Groq como fallback
    try {
      console.log("[AI] Intentando generar con Groq (fallback)...")

      const result = await generateText({
        model: groqModel,
        prompt,
        temperature,
        maxOutputTokens,
      })

      console.log("[AI] Generación exitosa con Groq (fallback)")
      return {
        text: result.text,
        provider: "groq",
      }
    } catch (groqError) {
      console.error("[AI] Error con Groq (fallback):", groqError)
      // Si ambos fallan, lanzar el error de Groq (el último intento)
      throw groqError
    }
  }
}

/**
 * Verifica si los proveedores de AI están configurados
 */
export function checkAIConfiguration(): { gemini: boolean; groq: boolean } {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
  }
}
