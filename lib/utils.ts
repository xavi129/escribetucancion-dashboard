import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extrae el primer nombre de un nombre completo
 * Ejemplo: "Titular de ejemplo" -> "Javier"
 */
export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName || typeof fullName !== 'string') return 'cliente'
  
  const trimmed = fullName.trim()
  if (!trimmed) return 'cliente'
  
  // Tomar la primera palabra (antes del primer espacio)
  const firstName = trimmed.split(/\s+/)[0]
  
  // Capitalizar la primera letra
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
}
