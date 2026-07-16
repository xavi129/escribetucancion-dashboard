import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { sendSendPulseMessage, sendSendPulseTemplate, sendSendPulseInteractiveButtons, sendSendPulseInteractiveWithCTA, isSendPulseEnabled } from "@/lib/sendpulse"
import { getFirstName } from "@/lib/utils"
import { formatPhoneNumber, isValidInternationalPhone } from "@/lib/phone-utils"
import { DEFAULT_MARKETING_TEMPLATE_NAME, DEFAULT_MARKETING_TEMPLATE_LANGUAGE } from "@/lib/template-service"

// Función para verificar la firma del webhook de Supabase (opcional, para mayor seguridad)
function verifyWebhookSignature(request: Request): boolean {
  // Aquí se implementaría la verificación de la firma
  // Usando el encabezado x-webhook-signature de Supabase
  // Por ahora, retornamos true para simplificar
  return true
}

// Función helper para actualizar el estado a un estado específico
async function updateStatus(orderId: string, status: string, errorMessage?: string): Promise<void> {
  if (!supabaseAdmin) {
    console.error(`[Status Update] supabaseAdmin no está disponible. No se puede actualizar estado a ${status}.`)
    return
  }

  try {
    const now = new Date().toISOString()
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: status,
        updated_at: now
      })
      .eq('id', orderId)
      .select()

    if (updateError) {
      console.error(`[Status Update] Error al actualizar estado a ${status}:`, {
        error: updateError,
        message: updateError.message,
        orderId
      })
    } else if (!updateData || updateData.length === 0) {
      console.error(`[Status Update] No se encontró el registro para actualizar a ${status}. ID:`, orderId)
    } else {
      console.log(`[Status Update] ✓ Estado actualizado a "${status}" para orden ${orderId}`, {
        errorMessage: errorMessage || 'Sin mensaje de error'
      })
    }
  } catch (updateError) {
    console.error(`[Status Update] Excepción al actualizar estado a ${status}:`, {
      error: updateError,
      message: updateError instanceof Error ? updateError.message : String(updateError),
      orderId
    })
  }
}

// Función helper para actualizar el estado a "error"
async function updateStatusToError(orderId: string, errorMessage?: string): Promise<void> {
  await updateStatus(orderId, 'error', errorMessage)
}

// Función helper para verificar si el error es de número de teléfono no encontrado
function isPhoneNumberNotFoundError(errorData: string): boolean {
  try {
    // El error puede venir como string JSON o como string con formato "400: {...}"
    let errorJson: any = null
    
    // Intentar parsear si es JSON puro
    if (errorData.trim().startsWith('{')) {
      errorJson = JSON.parse(errorData)
    } else {
      // Si tiene formato "400: {...}", extraer la parte JSON
      const jsonMatch = errorData.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        errorJson = JSON.parse(jsonMatch[0])
      }
    }
    
    if (errorJson) {
      // Verificar si tiene el error de "Contact does not exist"
      const phoneErrors = errorJson.errors?.phone || []
      const hasContactError = phoneErrors.some((err: string) => 
        err.toLowerCase().includes('contact does not exist') ||
        err.toLowerCase().includes('contacto no existe') ||
        err.toLowerCase().includes('número no encontrado') ||
        err.toLowerCase().includes('phone not found')
      )
      
      if (hasContactError) {
        return true
      }
    }
    
    // También verificar directamente en el string
    const errorLower = errorData.toLowerCase()
    return (
      errorLower.includes('contact does not exist') ||
      errorLower.includes('contacto no existe') ||
      errorLower.includes('número no encontrado') ||
      errorLower.includes('phone not found') ||
      (errorLower.includes('phone') && errorLower.includes('not exist'))
    )
  } catch (parseError) {
    // Si no se puede parsear, verificar directamente en el string
    const errorLower = errorData.toLowerCase()
    return (
      errorLower.includes('contact does not exist') ||
      errorLower.includes('contacto no existe') ||
      errorLower.includes('número no encontrado') ||
      errorLower.includes('phone not found')
    )
  }
}

export async function POST(request: Request) {
  // Guardar transaction.id al inicio para poder usarlo en el catch si hay error
  let transactionId: string | null = null
  
  try {
    // Verificar que la solicitud sea legítima (opcional)
    if (!verifyWebhookSignature(request)) {
      return NextResponse.json(
        { success: false, message: "Firma de webhook inválida" },
        { status: 401 }
      )
    }

    // Obtener los datos del webhook
    const payload = await request.json()
    
    // Verificar que tenga un registro válido (ya no se requiere estado específico)
    if (!payload.record) {
      return NextResponse.json(
        { success: false, message: "No se proporcionó un registro válido" },
        { status: 400 }
      )
    }

    // Obtener los datos del cliente
    const transaction = payload.record
    transactionId = transaction.id // Guardar el ID para uso en catch
    
    // Verificar que tenga número de WhatsApp
    if (!transaction.whatsapp) {
      console.log(`Cliente ${transaction.id} no tiene número de WhatsApp registrado`)
      return NextResponse.json(
        { success: false, message: "Cliente sin número de WhatsApp" },
        { status: 400 }
      )
    }

    // Verificar si ya tiene letra generada, si no, marcar para generar después
    if (!transaction.generated_lyric) {
      console.log(`El pedido ${transaction.id} no tiene letra generada aún, se generará después del mensaje de bienvenida`)
    } else {
      console.log(`El pedido ${transaction.id} ya tiene letra generada`)
    }

    // Formatear el número de teléfono usando la utilidad internacional
    const phoneNumber = formatPhoneNumber(transaction.whatsapp)
    console.log(`Número formateado: ${phoneNumber}`)
    
    // Validar longitud para formato internacional (8-15 dígitos después del +)
    const digitsAfterPlus = phoneNumber.substring(1)
    const digitCount = digitsAfterPlus.length
    
    if (digitCount < 8 || digitCount > 15) {
      console.log(`[Invalid Phone] Número inválido: ${phoneNumber} (${digitCount} dígitos, rango válido: 8-15)`)
      await updateStatus(
        transaction.id, 
        'error', 
        `Número de teléfono inválido: ${phoneNumber} tiene ${digitCount} dígitos (rango válido: 8-15)`
      )
      
      return NextResponse.json(
        { 
          success: false, 
          message: `Número de teléfono inválido: tiene ${digitCount} dígitos (rango válido: 8-15)`,
          phoneNumber,
          digitCount,
          validRange: '8-15'
        },
        { status: 400 }
      )
    }
    
    // Crear el mensaje de bienvenida
    const welcomeMessage = `Hola ${getFirstName(transaction.customer_name)}, ¡muchas gracias por tu solicitud! Estamos procesando tu solicitud para la canción personalizada. Por favor, confirma que todo es correcto.`
    
    // Verificar si SendPulse está habilitado
    const useSendPulse = isSendPulseEnabled()
    
    // Función para enviar un mensaje de WhatsApp
    const sendWhatsAppMessage = async (messageBody: string): Promise<{ 
      ok: boolean; 
      status: number; 
      error?: string; 
      text?: () => Promise<string> 
    }> => {
      if (useSendPulse) {
        console.log('[WhatsApp Send to Leads] Using SendPulse provider')
        const result = await sendSendPulseMessage(phoneNumber, messageBody)
        
        if (result.success) {
          return { ok: true, status: 200 }
        } else {
          console.error("Error al enviar mensaje con SendPulse:", result.error)
          // Return the error for 24-hour window detection
          return { 
            ok: false, 
            status: 500, 
            error: result.error, 
            text: async () => result.error || 'Unknown error' 
          }
        }
      }
      
      // Método antiguo (whatsapp-web.js o similar)
      console.log('[WhatsApp Send to Leads] Using legacy provider')
      const url = process.env.WHATSAPP_API_URL
      const apiKey = process.env.WHATSAPP_API_KEY
      
      if (!apiKey) {
        console.error("Error: WHATSAPP_API_KEY no está configurada en las variables de entorno")
        return { ok: false, status: 500, text: async () => 'API key not configured' }
      }

      if (!url) {
        console.error("Error: WHATSAPP_API_URL no está configurada en las variables de entorno")
        return { ok: false, status: 500, text: async () => 'API URL not configured' }
      }
      
      const data = {
        phoneNumber,
        messageBody
      }
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        },
        body: JSON.stringify(data)
      })

      return {
        ok: response.ok,
        status: response.status,
        text: () => response.text()
      }
    }

    // Función para enviar plantilla cuando falla la ventana de 24 horas
    const sendTemplateMessage = async (customerName: string, orderId: string): Promise<{
      ok: boolean;
      status: number;
      text?: () => Promise<string>;
    }> => {
      console.log(`[SendPulse Template] Enviando plantilla "${DEFAULT_MARKETING_TEMPLATE_NAME}"`)
      
      // Preparar los parámetros para la plantilla
      // La plantilla espera: {{1}} = nombre del cliente, {{2}} = ID del pedido
      // WhatsApp limita los parámetros de texto a 30 caracteres máximo
      const MAX_PARAM_LENGTH = 30
      const ORDER_ID_LENGTH = 8 // Usar solo 8 caracteres para el orderId
      
      // Limpiar y usar solo el primer nombre
      let param1 = getFirstName(customerName)
      if (param1.length > MAX_PARAM_LENGTH) {
        param1 = param1.substring(0, MAX_PARAM_LENGTH)
      }
      
      // Truncar el orderId a solo 8 caracteres (sin guiones)
      let param2 = 'pedido'
      if (orderId) {
        // Remover guiones y tomar solo los primeros 8 caracteres
        const cleanOrderId = orderId.replace(/-/g, '').substring(0, ORDER_ID_LENGTH)
        param2 = cleanOrderId || 'pedido'
      }
      
      console.log('[SendPulse Template] Parámetros preparados:', { 
        param1, 
        param1Length: param1.length,
        param2, 
        param2Length: param2.length,
        originalOrderId: orderId 
      })
      
      // Validar que los parámetros no excedan el límite
      if (param1.length > MAX_PARAM_LENGTH || param2.length > MAX_PARAM_LENGTH) {
        console.error('[SendPulse Template] Error: Parámetros exceden el límite de 30 caracteres', {
          param1: { text: param1, length: param1.length },
          param2: { text: param2, length: param2.length }
        })
      }
      
      // Enviar plantilla "inicio" (body con 2 parámetros: {{1}}, {{2}})
      // Solo enviamos el body - el botón lo maneja SendPulse automáticamente
      const result = await sendSendPulseTemplate(
        phoneNumber,
        DEFAULT_MARKETING_TEMPLATE_NAME,
        [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: param1
              },
              {
                type: 'text',
                text: param2
              }
            ]
          }
        ],
        DEFAULT_MARKETING_TEMPLATE_LANGUAGE
      )
      
      if (result.success) {
        console.log('[SendPulse Template] Plantilla enviada exitosamente')
        return { ok: true, status: 200 }
      } else {
        console.error('[SendPulse Template] Error al enviar plantilla:', result.error)
        return { ok: false, status: 500, text: async () => result.error || 'Template send failed' }
      }
    }

    console.log("Enviando mensaje de bienvenida a WhatsApp:", phoneNumber)

    // Enviar el primer mensaje de bienvenida
    const welcomeResponse = await sendWhatsAppMessage(welcomeMessage)

    // Detectar error de ventana de 24 horas o estado "new" y enviar plantilla
    if (!welcomeResponse.ok) {
      const errorData = welcomeResponse.text ? await welcomeResponse.text() : (welcomeResponse.error || 'Unknown error')
      console.error("Error al enviar mensaje de bienvenida:", errorData)
      
      // Verificar si es un error de ventana de 24 horas (solo para SendPulse)
      const is24HourWindowError = useSendPulse && (
        errorData.includes('24') || 
        errorData.includes('window') ||
        errorData.includes('outside') ||
        errorData.toLowerCase().includes('customer service window')
      )
      
      // Verificar si es error de "Contact does not exist" - las plantillas pueden resolverlo
      const isContactNotFoundError = isPhoneNumberNotFoundError(errorData)
      
      // Si es estado "new", error de ventana de 24 horas, o "Contact does not exist", intentar enviar plantilla
      // Las plantillas pueden enviarse incluso cuando el contacto no existe en SendPulse
      const shouldTryTemplate = transaction.status === 'new' || is24HourWindowError || isContactNotFoundError
      
      if (shouldTryTemplate) {
        let reason = ''
        if (is24HourWindowError) {
          reason = 'ventana de 24 horas expirada'
        } else if (isContactNotFoundError) {
          reason = 'Contact does not exist - intentando plantilla (las plantillas no requieren contacto existente)'
        } else {
          reason = 'estado "new" - intentando plantilla como respaldo'
        }
        
        console.log(`[Template Fallback] ${reason}, enviando plantilla...`)
        
        // Intentar enviar plantilla en lugar del mensaje normal
        const templateResponse = await sendTemplateMessage(
          transaction.customer_name || 'cliente',
          transaction.id
        )
        
        if (!templateResponse.ok) {
          const templateError = templateResponse.text ? await templateResponse.text() : 'Template send failed'
          console.error("Error al enviar plantilla:", templateError)
          
          // Verificar si es error de número de teléfono no encontrado
          if (isPhoneNumberNotFoundError(templateError)) {
            console.log('[Phone Number Not Found] Detectado error de número no encontrado en plantilla, actualizando estado a "numero no found"...')
            await updateStatus(transaction.id, 'numero no found', `Error al enviar mensaje y plantilla: ${templateError}`)
            
            return NextResponse.json(
              { success: false, message: "Número de teléfono no encontrado" },
              { status: templateResponse.status }
            )
          }
          
          // Actualizar estado a "error" cuando falla tanto el mensaje como la plantilla
          await updateStatusToError(transaction.id, `Error al enviar mensaje y plantilla: ${templateError}`)
          
          return NextResponse.json(
            { success: false, message: "Error al enviar mensaje y plantilla de respaldo" },
            { status: templateResponse.status }
          )
        }
        
        console.log("✓ Plantilla enviada exitosamente como respaldo")
        
        // Actualizar estado a "plantilla" cuando se envía plantilla exitosamente
        if (supabaseAdmin) {
          try {
            const now = new Date().toISOString()
            await supabaseAdmin
              .from('orders')
              .update({ 
                status: 'plantilla',
                updated_at: now
              })
              .eq('id', transaction.id)
            
            console.log('[Template Init] Estado actualizado a "plantilla"')
          } catch (updateError) {
            console.error('[Status Update] Error al actualizar:', updateError)
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Plantilla enviada correctamente (${reason})`,
          order_id: transaction.id,
          messages_sent: 1,
          provider: 'sendpulse-template',
          status_updated: 'plantilla',
          template_used: DEFAULT_MARKETING_TEMPLATE_NAME
        })
      }
      
      // Si no se intentó plantilla y es error de número de teléfono no encontrado
      if (isPhoneNumberNotFoundError(errorData)) {
        console.log('[Phone Number Not Found] Detectado error de número no encontrado, actualizando estado a "numero no found"...')
        await updateStatus(transaction.id, 'numero no found', `Error al enviar mensaje de bienvenida: ${errorData}`)
        
        return NextResponse.json(
          { success: false, message: "Número de teléfono no encontrado" },
          { status: welcomeResponse.status }
        )
      }
      
      // Si no es error de ventana de 24 horas ni de número no encontrado, actualizar estado a "error" y retornar error normal
      await updateStatusToError(transaction.id, `Error al enviar mensaje de bienvenida: ${errorData}`)
      
      return NextResponse.json(
        { success: false, message: "Error al enviar el mensaje de bienvenida" },
        { status: welcomeResponse.status }
      )
    }

    console.log("✓ Mensaje de bienvenida enviado exitosamente")

    // Variable para rastrear si hubo errores durante el contacto
    let hasContactError = false
    let contactErrorMessage = ''

    // Si NO tiene letra generada, generarla ahora
    if (!transaction.generated_lyric) {
      console.log("Generando letra ahora para enviar al cliente...")
      
      try {
        // Esperar 2 segundos después del mensaje de bienvenida
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const lyricResponse = await fetch(`${request.url.split('/api/')[0]}/api/orders/generate-and-save-lyric`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            whatsapp: transaction.whatsapp,
            forceRegenerate: false
          }),
        })

        const lyricData = await lyricResponse.json()
        
        if (lyricData.success && lyricData.data.lyric) {
          console.log("Letra generada exitosamente, enviando al cliente...")
          transaction.generated_lyric = lyricData.data.lyric
        } else {
          console.error("No se pudo generar la letra")
          hasContactError = true
          contactErrorMessage = 'Error al generar letra'
          // No retornar aquí, continuar para actualizar estado a error
        }
      } catch (error) {
        console.error("Error al generar letra:", error)
        hasContactError = true
        contactErrorMessage = `Error al generar letra: ${error instanceof Error ? error.message : String(error)}`
        // No retornar aquí, continuar para actualizar estado a error
      }
    }

    // Si tiene letra generada (ya sea previa o recién generada), enviar mensajes adicionales
    if (transaction.generated_lyric) {
      console.log("Enviando letra generada...")
      
      // Mensaje 2: La letra generada
      const lyricMessage = `📝 *Letra de tu canción personalizada:*\n\n${transaction.generated_lyric}`
      
      // Esperar 2 segundos antes de enviar el segundo mensaje
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const lyricResponse = await sendWhatsAppMessage(lyricMessage)
      
      if (!lyricResponse.ok) {
        console.error("Error al enviar la letra")
        hasContactError = true
        const errorText = lyricResponse.text ? await lyricResponse.text() : 'Error desconocido'
        contactErrorMessage = contactErrorMessage ? `${contactErrorMessage}; Error al enviar letra: ${errorText}` : `Error al enviar letra: ${errorText}`
      } else {
        console.log("✓ Letra enviada exitosamente")
      }

      // Mensaje 3: Botones interactivos de edición y confirmación
      // Esperar otros 2 segundos antes del tercer mensaje
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Usar botones interactivos si SendPulse está habilitado, sino texto plano
      let confirmationResponse: { ok: boolean; status: number; error?: string; text?: () => Promise<string> }

      if (useSendPulse) {
        // Primero: botón CTA para EDITAR la letra
        const editUrl = `https://escribetucancion.com/editar/${transaction.id}`
        console.log('[WhatsApp] Enviando botón CTA de edición con URL:', editUrl)

        const editButtonResult = await sendSendPulseInteractiveWithCTA(
          phoneNumber,
          "Si quieres hacer cambios en la letra, presiona el botón para editar:",
          { title: "Editar letra", url: editUrl }
        )

        if (!editButtonResult.success) {
          confirmationResponse = {
            ok: false,
            status: 500,
            error: editButtonResult.error,
            text: async () => editButtonResult.error || 'Error desconocido'
          }
        } else {
          console.log("✓ Botón de edición enviado")

          // Esperar 1 segundo antes del siguiente mensaje
          await new Promise(resolve => setTimeout(resolve, 1000))

          // Después: botón de CONFIRMACIÓN de letra
          console.log('[WhatsApp] Enviando mensaje con botón de confirmación...')
          const confirmButtonResult = await sendSendPulseInteractiveButtons(
            phoneNumber,
            "¿Te gusta la letra de tu canción?\n\nSi te gusta, presiona el botón para confirmar:",
            [
              { id: "confirmo letra", title: "Confirmo letra" }
            ]
          )

          confirmationResponse = confirmButtonResult.success
            ? { ok: true, status: 200 }
            : {
                ok: false,
                status: 500,
                error: confirmButtonResult.error,
                text: async () => confirmButtonResult.error || 'Error desconocido'
              }
        }
      } else {
        // Fallback a mensaje de texto para proveedor legacy
        const editUrl = `https://escribetucancion.com/editar/${transaction.id}`
        const confirmationMessage = `Para continuar:\n\n✅ Escribe "confirmo letra" si te gusta y quieres continuar\n\n✏️ Para editar la letra, visita:\n${editUrl}`
        confirmationResponse = await sendWhatsAppMessage(confirmationMessage)
      }

      if (!confirmationResponse.ok) {
        console.error("Error al enviar mensaje de confirmación")
        hasContactError = true
        const errorText = confirmationResponse.text ? await confirmationResponse.text() : (confirmationResponse.error || 'Error desconocido')
        contactErrorMessage = contactErrorMessage ? `${contactErrorMessage}; Error al enviar confirmación: ${errorText}` : `Error al enviar confirmación: ${errorText}`
      } else {
        console.log("✓ Mensajes de confirmación enviados exitosamente", useSendPulse ? "(con botones interactivos)" : "(texto plano)")
      }
    }

    // Actualizar el estado: "error" si hubo errores, "contacted" si todo fue exitoso
    const oldStatus = transaction.status // Guardar el status anterior para los logs
    const newStatus = hasContactError ? 'error' : 'contacted'
    console.log(`[Status Update] Intentando actualizar pedido ${transaction.id} de '${oldStatus}' a '${newStatus}'`)
    console.log(`[Status Update] supabaseAdmin disponible:`, !!supabaseAdmin)
    console.log(`[Status Update] SUPABASE_SERVICE_ROLE_KEY configurada:`, !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    if (!supabaseAdmin) {
      console.error('[Status Update] supabaseAdmin no está disponible. Verifica que SUPABASE_SERVICE_ROLE_KEY esté configurada.')
    } else {
      try {
        console.log(`[Status Update] Ejecutando query de actualización en tabla 'orders'...`)
        const now = new Date().toISOString()
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('orders')
          .update({ 
            status: newStatus,
            updated_at: now
          })
          .eq('id', transaction.id)
          .select()

        console.log(`[Status Update] Respuesta de Supabase:`, { 
          hasData: !!updateData, 
          dataLength: updateData?.length,
          hasError: !!updateError,
          errorType: typeof updateError
        })

        if (updateError) {
          console.error(`[Status Update] Error al actualizar estado a ${newStatus}:`, {
            error: updateError,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code,
            errorKeys: Object.keys(updateError || {})
          })
        } else if (!updateData || updateData.length === 0) {
          console.error('[Status Update] No se encontró el registro para actualizar. ID:', transaction.id)
        } else {
          console.log(`[Status Update] ✓ Estado actualizado exitosamente:`, {
            id: transaction.id,
            old_status: oldStatus,
            new_status: newStatus,
            updated_record: updateData[0],
            ...(hasContactError && { error_message: contactErrorMessage })
          })
        }
      } catch (updateError) {
        console.error('[Status Update] Excepción al actualizar estado:', {
          error: updateError,
          message: updateError instanceof Error ? updateError.message : String(updateError),
          stack: updateError instanceof Error ? updateError.stack : undefined
        })
      }
    }

    return NextResponse.json({ 
      success: !hasContactError, 
      message: hasContactError 
        ? `Error al contactar: ${contactErrorMessage}`
        : (transaction.generated_lyric 
          ? "Mensajes enviados correctamente (bienvenida + letra + confirmación)"
          : "Mensaje de bienvenida enviado correctamente"),
      order_id: transaction.id,
      messages_sent: transaction.generated_lyric ? 3 : 1,
      provider: useSendPulse ? 'sendpulse' : 'legacy',
      status_updated: newStatus,
      ...(hasContactError && { error: contactErrorMessage })
    })
  } catch (error) {
    console.error("Error en el webhook de send-to-leads:", error)
    
    // Intentar actualizar estado a "error" si tenemos el transaction.id
    if (transactionId) {
      await updateStatusToError(
        transactionId, 
        `Error interno del servidor: ${error instanceof Error ? error.message : String(error)}`
      )
    } else {
      console.warn('[Status Update] No se pudo actualizar estado a error: transactionId no disponible')
    }
    
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}