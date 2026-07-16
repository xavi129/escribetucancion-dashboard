const DEFAULT_CURRENCY_TO_MXN: Record<string, number> = {
  MXN: 1,
  USD: 17.2,
  EUR: 20.25,
  COP: 0.0044,
  BRL: 3.15,
  ARS: 0.015,
  CLP: 0.0185,
  PEN: 4.7,
  CRC: 0.034,
  PAB: 17.2,
  GTQ: 2.24,
  UYU: 0.43,
  BOB: 2.49,
  PYG: 0.0023,
  DOP: 0.29,
  HNL: 0.66,
  NIO: 0.47,
}

export function normalizeCurrency(currency?: string | null): string {
  return (currency || 'MXN').trim().toUpperCase() || 'MXN'
}

function parseRate(value: string | undefined): number | null {
  if (!value) return null

  const rate = Number(value)
  if (!Number.isFinite(rate) || rate <= 0) return null

  return rate
}

export function getCurrencyToMXNRate(currency?: string | null): number {
  const normalizedCurrency = normalizeCurrency(currency)
  if (normalizedCurrency === 'MXN') return 1

  return (
    parseRate(process.env[`CURRENCY_TO_MXN_${normalizedCurrency}`]) ||
    DEFAULT_CURRENCY_TO_MXN[normalizedCurrency] ||
    1
  )
}

export function convertCurrencyToMXN(amount: number | null | undefined, currency?: string | null): number {
  return (amount || 0) * getCurrencyToMXNRate(currency)
}
