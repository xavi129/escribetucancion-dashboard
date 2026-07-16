import { NextResponse } from "next/server"
import { generateMusic, generateCustomMusic } from "@/lib/suno-api"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * Genera o recupera el estilo musical para una orden
 */
async function getOrGenerateStyle(orderId: string, lyrics?: string, providedStyle?: string): Promise<{ style: string | null, voice_gender: string | null }> {
  if (!supabaseAdmin) {
    console.warn("supabaseAdmin not available, cannot retrieve/generate style")
    return { style: providedStyle || null, voice_gender: null }
  }

  try {
    // Intentar recuperar la orden de la base de datos
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("styles, generated_style, genre, purpose, occasion, song_references, generated_lyric, voice_gender")
      .eq("id", orderId)
      .single()

    if (orderError) {
      console.error("Error fetching order:", orderError)
      return { style: providedStyle || null, voice_gender: null }
    }

    const voice_gender = order.voice_gender

    // Si ya hay un estilo generado guardado y es válido, usarlo
    if (order.generated_style && order.generated_style.trim().length > 0) {
      console.log("Using saved generated style from database:", order.generated_style)
      return { style: order.generated_style, voice_gender }
    }

    // Si no hay estilo guardado, intentar generarlo usando el endpoint de Gemini
    console.log("No saved style found, generating new style...")
    
    // Construir el combinedStyle a partir de los datos de la orden
    let combinedStyle = ""
    if (order.song_references && order.styles) {
      combinedStyle = `${order.styles}, ${order.song_references}`
    } else if (order.styles) {
      combinedStyle = order.styles
    } else if (order.song_references) {
      combinedStyle = order.song_references
    }

    // Limpiar referencias a artistas
    if (combinedStyle) {
      combinedStyle = combinedStyle
        .replace(/(por|de|interpretada por|interpretado por)\s+[^,;]+/gi, "")
        .replace(/\s+,/g, ",")
        .trim()
    }

    // Usar el endpoint existente de Gemini para generar el estilo
    const lyricsToUse = lyrics || order.generated_lyric
    
    // Si no hay combinedStyle suficiente pero hay lyrics u otra información, intentar generar igual
    // Si no hay combinedStyle y no hay información suficiente, usar el estilo proporcionado
    if ((!combinedStyle || combinedStyle.length < 3) && !lyricsToUse && !order.genre) {
      console.warn("No sufficient style information to generate, using provided style or null")
      return { style: providedStyle || null, voice_gender }
    }

    // Si no hay combinedStyle pero hay lyrics o genre, usar un estilo por defecto basado en el contexto
    const styleToUse = combinedStyle && combinedStyle.length >= 3 
      ? combinedStyle 
      : (order.genre || "música personalizada")
    
    try {
      // Construir la URL base para la llamada interna
      // Usar NEXT_PUBLIC_BASE_URL si está disponible, sino usar localhost por defecto
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      
      const generateStyleResponse = await fetch(`${baseUrl}/api/gemini/generate-style`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          combinedStyle: styleToUse,
          orderId,
          lyrics: lyricsToUse,
          genre: order.genre,
          purpose: order.purpose,
          occasion: order.occasion,
          voice_gender: order.voice_gender,
        }),
      })

      if (!generateStyleResponse.ok) {
        console.error("Error calling generate-style endpoint:", generateStyleResponse.statusText)
        return { style: providedStyle || combinedStyle, voice_gender }
      }

      const styleData = await generateStyleResponse.json()
      
      if (styleData.success && styleData.style) {
        console.log("Style generated successfully via Gemini endpoint:", styleData.style)
        // El endpoint ya guarda el estilo en la base de datos, así que solo retornamos el estilo
        return { style: styleData.style, voice_gender }
      } else {
        console.warn("Failed to generate style via endpoint, using fallback")
        return { style: providedStyle || combinedStyle, voice_gender }
      }
    } catch (error) {
      console.error("Error calling generate-style endpoint:", error)
      return { style: providedStyle || combinedStyle, voice_gender }
    }
  } catch (error) {
    console.error("Error in getOrGenerateStyle:", error)
    return { style: providedStyle || null, voice_gender: null }
  }
}

function normalizeGender(gender: string | null | undefined): string | undefined {
  if (!gender) return undefined
  const g = gender.toLowerCase().trim()
  if (['m', 'male', 'hombre', 'masculino'].includes(g)) return 'm'
  if (['f', 'female', 'mujer', 'femenino'].includes(g)) return 'f'
  return undefined
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Extract required fields
    const { customMode, prompt, style, title, lyric, instrumental, model, negativeTags, orderId, vocalGender: bodyVocalGender } = body

    let finalStyle = style
    let finalVocalGender = bodyVocalGender

    // Si hay orderId, intentar recuperar o generar el estilo
    if (orderId) {
      const { style: retrievedStyle, voice_gender } = await getOrGenerateStyle(orderId, lyric || prompt, style)
      if (retrievedStyle && retrievedStyle.trim().length > 0) {
        finalStyle = retrievedStyle
        console.log("Using style for order:", finalStyle)
      } else {
        // Si no se pudo obtener/generar estilo y no hay uno proporcionado, 
        // intentar obtener la orden para construir un estilo básico
        if ((!finalStyle || finalStyle.trim().length === 0) && supabaseAdmin) {
          try {
            const { data: order } = await supabaseAdmin
              .from("orders")
              .select("styles, song_references, voice_gender")
              .eq("id", orderId)
              .single()
            
            if (order) {
              // Get voice_gender if we didn't get it from getOrGenerateStyle (unlikely but possible if it errored early)
              // But getOrGenerateStyle returns null for voice_gender if error.
              // So if we are here, we might want to fetch it if we haven't got it.
              // Actually getOrGenerateStyle covers most cases.
              // But here we are in the fallback block where getOrGenerateStyle might have failed completely or returned empty style but maybe valid gender?

              // Let's just re-fetch or use if we have it?
              // Actually if getOrGenerateStyle failed, voice_gender might be null.
              // Let's try to get it from order here if we didn't get it.

              // Construir combinedStyle como último recurso
              let combinedStyle = ""
              if (order.song_references && order.styles) {
                combinedStyle = `${order.styles}, ${order.song_references}`
              } else if (order.styles) {
                combinedStyle = order.styles
              } else if (order.song_references) {
                combinedStyle = order.song_references
              }
              
              if (combinedStyle && combinedStyle.trim().length > 0) {
                // Limpiar referencias a artistas
                combinedStyle = combinedStyle
                  .replace(/(por|de|interpretada por|interpretado por)\s+[^,;]+/gi, "")
                  .replace(/\s+,/g, ",")
                  .trim()
                
                if (combinedStyle.length >= 3) {
                  finalStyle = combinedStyle
                  console.log("Using fallback combinedStyle:", finalStyle)
                }
              }

              // Use voice_gender from fallback fetch if we didn't get it from getOrGenerateStyle
              if (order.voice_gender && !finalVocalGender) {
                 finalVocalGender = normalizeGender(order.voice_gender)
              }
            }
          } catch (error) {
            console.error("Error getting order for fallback style:", error)
          }
        }
      }

      // If we got voice_gender from getOrGenerateStyle, use it.
      // Note: we need to handle if voice_gender is returned even if style wasn't retrieved?
      // Yes, my implementation returns voice_gender if found.
      if (voice_gender && !finalVocalGender) {
        finalVocalGender = normalizeGender(voice_gender)
      }
    }

    // Normalize finalVocalGender just in case it came from body and needs normalization (though usually body params are specific)
    // The user said "Use m for male, f for female", so if the body sends correct values, fine.
    // If body sends "male", we should normalize it too.
    if (finalVocalGender) {
      finalVocalGender = normalizeGender(finalVocalGender)
    }

    // Validate input según la documentación oficial
    if (customMode) {
      // En custom mode con instrumental=false, se requiere prompt (como lyrics)
      if (!instrumental && !lyric && !prompt) {
        return NextResponse.json({ 
          code: 400, 
          msg: "Prompt/Lyrics are required in custom mode with instrumental=false" 
        }, { status: 400 })
      }
      
      // En custom mode siempre se requiere style y title
      if (!finalStyle || !title) {
        return NextResponse.json({ 
          code: 400, 
          msg: "Style and title are required in custom mode" 
        }, { status: 400 })
      }

      // Call API with custom lyrics
      const result = await generateCustomMusic({
        lyric: lyric || prompt,
        style: finalStyle,
        title,
        model,
        vocalGender: finalVocalGender,
      })

      return NextResponse.json(result)
    } else {
      if (!prompt) {
        return NextResponse.json({ 
          code: 400, 
          msg: "Prompt is required in non-custom mode" 
        }, { status: 400 })
      }

      // Call API with prompt
      const result = await generateMusic({
        prompt,
        style: finalStyle,
        model,
        customMode,
        instrumental,
        negativeTags,
        title,
      })

      return NextResponse.json(result)
    }
  } catch (error) {
    console.error("Error generating Suno music:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error generating music",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
