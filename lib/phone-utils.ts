/**
 * Phone number utilities for international formatting
 * 
 * This module provides functions to format and validate phone numbers
 * for international use, without assuming any default country code.
 */

/**
 * Formats a phone number to international format
 * Does NOT assume any default country code
 * 
 * @param phone - Phone number to format
 * @returns Formatted number with + prefix
 */
export function formatPhoneNumber(phone: string): string {
  // Clean the number: remove spaces, hyphens, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]+/g, "")
  
  // If already in international format with +, preserve only the digits after the first +
  if (cleaned.startsWith("+")) {
    // Remove everything except numbers, keep the first +
    const digitsOnly = cleaned.slice(1).replace(/[^0-9]/g, "")
    return "+" + digitsOnly
  }
  
  // Remove all non-numeric characters
  cleaned = cleaned.replace(/[^0-9]/g, "")
  
  // If there are no digits, return empty + to indicate invalid
  if (cleaned.length === 0) {
    return "+"
  }
  
  // If starts with 00 (alternative international format), convert to +
  if (cleaned.startsWith("00")) {
    const internationalDigits = cleaned.slice(2)
    return "+" + (internationalDigits || cleaned)
  }
  
  // For numbers without country code, add + but log warning
  if (process.env.NODE_ENV !== 'test') {
    console.warn(`[Phone] Number without country code: ${phone}. Should include country code from frontend.`)
  }
  return "+" + cleaned
}

/**
 * Validates that a phone number has valid international format
 * Accepts numbers with 8-15 digits (covers most countries)
 * 
 * Expected format: +[country code][number]
 * - Country code: 1-3 digits
 * - Total number after +: 8-15 digits
 * 
 * Valid examples:
 * - +1234567890 (10 digits, USA)
 * - +525551234567 (12 digits, Mexico)
 * - +34612345678 (11 digits, Spain)
 * - +573001234567 (12 digits, Colombia)
 * 
 * @param phone - Phone number to validate
 * @returns true if the number is valid, false otherwise
 */
export function isValidInternationalPhone(phone: string): boolean {
  const formatted = formatPhoneNumber(phone)
  // Validate: must start with +, followed by digit 1-9, and have 8-15 total digits
  return /^\+[1-9]\d{7,14}$/.test(formatted)
}

/**
 * Gets information about phone number validity
 * Useful for debugging and detailed logging
 * 
 * @param phone - Phone number to analyze
 * @returns Object with validation information
 */
export function getPhoneValidationInfo(phone: string): {
  formatted: string
  isValid: boolean
  digitCount: number
  hasCountryCode: boolean
  reason?: string
} {
  const formatted = formatPhoneNumber(phone)
  const digitsAfterPlus = formatted.substring(1)
  const digitCount = digitsAfterPlus.length
  const hasCountryCode = phone.trim().startsWith("+") || phone.trim().startsWith("00")
  
  let isValid = true
  let reason: string | undefined
  
  if (digitCount < 8) {
    isValid = false
    reason = `Number too short: ${digitCount} digits (minimum: 8)`
  } else if (digitCount > 15) {
    isValid = false
    reason = `Number too long: ${digitCount} digits (maximum: 15)`
  } else if (!/^\+[1-9]\d{7,14}$/.test(formatted)) {
    isValid = false
    reason = "Invalid format"
  }
  
  return {
    formatted,
    isValid,
    digitCount,
    hasCountryCode,
    reason
  }
}

/**
 * Formats a phone number specifically for WhatsApp delivery
 * Applies country-specific rules for Mexico (+52) and Argentina (+54)
 *
 * Rules:
 * - Mexico (+52): Add '1' after country code => +521...
 *   Only adds '1' if not already present (idempotent)
 * - Argentina (+54): Add '9' after country code => +549...
 *   AND remove '15' prefix if it exists after area code (2-4 digits)
 *   Only adds '9' if not already present (idempotent)
 * - Others: Keep as is
 *
 * @note This function is idempotent for Mexico (+52) and Argentina (+54) numbers.
 * It detects if the number is already in WhatsApp format and returns it unchanged.
 *
 * @param phoneNumber - The phone number to format
 * @returns The formatted phone number for WhatsApp
 */
export function formatPhoneNumberForWhatsApp(phoneNumber: string): string {
  // First ensure we have a standard international format
  let formatted = formatPhoneNumber(phoneNumber)

  // Mexico (+52): Add '1' after +52 if not already present
  if (formatted.startsWith('+52')) {
    // Idempotency check: if already has +521, it's already formatted for WhatsApp
    if (formatted.startsWith('+521')) {
      return formatted
    }

    // Add '1' after country code for WhatsApp format
    return '+521' + formatted.substring(3)
  }

  // Argentina (+54): Add '9' after +54 if not already present
  if (formatted.startsWith('+54')) {
    // Idempotency check: if already has +549, it's already formatted for WhatsApp
    if (formatted.startsWith('+549')) {
      return formatted
    }

    // Add '9' after country code for WhatsApp format
    formatted = '+549' + formatted.substring(3)

    // Remove '15' prefix if it exists after the area code.
    // Area codes in Argentina are typically 2, 3, or 4 digits.
    // We look for: +549 + (2-4 digits) + 15 + (rest)
    // If matched, we remove the '15'.
    const match = formatted.match(/^(\+549)(\d{2,4})15(\d+)$/)
    if (match) {
      // Reconstruct: +549 + AreaCode + Rest
      return match[1] + match[2] + match[3]
    }

    return formatted
  }

  return formatted
}
