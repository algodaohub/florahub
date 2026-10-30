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

const SHIPPING_FEE_STEP = 1000

/** Cước khách trả làm tròn lên bội số 1.000đ để số tiền dễ đọc và không thu thiếu. */
export function roundShippingFee(value: number): number {
  const fee = Math.max(0, Math.round(Number(value) || 0))
  if (fee === 0) return 0
  return Math.ceil(fee / SHIPPING_FEE_STEP) * SHIPPING_FEE_STEP
}

/** Giá khách trả: cộng markup, làm tròn cước rồi áp ngưỡng freeship trên giá trị hàng sau giảm giá. */
export function computeCustomerFee(
  policy: StoreShippingPolicy,
  carrierFee: number,
  netMerchandise: number
): CustomerFee {
  const fee = Math.max(0, Math.round(Number(carrierFee) || 0))
  const markup = Math.min(100, Math.max(0, Number(policy.markupPercent) || 0))
  const markedUpFee = roundShippingFee(fee * (1 + markup / 100))
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

/** Chuẩn hoá mã/tên hãng: bỏ dấu, khoảng trắng và ký tự phân cách để so khớp linh hoạt. */
function normalizeCarrier(value: string) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
}

function matchesCarrier(preferred: string, option: ShippingQuoteOption) {
  const target = normalizeCarrier(preferred)
  if (!target) return false
  return normalizeCarrier(option.carrier) === target || normalizeCarrier(option.carrierName) === target
}

/** Hãng ưu tiên đang có trong danh sách báo giá (khớp cả mã hãng lẫn tên hiển thị). */
export function findPreferredOption<T extends ShippingQuoteOption>(
  policy: StoreShippingPolicy,
  options: T[]
): T | undefined {
  const preferred = String(policy.preferredCarrier ?? '').trim()
  if (!preferred) return undefined
  return options.find((option) => matchesCarrier(preferred, option))
}

/** Chọn phương án mặc định: hãng ưu tiên trước, sau đó theo chiến lược nhanh nhất / rẻ nhất. */
export function selectAutoOption<T extends ShippingQuoteOption>(
  policy: StoreShippingPolicy,
  options: T[]
): T | null {
  if (options.length === 0) return null
  const preferred = findPreferredOption(policy, options)
  if (preferred) return preferred
  if (policy.autoStrategy === 'fastest') {
    return options.reduce((best, option) => (etaRank(option.eta) < etaRank(best.eta) ? option : best))
  }
  return options.reduce((best, option) => (option.fee < best.fee ? option : best))
}

/** Gán badge và sắp theo hãng ưu tiên rồi chiến lược tự chọn của shop. */
export function rankOptions<T extends ShippingQuoteOption>(policy: StoreShippingPolicy, options: T[]): T[] {
  const sorted = [...options]
  const byFee = (a: ShippingQuoteOption, b: ShippingQuoteOption) => a.fee - b.fee
  const byEta = (a: ShippingQuoteOption, b: ShippingQuoteOption) =>
    etaRank(a.eta) - etaRank(b.eta) || byFee(a, b)

  sorted.sort(policy.autoStrategy === 'fastest' ? byEta : byFee)

  const preferred = findPreferredOption(policy, sorted)
  if (preferred) {
    const index = sorted.indexOf(preferred)
    if (index > 0) {
      sorted.splice(index, 1)
      sorted.unshift(preferred)
    }
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

/** Phí dự phòng khách trả: phí shop tự đặt nên chỉ áp ngưỡng freeship, không cộng markup hãng. */
export function fallbackShippingFee(policy: StoreShippingPolicy, netMerchandise = 0): number {
  const threshold = Math.max(0, Math.round(Number(policy.freeShippingThreshold) || 0))
  if (threshold > 0 && netMerchandise >= threshold) return 0
  return roundShippingFee(policy.fallbackFee)
}

export function buildFallbackOption(policy: StoreShippingPolicy, netMerchandise = 0): ShippingQuoteOption {
  const fee = Math.max(0, Math.round(Number(policy.fallbackFee) || 0))
  return {
    id: 'opt_fallback',
    carrier: 'shop',
    carrierName: 'Shop tự sắp xếp',
    service: 'Tiêu chuẩn',
    fee,
    feeOriginal: fee,
    customerFee: fallbackShippingFee(policy, netMerchandise),
    eta: '',
    successRate: null,
    badges: ['fallback'],
    ownAccount: false,
    codFee: 0
  }
}
