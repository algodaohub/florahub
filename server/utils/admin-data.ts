import { pbQuote } from './pocketbase'

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'] as const
export const PAYMENT_STATUSES = ['pending', 'cod', 'paid', 'refunded'] as const
export const PRODUCT_STATUSES = ['published', 'draft', 'archived'] as const
export const PRODUCT_TYPES = ['physical', 'digital', 'service'] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export type ProductType = (typeof PRODUCT_TYPES)[number]

export function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.includes(String(value) as OrderStatus)
}

export function isProductType(value: unknown): value is ProductType {
  return PRODUCT_TYPES.includes(String(value) as ProductType)
}

/** `''` = đơn cũ chưa có thông tin thanh toán. */
export function isPaymentStatus(value: unknown): value is PaymentStatus | '' {
  const normalized = String(value ?? '')
  return normalized === '' || PAYMENT_STATUSES.includes(normalized as PaymentStatus)
}

export function isProductStatus(value: unknown): value is ProductStatus {
  return PRODUCT_STATUSES.includes(String(value) as ProductStatus)
}

export function parsePaging(event: any, defaultPerPage = 25) {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const perPage = Math.min(100, Math.max(1, Number(query.perPage ?? defaultPerPage) || defaultPerPage))
  return { page, perPage }
}

/** Tìm gần đúng trên nhiều field; trả null khi không có từ khoá. */
export function searchFilter(fields: string[], q: string) {
  const needle = q.trim()
  if (!needle) return null
  const value = pbQuote(needle)
  return fields.map((field) => `${field} ~ ${value}`).join(' || ')
}

export function combineFilters(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part)).join(' && ')
}

export function toText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function toBool(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export type ProductHighlight = { title: string; description: string }
export type ProductFaqItem = { question: string; answer: string }

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** Chuẩn hoá "điểm nổi bật" (JSON) từ form hoặc PocketBase. */
export function toHighlights(value: unknown, limit = 10): ProductHighlight[] {
  return jsonArray(value)
    .slice(0, limit)
    .map((item) => {
      if (typeof item === 'string') return { title: toText(item, 120), description: '' }
      const record = (item ?? {}) as Record<string, unknown>
      return { title: toText(record.title, 120), description: toText(record.description, 300) }
    })
    .filter((item) => item.title || item.description)
}

/** Chuẩn hoá FAQ (JSON) dùng cho AEO + JSON-LD FAQPage. */
export function toFaq(value: unknown, limit = 20): ProductFaqItem[] {
  return jsonArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>
      return { question: toText(record.question, 200), answer: toText(record.answer, 1500) }
    })
    .filter((item) => item.question && item.answer)
}
