import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMessageTemplate, sendTextMessage } from './whatsapp-business'

// Mock fetch globally
const globalFetch = vi.fn()
global.fetch = globalFetch

// Mock console.log/error to keep test output clean
global.console.log = vi.fn()
global.console.error = vi.fn()

describe('WhatsApp Business Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock Environment Variables
    process.env.WHATSAPP_ACCESS_TOKEN = 'test_token'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = '987654321'
  })

  describe('createMessageTemplate', () => {
    it('should construct the correct payload for template creation', async () => {
      // Mock successful response
      globalFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'template_123', status: 'PENDING', category: 'MARKETING' }),
        json: async () => ({ id: 'template_123', status: 'PENDING', category: 'MARKETING' })
      })

      const name = 'test_template'
      const category = 'MARKETING'
      const bodyText = 'Hello world'
      const language = 'en_US'

      const result = await createMessageTemplate(name, category, bodyText, language)

      // Verify fetch call
      expect(globalFetch).toHaveBeenCalledTimes(1)
      const [url, options] = globalFetch.mock.calls[0]

      expect(url).toBe('https://graph.facebook.com/v22.0/987654321/message_templates')
      expect(options.method).toBe('POST')
      expect(options.headers['Authorization']).toBe('Bearer test_token')

      const payload = JSON.parse(options.body)
      expect(payload).toEqual({
        name: 'test_template',
        category: 'MARKETING',
        allow_category_change: true,
        language: 'en_US',
        components: [
          {
            type: 'BODY',
            text: 'Hello world'
          }
        ]
      })

      // Verify result
      expect(result.success).toBe(true)
      expect(result.id).toBe('template_123')
    })

    it('should throw error if businessAccountId is missing', async () => {
      delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID

      await expect(createMessageTemplate('name', 'MARKETING', 'text')).rejects.toThrow('WHATSAPP_BUSINESS_ACCOUNT_ID is required')
    })
  })

  describe('sendTextMessage', () => {
    it('should construct the correct payload for sending text', async () => {
       // Mock successful response
       globalFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ messages: [{ id: 'wamid.123' }] }),
        json: async () => ({ messages: [{ id: 'wamid.123' }] })
      })

      const to = '+1 (555) 123-4567' // Test formatting
      const body = 'Hello there'

      const result = await sendTextMessage(to, body)

      // Verify fetch call
      expect(globalFetch).toHaveBeenCalledTimes(1)
      const [url, options] = globalFetch.mock.calls[0]

      expect(url).toBe('https://graph.facebook.com/v22.0/123456789/messages')

      const payload = JSON.parse(options.body)
      expect(payload).toEqual({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '15551234567', // Should be normalized (no +)
        type: 'text',
        text: {
          preview_url: false,
          body: 'Hello there'
        }
      })

      expect(result.success).toBe(true)
    })
  })
})
