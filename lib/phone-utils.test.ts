// Tests for Phone Number Utilities
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { formatPhoneNumber, isValidInternationalPhone, getPhoneValidationInfo, formatPhoneNumberForWhatsApp } from './phone-utils'

describe('Phone Number Utilities', () => {
  describe('formatPhoneNumber', () => {
    it('preserves numbers already in international format with +', () => {
      expect(formatPhoneNumber('+525551234567')).toBe('+525551234567')
      expect(formatPhoneNumber('+14155551234')).toBe('+14155551234')
      expect(formatPhoneNumber('+34612345678')).toBe('+34612345678')
      expect(formatPhoneNumber('+573001234567')).toBe('+573001234567')
    })

    it('converts 00 prefix to + prefix', () => {
      expect(formatPhoneNumber('00525551234567')).toBe('+525551234567')
      expect(formatPhoneNumber('0014155551234')).toBe('+14155551234')
    })

    it('removes spaces, hyphens, and parentheses', () => {
      expect(formatPhoneNumber('+52 555 123 4567')).toBe('+525551234567')
      expect(formatPhoneNumber('+1-415-555-1234')).toBe('+14155551234')
      expect(formatPhoneNumber('+1 (415) 555-1234')).toBe('+14155551234')
    })

    it('adds + to numbers without country code prefix', () => {
      expect(formatPhoneNumber('525551234567')).toBe('+525551234567')
      expect(formatPhoneNumber('14155551234')).toBe('+14155551234')
    })

    it('removes non-numeric characters except +', () => {
      expect(formatPhoneNumber('+52abc555def1234567')).toBe('+525551234567')
      expect(formatPhoneNumber('+1(415)555-1234')).toBe('+14155551234')
    })
  })

  describe('formatPhoneNumberForWhatsApp', () => {
    it('formats Mexico (+52) numbers correctly by adding 1', () => {
      // Standard Mexico number: +52 + 10 digits
      expect(formatPhoneNumberForWhatsApp('+525512345678')).toBe('+5215512345678')
      
      // Test that the transformation is idempotent
      const unformatted = '+525512345678'
      const formatted = formatPhoneNumberForWhatsApp(unformatted)
      const reapplied = formatPhoneNumberForWhatsApp(formatted)
      
      expect(formatted).toBe('+5215512345678')
      expect(reapplied).toBe('+5215512345678')
      expect(formatted).toBe(reapplied)
    })

    it('handles idempotency for Mexico numbers (avoids double +521)', () => {
      // If already has +521, it should remain unchanged
      expect(formatPhoneNumberForWhatsApp('+5215512345678')).toBe('+5215512345678')
      
      // Test multiple applications of the function (should be idempotent)
      const input = '+5215512345678'
      const firstResult = formatPhoneNumberForWhatsApp(input)
      const secondResult = formatPhoneNumberForWhatsApp(firstResult)
      const thirdResult = formatPhoneNumberForWhatsApp(secondResult)
      
      expect(firstResult).toBe('+5215512345678')
      expect(secondResult).toBe('+5215512345678')
      expect(thirdResult).toBe('+5215512345678')
      expect(firstResult).toBe(secondResult)
      expect(secondResult).toBe(thirdResult)
    })

    it('formats Argentina (+54) numbers correctly by adding 9', () => {
      // Standard Argentina: +54 + Area Code (e.g. 11) + Number
      // Without 15
      expect(formatPhoneNumberForWhatsApp('+541112345678')).toBe('+5491112345678')
    })

    it('handles idempotency for Argentina numbers (avoids double +549)', () => {
      // If already has +549, it should remain unchanged
      expect(formatPhoneNumberForWhatsApp('+5491112345678')).toBe('+5491112345678')
    })

    it('removes 15 from Argentina numbers if it follows area code', () => {
      // Area code 11 (2 digits)
      expect(formatPhoneNumberForWhatsApp('+541115123456')).toBe('+54911123456')
      // Area code 223 (3 digits)
      expect(formatPhoneNumberForWhatsApp('+5422315123456')).toBe('+549223123456')
      // Area code 2234 (4 digits)
      expect(formatPhoneNumberForWhatsApp('+542234151234')).toBe('+54922341234')
    })

    it('does NOT remove 15 from Argentina numbers if it is at the start (no area code detected)', () => {
      // This matches the "special case" example from the prompt: +541512345678 -> +5491512345678
      // Here "15" is immediately after the inserted "9", so regex ^(\+549)(\d{2,4})15... won't match (needs 2-4 digits before 15)
      expect(formatPhoneNumberForWhatsApp('+541512345678')).toBe('+5491512345678')
    })

    it('leaves other countries unchanged', () => {
      // USA
      expect(formatPhoneNumberForWhatsApp('+14155551234')).toBe('+14155551234')
      // Spain
      expect(formatPhoneNumberForWhatsApp('+34612345678')).toBe('+34612345678')
    })

    it('handles unclean input by cleaning it first', () => {
      expect(formatPhoneNumberForWhatsApp('52 55 1234 5678')).toBe('+5215512345678')
      expect(formatPhoneNumberForWhatsApp('54 11 15 1234 56')).toBe('+54911123456')
    })
  })

  describe('isValidInternationalPhone', () => {
    it('accepts valid international phone numbers', () => {
      // USA (10 digits after +1)
      expect(isValidInternationalPhone('+14155551234')).toBe(true)
      // Mexico (10 digits after +52)
      expect(isValidInternationalPhone('+525551234567')).toBe(true)
      // Spain (9 digits after +34)
      expect(isValidInternationalPhone('+34612345678')).toBe(true)
      // Colombia (10 digits after +57)
      expect(isValidInternationalPhone('+573001234567')).toBe(true)
      // UK (10 digits after +44)
      expect(isValidInternationalPhone('+447911123456')).toBe(true)
    })

    it('rejects numbers that are too short', () => {
      expect(isValidInternationalPhone('+1234567')).toBe(false) // 7 digits
      expect(isValidInternationalPhone('+123456')).toBe(false) // 6 digits
    })

    it('rejects numbers that are too long', () => {
      expect(isValidInternationalPhone('+1234567890123456')).toBe(false) // 16 digits
      expect(isValidInternationalPhone('+12345678901234567')).toBe(false) // 17 digits
    })

    it('rejects numbers starting with +0', () => {
      expect(isValidInternationalPhone('+01234567890')).toBe(false)
    })

    it('accepts numbers in range 8-15 digits', () => {
      expect(isValidInternationalPhone('+12345678')).toBe(true) // 8 digits - minimum
      expect(isValidInternationalPhone('+123456789012345')).toBe(true) // 15 digits - maximum
    })
  })

  describe('getPhoneValidationInfo', () => {
    it('provides detailed validation info for valid numbers', () => {
      const info = getPhoneValidationInfo('+525551234567')
      expect(info.formatted).toBe('+525551234567')
      expect(info.isValid).toBe(true)
      expect(info.digitCount).toBe(12)
      expect(info.hasCountryCode).toBe(true)
      expect(info.reason).toBeUndefined()
    })

    it('identifies numbers that are too short', () => {
      const info = getPhoneValidationInfo('+1234567')
      expect(info.isValid).toBe(false)
      expect(info.digitCount).toBe(7)
      expect(info.reason).toContain('too short')
    })

    it('identifies numbers that are too long', () => {
      const info = getPhoneValidationInfo('+1234567890123456')
      expect(info.isValid).toBe(false)
      expect(info.digitCount).toBe(16)
      expect(info.reason).toContain('too long')
    })

    it('detects missing country code', () => {
      const info = getPhoneValidationInfo('5551234567')
      expect(info.hasCountryCode).toBe(false)
      expect(info.formatted).toBe('+5551234567')
    })

    it('detects country code with 00 prefix', () => {
      const info = getPhoneValidationInfo('00525551234567')
      expect(info.hasCountryCode).toBe(true)
      expect(info.formatted).toBe('+525551234567')
    })
  })

  // Property-based tests
  describe('Property-based tests', () => {
    it('formatPhoneNumber always returns a string starting with +', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /\d/.test(s)), // At least one digit
          (phone) => {
            const formatted = formatPhoneNumber(phone)
            expect(formatted).toMatch(/^\+/)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('formatPhoneNumber removes all non-numeric characters except +', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => /\d/.test(s)),
          (phone) => {
            const formatted = formatPhoneNumber(phone)
            expect(formatted).toMatch(/^\+\d+$/)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('isValidInternationalPhone accepts numbers with 8-15 digits after +', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }), // First digit (can't be 0)
          fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 7, maxLength: 14 }), // Remaining digits
          (firstDigit, remainingDigits) => {
            const phone = '+' + firstDigit + remainingDigits.join('')
            const isValid = isValidInternationalPhone(phone)
            const digitCount = phone.length - 1
            
            if (digitCount >= 8 && digitCount <= 15) {
              expect(isValid).toBe(true)
            } else {
              expect(isValid).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
