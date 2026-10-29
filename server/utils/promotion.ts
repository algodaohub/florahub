import { pbFirst, pbQuote, type PbRecord } from './pocketbase'

export async function findActivePromotion(code: string) {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  return pbFirst<PbRecord>('promotions', {
    filter: `code = ${pbQuote(normalized)} && active = true`
  })
}

export function calculateDiscount(
  promotion: Record<string, any> | null,
  subtotal: number
): number {
  if (!promotion || subtotal <= 0) return 0
  const value = Number(promotion.value ?? 0)
  if (promotion.type === 'percentage') {
    return Math.min(subtotal, Math.round((subtotal * value) / 100))
  }
  if (promotion.type === 'fixed') {
    return Math.min(subtotal, Math.max(0, value))
  }
  return 0
}
