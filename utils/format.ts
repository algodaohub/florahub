let money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
})

export function setMoneyFormat(currency: string, locale: string) {
  try {
    money = new Intl.NumberFormat(locale || 'vi-VN', {
      style: 'currency',
      currency: currency || 'VND',
      maximumFractionDigits: currency === 'VND' ? 0 : 2
    })
  } catch {
    money = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    })
  }
}

export function formatVnd(value: number): string {
  return money.format(Math.round(value))
}

/** PocketBase trả "YYYY-MM-DD HH:mm:ss.sssZ"; Safari cần 'T' thay cho dấu cách. */
function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value.replace(' ', 'T')) : value
}

export function formatDate(value: string | Date): string {
  const date = toDate(value)
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function formatDateTimeNumeric(value: string | Date): string {
  const date = toDate(value)
  const datePart = new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  }).format(date)
  const timePart = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
  return `${datePart} ${timePart}`
}

export function formatOrderCode(value: string): string {
  return `ORD-${value.slice(-6).toUpperCase()}`
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export function parseOptions(json: string): Array<{ name: string; value: string }> {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function discountPercent(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price) return 0
  return Math.round(((compareAt - price) / compareAt) * 100)
}
