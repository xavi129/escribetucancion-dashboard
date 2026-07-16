/**
 * WhatsApp Template Service
 * 
 * Manages message templates for WhatsApp Business API.
 * Templates are required for initiating conversations outside the 24-hour window.
 */

import { sendTemplateMessage, type TemplateContent } from './whatsapp-business'
import { d1Query } from './d1-client'
import type { Order } from './supabase'

// ============================================
// Constants
// ============================================

/**
 * Default template to use for "Send to Leads" when template mode is activated
 * (e.g. when the 24-hour window is closed). This template is sent instead of
 * utility messages.
 *
 * Available templates:
 * - 'inicio' (language: 'es') - Template de inicio, body con 2 parámetros
 * - 'shipment_confirmation_5' (language: 'es_MX') - Marketing template
 */
export const DEFAULT_MARKETING_TEMPLATE_NAME = 'inicio'

/**
 * Language code for the default template used in Send to Leads.
 * Must match the language configured in SendPulse/WhatsApp for the template.
 *
 * Common codes:
 * - 'es' for inicio
 * - 'es_MX' for shipment_confirmation_5
 */
export const DEFAULT_MARKETING_TEMPLATE_LANGUAGE = 'es'

/**
 * Language code per template name when different from default 'es'.
 * Must match the language configured in SendPulse/WhatsApp for each template.
 * Used by sendTemplate() to build the API request.
 */
const TEMPLATE_LANGUAGE: Record<string, string> = {
  inicio: 'es',
  shipment_confirmation_5: 'es_MX',
}

// ============================================
// Types
// ============================================

export interface MessageTemplate {
  id: string
  name: string
  category: string
  content: string
  variables: string[] // Variable names like {{1}}, {{2}}
  created_at: string
}

export interface TemplateCategory {
  name: string
  templates: MessageTemplate[]
}

// ============================================
// Template Management
// ============================================

/**
 * Get all templates organized by category
 */
export async function getTemplates(): Promise<TemplateCategory[]> {
  const result = await d1Query<MessageTemplate>(
    'SELECT * FROM message_templates ORDER BY category, name'
  )

  // Group by category
  const categoryMap = new Map<string, MessageTemplate[]>()
  
  for (const template of result.results) {
    const category = template.category
    if (!categoryMap.has(category)) {
      categoryMap.set(category, [])
    }
    categoryMap.get(category)!.push({
      ...template,
      variables: JSON.parse(template.variables as unknown as string || '[]'),
    })
  }

  return Array.from(categoryMap.entries()).map(([name, templates]) => ({
    name,
    templates,
  }))
}

/**
 * Get a template by name
 */
export async function getTemplateByName(name: string): Promise<MessageTemplate | null> {
  const result = await d1Query<MessageTemplate>(
    'SELECT * FROM message_templates WHERE name = ?',
    [name]
  )
  
  if (result.results.length === 0) return null
  
  const template = result.results[0]
  return {
    ...template,
    variables: JSON.parse(template.variables as unknown as string || '[]'),
  }
}

/**
 * Seed default templates (run once during setup)
 */
export async function seedDefaultTemplates(): Promise<void> {
  const defaultTemplates = [
    {
      name: 'saludo_inicial',
      category: 'greeting',
      content: '¡Hola {{1}}! 🎵 Gracias por contactarnos. ¿En qué podemos ayudarte?',
      variables: ['customer_name'],
    },
    {
      name: 'confirmacion_pedido',
      category: 'status',
      content: '¡Hola {{1}}! Tu pedido de canción personalizada ha sido recibido. Te mantendremos informado del progreso. 🎶',
      variables: ['customer_name'],
    },
    {
      name: 'letra_lista',
      category: 'status',
      content: '¡{{1}}! 🎵 Tu letra está lista para revisión. Por favor confírmala o solicita cambios.',
      variables: ['customer_name'],
    },
    {
      name: 'cancion_lista',
      category: 'delivery',
      content: '🎉 ¡{{1}}, tu canción está lista! Escúchala aquí: {{2}}',
      variables: ['customer_name', 'play_url'],
    },
    {
      name: 'recordatorio_pago',
      category: 'payment',
      content: 'Hola {{1}}, te recordamos que tu pedido está pendiente de pago. El total es ${{2}} MXN. ¿Necesitas ayuda?',
      variables: ['customer_name', 'total_price'],
    },
    {
      name: 'spotify_disponible',
      category: 'delivery',
      content: '🎧 ¡{{1}}! Tu canción ya está disponible en Spotify y otras plataformas: {{2}}',
      variables: ['customer_name', 'hyperfollow_url'],
    },
    {
      name: 'shipment_confirmation_5',
      category: 'marketing',
      content: 'Hola {{1}}, ¡Estamos encantados de informarle que su pedido {{2}} se está en proceso! Haga clic abajo para confirmar.',
      variables: ['customer_name', 'order_number'],
    },
  ]

  for (const template of defaultTemplates) {
    await d1Query(
      `INSERT OR IGNORE INTO message_templates (id, name, category, content, variables)
       VALUES (?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        template.name,
        template.category,
        template.content,
        JSON.stringify(template.variables),
      ]
    )
  }
}

// ============================================
// Variable Substitution
// ============================================

/**
 * Substitute template variables with actual values
 */
export function substituteVariables(
  content: string,
  variables: string[],
  context: TemplateContext
): string {
  let result = content

  variables.forEach((varName, index) => {
    const placeholder = `{{${index + 1}}}`
    const value = getVariableValue(varName, context)
    result = result.replace(placeholder, value)
  })

  return result
}

interface TemplateContext {
  order?: Partial<Order> | null
  customerName?: string
  phoneNumber?: string
  playUrl?: string
}

function getVariableValue(varName: string, context: TemplateContext): string {
  switch (varName) {
    case 'customer_name':
      return context.customerName || context.order?.customer_name || 'Cliente'
    case 'total_price':
      return context.order?.total_price?.toString() || '0'
    case 'play_url':
      return context.playUrl || context.order?.audio_url || ''
    case 'hyperfollow_url':
      return context.order?.hyperfollow_url || ''
    case 'song_type':
      return context.order?.song_type || 'canción'
    case 'order_status':
      return context.order?.status || 'pendiente'
    case 'order_number':
      return context.order?.order_number?.toString() || context.order?.id?.slice(0, 8) || ''
    default:
      return ''
  }
}

// ============================================
// Send Template
// ============================================

/**
 * Send a template message with variable substitution
 */
export async function sendTemplate(
  phoneNumber: string,
  templateName: string,
  context: TemplateContext
): Promise<{ success: boolean; wamid?: string; error?: string; previewContent?: string }> {
  // Get template
  const template = await getTemplateByName(templateName)
  if (!template) {
    return { success: false, error: `Template "${templateName}" not found` }
  }

  // Build template components with substituted values
  const components = template.variables.length > 0 ? [{
    type: 'body' as const,
    parameters: template.variables.map(varName => ({
      type: 'text' as const,
      text: getVariableValue(varName, context),
    })),
  }] : []

  // Generate preview content
  const previewContent = substituteVariables(template.content, template.variables, context)

  // Language must match the template as registered in SendPulse/WhatsApp (e.g. es_MX for shipment_confirmation_5)
  const languageCode = TEMPLATE_LANGUAGE[templateName] ?? 'es'

  const templateContent: TemplateContent = {
    name: templateName,
    language: { code: languageCode },
    components,
  }

  const result = await sendTemplateMessage(phoneNumber, templateContent)

  return {
    ...result,
    previewContent,
  }
}

// ============================================
// Category Labels
// ============================================

export const categoryLabels: Record<string, string> = {
  greeting: 'Saludos',
  status: 'Estado del pedido',
  payment: 'Pagos',
  delivery: 'Entrega',
  marketing: 'Marketing',
}

export function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category
}
