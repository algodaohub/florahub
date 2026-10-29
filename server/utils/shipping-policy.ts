import type { StoreConfig, StoreShippingPolicy } from '~/types/store'
import type { ShippingPublicPolicy, ShippingQuoteOption } from '~/types/shipping'
import { getStoreConfig } from './store'

export async function readStoreShippingPolicy(
  event?: any,
  config?: StoreConfig
): Promise<StoreShippingPolicy> {
  const store = config ?? (await getStoreConfig(event)).config
  return store.shipping
}

export function publicShippingPolicy(policy: StoreShippingPolicy, codEnabled: boolean): ShippingPublicPolicy {
  return {
    enabled: policy.enabled,
    allowCustomerChoice: policy.allowCustomerChoice,
    freeShippingThreshold: policy.freeShippingThreshold,
    fallbackBehavior: policy.fallbackBehavior,
    fallbackFee: policy.fallbackFee,
    codEnabled: Boolean(codEnabled),
    showEta: policy.showEta,
    showSuccessRate: policy.showSuccessRate,
    maxOptions: policy.maxOptions
  }
}

export type CustomerFee = {
  carrierFee: number
  markedUpFee: number
  customerFee: number
  freeShipping: boolean
  threshold: number
  remaining: number
}

/** Giá khách trả: cộng markup rồi áp ngưỡng freeship trên giá trị hàng sau giảm giá. */
export function computeCustomerFee(
  policy: StoreShippingPolicy,
  carrierFee: number,
  netMerchandise: number
): CustomerFee {
  const fee = Math.max(0, Math.round(Number(carrierFee) || 0))
  const markup = Math.min(100, Math.max(0, Number(policy.markupPercent) || 0))
  const markedUpFee = Math.round(fee * (1 + markup / 100))
  const threshold = Math.max(0, Math.round(Number(policy.freeShippingThreshold) || 0))
  const freeShipping = threshold > 0 && netMerchandise >= threshold
  return {
    carrierFee: fee,
    markedUpFee,
    customerFee: freeShipping ? 0 : markedUpFee,
    freeShipping,
    threshold,
    remaining: freeShipping || threshold === 0 ? 0 : Math.max(0, threshold - netMerchandise)
  }
}

/** Xếp hạng ETA thô từ chuỗi dự kiến giao; số càng nhỏ càng nhanh. */
function etaRank(eta: string) {
  const match = String(eta ?? '').match(/(\d+([.,]\d+)?)/)
  if (!match) return Number.POSITIVE_INFINITY
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

export function carrierAllowed(policy: StoreShippingPolicy, carrier: string) {
  const code = String(carrier ?? '').trim().toLowerCase()
  if (!code) return true
  if (policy.blockedCarriers.includes(code)) return false
  if (policy.allowedCarriers.length > 0) return policy.allowedCarriers.includes(code)
  return true
}

export function filterOptions<T extends ShippingQuoteOption>(policy: StoreShippingPolicy, options: T[]): T[] {
  return options.filter((option) => carrierAllowed(policy, option.carrier))
}

/** Gán badge và sắp theo chiến lược tự chọn của shop. */
export function rankOptions<T extends ShippingQuoteOption>(policy: StoreShippingPolicy, options: T[]): T[] {
  const sorted = [...options]
  const byFee = (a: ShippingQuoteOption, b: ShippingQuoteOption) => a.fee - b.fee
  const byEta = (a: ShippingQuoteOption, b: ShippingQuoteOption) =>
    etaRank(a.eta) - etaRank(b.eta) || byFee(a, b)

  if (policy.autoStrategy === 'fastest') sorted.sort(byEta)
  else if (policy.autoStrategy === 'preferred' && policy.preferredCarrier) {
    const preferred = policy.preferredCarrier.toLowerCase()
    sorted.sort((a, b) => {
      const aMatch = a.carrier.toLowerCase() === preferred ? 0 : 1
      const bMatch = b.carrier.toLowerCase() === preferred ? 0 : 1
      return aMatch - bMatch || byFee(a, b)
    })
  } else {
    sorted.sort(byFee)
  }

  if (sorted.length === 0) return sorted

  const cheapest = Math.min(...sorted.map((option) => option.fee))
  const fastest = sorted.reduce((best, option) =>
    etaRank(option.eta) < etaRank(best.eta) ? option : best
  )

  return sorted.map((option, index) => {
    const badges = new Set(option.badges)
    if (option.fee === cheapest) badges.add('cheapest')
    if (option.id === fastest.id && Number.isFinite(etaRank(option.eta))) badges.add('fastest')
    if (index === 0) badges.add('recommended')
    return { ...option, badges: [...badges] }
  })
}

export function buildFallbackOption(policy: StoreShippingPolicy): ShippingQuoteOption {
  const fee = Math.max(0, Math.round(Number(policy.fallbackFee) || 0))
  return {
    id: 'opt_fallback',
    carrier: 'shop',
    carrierName: 'Shop tự sắp xếp',
    service: 'Tiêu chuẩn',
    fee,
    feeOriginal: fee,
    customerFee: fee,
    eta: '',
    successRate: null,
    badges: ['fallback'],
    ownAccount: false,
    codFee: 0
  }
}
