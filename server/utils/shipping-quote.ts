import { createHash, randomBytes } from 'node:crypto'
import type { ShippingAddressResolution, ShippingQuote, ShippingQuoteMode, ShippingQuoteOption } from '~/types/shipping'
import type { StoreShippingPolicy } from '~/types/store'
import type { CartWithItems, HydratedCartItem } from './cart'
import { getRates, type GoshipRate } from './goship'
import { calculateDiscount, findActivePromotion } from './promotion'
import { pbCreate, pbGetRecord, pbUpdate, type PbRecord } from './pocketbase'
import { rateAddressFromPickup, resolveCustomerAddress, validatePickup } from './shipping-address'
import {
  buildFallbackOption,
  computeCustomerFee,
  filterOptions,
  rankOptions,
  readStoreShippingPolicy
} from './shipping-policy'
import {
  isGoshipConfigured,
  readShippingSettings,
  type ShippingSettings
} from './shipping-settings'
import { getStoreConfig } from './store'

const QUOTE_COLLECTION = 'shipping_quotes'
const RATE_CACHE_MAX = 200

export type StoredOption = ShippingQuoteOption & { rateId: string }

export type StoredQuote = {
  quoteId: string
  mode: ShippingQuoteMode
  expiresAt: string
  cartId: string
  cartHash: string
  sessionHash: string
  options: StoredOption[]
  selectedOptionId: string
  address: ShippingAddressResolution | null
  addressSignature: string
  parcel: {
    actualWeight: number
    chargeableWeight: number
    length: number
    width: number
    height: number
    amount: number
    cod: number
    physicalCount: number
    missingWeight: boolean
  } | null
  freeShipping: { applied: boolean; threshold: number; remaining: number }
  paymentMethod: string
  codAmount: number
  fallbackReason: string
}

export type CreatedQuote = {
  recordId: string
  quote: ShippingQuote
  stored: StoredQuote
}

type QuoteInput = {
  cart: CartWithItems
  itemIds?: string[]
  address: {
    cityCode?: string
    cityName?: string
    wardCode?: string
    wardName?: string
    districtCode?: string
    street?: string
  }
  paymentMethod?: string
  promoCode?: string
}

type RateCacheEntry = { rates: GoshipRate[]; expiresAt: number }
const rateCache = new Map<string, RateCacheEntry>()
const rateBuckets = new Map<string, number[]>()

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function sessionHash(cartId: string, userId?: string) {
  return sha256(`session:${cartId}:${userId ?? ''}`)
}

function cartHash(items: HydratedCartItem[], subtotal: number, discount: number) {
  const rows = items
    .map((item) => `${item.id}:${item.quantity}:${item.unit_price}`)
    .sort()
    .join('|')
  return sha256(`${rows}|${subtotal}|${discount}`)
}

function addressSignature(address: QuoteInput['address']) {
  return [address.cityCode ?? '', address.wardCode ?? '', address.districtCode ?? ''].join('|')
}

function quoteError(code: string, message: string, statusCode = 409) {
  return createError({ statusCode, statusMessage: message, data: { code } })
}

function physicalItem(item: HydratedCartItem) {
  const product = item.productRecord
  const type = String(product.type ?? 'physical')
  return type === 'physical' && product.requires_shipping !== false
}

export type ParcelBuild = {
  physicalItems: HydratedCartItem[]
  actualWeight: number
  chargeableWeight: number
  length: number
  width: number
  height: number
  amount: number
  physicalCount: number
  missingWeight: boolean
}

/** Chỉ tính hàng vật lý; cộng bao bì, áp cân nặng quy đổi D×R×C/6000. */
export function buildParcel(
  items: HydratedCartItem[],
  settings: ShippingSettings,
  netMerchandise: number
): ParcelBuild {
  const physicalItems = items.filter(physicalItem)
  const { defaultItemWeight, packagingWeight, length, width, height } = settings.parcel

  let actualWeight = 0
  let missingWeight = false
  for (const item of physicalItems) {
    const weight = Number(item.productRecord.weight_grams ?? 0)
    const unit = weight > 0 ? weight : defaultItemWeight
    if (!(weight > 0)) missingWeight = true
    actualWeight += unit * Number(item.quantity ?? 0)
  }
  actualWeight += packagingWeight

  const volumetricWeight = Math.round((length * width * height * 1000) / 6000)
  const chargeableWeight = Math.max(actualWeight, volumetricWeight)

  return {
    physicalItems,
    actualWeight,
    chargeableWeight,
    length,
    width,
    height,
    amount: netMerchandise,
    physicalCount: physicalItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    missingWeight
  }
}

function hitRateLimit(key: string, limit: number) {
  const now = Date.now()
  const windowStart = now - 60_000
  const hits = (rateBuckets.get(key) ?? []).filter((time) => time > windowStart)
  if (hits.length >= limit) {
    rateBuckets.set(key, hits)
    return true
  }
  hits.push(now)
  rateBuckets.set(key, hits)
  return false
}

function rateCacheKey(
  settings: ShippingSettings,
  to: { cityCode: string; districtCode: string },
  parcel: ParcelBuild,
  cod: number
) {
  const pickup = settings.pickup
  return [
    pickup.cityCode,
    pickup.districtCode,
    to.cityCode,
    to.districtCode,
    Math.ceil(parcel.chargeableWeight / 100),
    Math.floor(parcel.amount / 50_000),
    Math.floor(cod / 50_000),
    1
  ].join(':')
}

async function fetchRates(
  settings: ShippingSettings,
  to: { cityCode: string; districtCode: string },
  parcel: ParcelBuild,
  cod: number
) {
  const key = rateCacheKey(settings, to, parcel, cod)
  const hit = rateCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.rates

  const rates = await getRates({
    addressFrom: rateAddressFromPickup(settings),
    addressTo: { city: to.cityCode, district: to.districtCode },
    parcel: {
      cod,
      amount: parcel.amount,
      weight: parcel.chargeableWeight,
      width: parcel.width,
      height: parcel.height,
      length: parcel.length
    }
  })

  if (settings.rateCacheSeconds > 0) {
    if (rateCache.size >= RATE_CACHE_MAX) {
      const oldest = rateCache.keys().next().value
      if (oldest) rateCache.delete(oldest)
    }
    rateCache.set(key, { rates, expiresAt: Date.now() + settings.rateCacheSeconds * 1000 })
  }
  return rates
}

function toStoredOption(rate: GoshipRate, policy: StoreShippingPolicy, netMerchandise: number): StoredOption {
  const fee = computeCustomerFee(policy, rate.totalFee, netMerchandise)
  return {
    id: `opt_${randomBytes(6).toString('hex')}`,
    carrier: rate.carrier,
    carrierName: rate.carrierName || rate.carrier.toUpperCase(),
    service: rate.service,
    fee: fee.carrierFee,
    feeOriginal: fee.markedUpFee,
    customerFee: fee.customerFee,
    eta: rate.expected,
    successRate: rate.successRate,
    badges: [],
    ownAccount: rate.ownAccount,
    codFee: rate.codFee,
    rateId: rate.rateId
  }
}

function publicOption(option: StoredOption): ShippingQuoteOption {
  const { rateId: _rateId, ...rest } = option
  return rest
}

async function persistQuote(input: {
  cart: CartWithItems
  sessionHash: string
  cartHash: string
  options: StoredOption[]
  selectedOptionId: string
  address: ShippingAddressResolution | null
  addressSignature: string
  parcel: StoredQuote['parcel']
  freeShipping: StoredQuote['freeShipping']
  paymentMethod: string
  codAmount: number
  mode: ShippingQuoteMode
  ttlSeconds: number
  fallbackReason: string
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + input.ttlSeconds * 1000).toISOString()
  const record = await pbCreate('shipping_quotes', {
    cart_id: input.cart.id,
    cart_hash: input.cartHash,
    session_hash: input.sessionHash,
    address_from: input.address
      ? { city: input.address.city, cityCode: input.address.cityCode, district: input.address.district, districtCode: input.address.districtCode, ward: input.address.ward, wardCode: input.address.wardCode }
      : null,
    address_to: {
      signature: input.addressSignature,
      ward: input.address?.ward ?? '',
      wardCode: input.address?.wardCode ?? '',
      district: input.address?.district ?? '',
      districtCode: input.address?.districtCode ?? '',
      city: input.address?.city ?? '',
      cityCode: input.address?.cityCode ?? ''
    },
    parcel: input.parcel,
    options: input.options,
    free_shipping_applied: input.freeShipping.applied,
    free_shipping_threshold: input.freeShipping.threshold,
    selected_option_id: input.selectedOptionId,
    payment_method: input.paymentMethod,
    cod_amount: input.codAmount,
    mode: input.mode,
    status: 'active',
    expires_at: expiresAt,
    created_at: now.toISOString(),
    fallback_reason: input.fallbackReason
  })
  return { recordId: String(record.id), expiresAt }
}

function resolvePaymentMethod(value: string | undefined, codEnabled: boolean) {
  const method = String(value ?? '').trim().toLowerCase()
  if (!method) return ''
  if (method === 'cod' && !codEnabled) return ''
  return method
}

/**
 * Tạo báo giá server-side. Client chỉ nhận `optionId` (không `rateId`).
 * Mọi trường hợp không gọi được Goship đều rơi về quote dự phòng theo chính sách shop.
 */
export async function createQuote(event: any, input: QuoteInput): Promise<CreatedQuote> {
  const settings = await readShippingSettings()
  const { config } = await getStoreConfig(event)
  const policy = await readStoreShippingPolicy(event, config)

  const requestedIds = Array.isArray(input.itemIds)
    ? new Set(input.itemIds.map((id) => String(id)).filter(Boolean))
    : null
  const items = requestedIds ? input.cart.items.filter((item) => requestedIds.has(item.id)) : input.cart.items
  if (items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng chọn sản phẩm để tính phí giao' })
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price ?? 0) * Number(item.quantity ?? 0), 0)
  const promoCode = String(input.promoCode ?? '').trim()
  const promotion = promoCode ? await findActivePromotion(promoCode) : null
  const discount = calculateDiscount(promotion, subtotal)
  const netMerchandise = Math.max(0, subtotal - discount)
  const paymentMethod = resolvePaymentMethod(input.paymentMethod, settings.codEnabled)
  const signature = addressSignature(input.address)
  const hash = cartHash(items, subtotal, discount)
  const session = sessionHash(input.cart.id, undefined)
  const freeShipping = computeCustomerFee(policy, 0, netMerchandise)

  const base = {
    cart: input.cart,
    sessionHash: session,
    cartHash: hash,
    addressSignature: signature,
    paymentMethod,
    ttlSeconds: settings.quoteTtlSeconds
  }

  const fallback = async (reason: string, message: string): Promise<CreatedQuote> => {
    const option: StoredOption = { ...buildFallbackOption(policy), rateId: '' }
    const { recordId, expiresAt } = await persistQuote({
      ...base,
      options: policy.fallbackBehavior === 'flat' ? [option] : [],
      selectedOptionId: policy.fallbackBehavior === 'flat' ? option.id : '',
      address: null,
      parcel: null,
      freeShipping: {
        applied: freeShipping.freeShipping,
        threshold: freeShipping.threshold,
        remaining: freeShipping.remaining
      },
      codAmount: 0,
      mode: 'fallback',
      fallbackReason: reason
    })

    return {
      recordId,
      stored: {
        quoteId: recordId,
        mode: 'fallback',
        expiresAt,
        cartId: input.cart.id,
        cartHash: hash,
        sessionHash: session,
        options: policy.fallbackBehavior === 'flat' ? [option] : [],
        selectedOptionId: policy.fallbackBehavior === 'flat' ? option.id : '',
        address: null,
        addressSignature: signature,
        parcel: null,
        freeShipping: { applied: freeShipping.freeShipping, threshold: freeShipping.threshold, remaining: freeShipping.remaining },
        paymentMethod,
        codAmount: 0,
        fallbackReason: reason
      },
      quote: {
        quoteId: recordId,
        expiresAt,
        mode: 'fallback',
        serviceable: false,
        requiresChoice: false,
        selectedOptionId: policy.fallbackBehavior === 'flat' ? option.id : null,
        address: null,
        parcel: null,
        freeShipping: { applied: freeShipping.freeShipping, threshold: freeShipping.threshold, remaining: freeShipping.remaining },
        options: policy.fallbackBehavior === 'flat' ? [publicOption(option)] : [],
        optionCount: policy.fallbackBehavior === 'flat' ? 1 : 0,
        fallback: reason,
        message
      }
    }
  }

  const parcel = buildParcel(items, settings, netMerchandise)
  if (parcel.physicalItems.length === 0) {
    const { recordId, expiresAt } = await persistQuote({
      ...base,
      options: [],
      selectedOptionId: '',
      address: null,
      parcel: null,
      freeShipping: {
        applied: false,
        threshold: freeShipping.threshold,
        remaining: 0
      },
      codAmount: 0,
      mode: 'none',
      fallbackReason: ''
    })
    return {
      recordId,
      stored: {
        quoteId: recordId,
        mode: 'none',
        expiresAt,
        cartId: input.cart.id,
        cartHash: hash,
        sessionHash: session,
        options: [],
        selectedOptionId: '',
        address: null,
        addressSignature: signature,
        parcel: null,
        freeShipping: { applied: false, threshold: freeShipping.threshold, remaining: 0 },
        paymentMethod,
        codAmount: 0,
        fallbackReason: ''
      },
      quote: {
        quoteId: recordId,
        expiresAt,
        mode: 'none',
        serviceable: true,
        requiresChoice: false,
        selectedOptionId: null,
        address: null,
        parcel: null,
        freeShipping: { applied: false, threshold: freeShipping.threshold, remaining: 0 },
        options: [],
        optionCount: 0,
        fallback: null,
        message: 'Đơn hàng không cần giao hàng'
      }
    }
  }

  // Chưa bật hoặc chưa cấu hình thì không cần tra danh mục Goship — trả phí dự phòng ngay.
  if (!policy.enabled) {
    return fallback('policy-disabled', 'Phí giao hàng theo chính sách cửa hàng.')
  }
  if (!isGoshipConfigured(settings)) {
    return fallback('not-configured', 'Phí giao hàng tạm tính, shop sẽ xác nhận khi giao.')
  }

  const address = await resolveCustomerAddress({
    cityCode: input.address.cityCode,
    cityName: input.address.cityName,
    wardCode: input.address.wardCode,
    wardName: input.address.wardName,
    districtCode: input.address.districtCode
  }).catch((error) => {
    console.warn('[shipping-quote] không tra được địa chỉ Goship', error instanceof Error ? error.message : error)
    return null
  })

  if (!address) {
    return fallback('address-unresolved', 'Chưa xác định được địa chỉ giao hàng trong danh mục vận chuyển.')
  }

  if (address.resolution === 'ambiguous') {
    const { recordId, expiresAt } = await persistQuote({
      ...base,
      options: [],
      selectedOptionId: '',
      address,
      parcel: {
        actualWeight: parcel.actualWeight,
        chargeableWeight: parcel.chargeableWeight,
        length: parcel.length,
        width: parcel.width,
        height: parcel.height,
        amount: parcel.amount,
        cod: 0,
        physicalCount: parcel.physicalCount,
        missingWeight: parcel.missingWeight
      },
      freeShipping: {
        applied: freeShipping.freeShipping,
        threshold: freeShipping.threshold,
        remaining: freeShipping.remaining
      },
      codAmount: 0,
      mode: 'live',
      fallbackReason: ''
    })
    return {
      recordId,
      stored: {
        quoteId: recordId,
        mode: 'live',
        expiresAt,
        cartId: input.cart.id,
        cartHash: hash,
        sessionHash: session,
        options: [],
        selectedOptionId: '',
        address,
        addressSignature: signature,
        parcel: null,
        freeShipping: { applied: freeShipping.freeShipping, threshold: freeShipping.threshold, remaining: freeShipping.remaining },
        paymentMethod,
        codAmount: 0,
        fallbackReason: ''
      },
      quote: {
        quoteId: recordId,
        expiresAt,
        mode: 'live',
        serviceable: false,
        requiresChoice: false,
        selectedOptionId: null,
        address,
        parcel: {
          actualWeight: parcel.actualWeight,
          chargeableWeight: parcel.chargeableWeight,
          length: parcel.length,
          width: parcel.width,
          height: parcel.height
        },
        freeShipping: { applied: freeShipping.freeShipping, threshold: freeShipping.threshold, remaining: freeShipping.remaining },
        options: [],
        optionCount: 0,
        fallback: null,
        message: 'Phường/xã này thuộc nhiều quận/huyện, vui lòng chọn quận/huyện.'
      }
    }
  }

  const rateLimited =
    hitRateLimit(`ip:${getRequestIP(event, { xForwardedFor: true }) || 'unknown'}`, settings.quoteRateLimitPerMinute) ||
    hitRateLimit(`cart:${input.cart.id}`, Math.max(1, Math.floor(settings.quoteRateLimitPerMinute / 2)))

  if (address.resolution !== 'resolved') {
    return fallback('address-unresolved', 'Chưa xác định được địa chỉ giao hàng trong danh mục vận chuyển.')
  }
  if (rateLimited) {
    if (policy.fallbackBehavior !== 'flat') {
      throw createError({
        statusCode: 429,
        statusMessage: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'
      })
    }
    return fallback('rate-limited', 'Tạm thời dùng phí giao dự phòng, shop sẽ xác nhận khi giao.')
  }

  try {
    validatePickup(settings)
  } catch (error: any) {
    return fallback('pickup-missing', error?.statusMessage || 'Shop chưa cấu hình địa chỉ lấy hàng.')
  }

  const to = { cityCode: address.cityCode, districtCode: address.districtCode }
  let cod = paymentMethod === 'cod' ? netMerchandise : 0

  const prepare = (rates: GoshipRate[]) => {
    const options = filterOptions(
      policy,
      rates.map((rate) => toStoredOption(rate, policy, netMerchandise))
    )
    return rankOptions(policy, options)
  }

  let options: StoredOption[] = []
  try {
    options = prepare(await fetchRates(settings, to, parcel, cod))
    if (cod > 0 && options.length > 0) {
      const provisional = options[0]!.customerFee
      const recoded = cod + provisional
      const rates = await fetchRates(settings, to, parcel, recoded)
      const recodedOptions = prepare(rates)
      if (recodedOptions.length > 0) {
        cod = recoded
        options = recodedOptions
      }
    }
  } catch (error: any) {
    console.warn('[shipping-quote] Goship /rates lỗi', error?.statusMessage || error?.message || error)
    if (policy.fallbackBehavior !== 'flat') {
      return fallback('rates-error', 'Hiện chưa thể tính phí giao đến khu vực này, vui lòng liên hệ shop.')
    }
    return fallback('rates-error', 'Tạm thời dùng phí giao dự phòng, shop sẽ xác nhận khi giao.')
  }

  if (options.length === 0) {
    return fallback('no-options', 'Chưa có hãng vận chuyển phù hợp cho đơn này.')
  }

  const selectedOptionId = options[0]!.id
  const parcelSnapshot = {
    actualWeight: parcel.actualWeight,
    chargeableWeight: parcel.chargeableWeight,
    length: parcel.length,
    width: parcel.width,
    height: parcel.height,
    amount: parcel.amount,
    cod,
    physicalCount: parcel.physicalCount,
    missingWeight: parcel.missingWeight
  }

  const { recordId, expiresAt } = await persistQuote({
    ...base,
    options,
    selectedOptionId,
    address,
    parcel: parcelSnapshot,
    freeShipping: {
      applied: freeShipping.freeShipping,
      threshold: freeShipping.threshold,
      remaining: freeShipping.remaining
    },
    codAmount: cod,
    mode: 'live',
    fallbackReason: ''
  })

  const publicOptions = options.map(publicOption)
  const stored: StoredQuote = {
    quoteId: recordId,
    mode: 'live',
    expiresAt,
    cartId: input.cart.id,
    cartHash: hash,
    sessionHash: session,
    options,
    selectedOptionId,
    address,
    addressSignature: signature,
    parcel: parcelSnapshot,
    freeShipping: { applied: freeShipping.freeShipping, threshold: freeShipping.threshold, remaining: freeShipping.remaining },
    paymentMethod,
    codAmount: cod,
    fallbackReason: ''
  }

  return {
    recordId,
    stored,
    quote: {
      quoteId: recordId,
      expiresAt,
      mode: 'live',
      serviceable: true,
      requiresChoice: policy.allowCustomerChoice && publicOptions.length > 1,
      selectedOptionId,
      address,
      parcel: {
        actualWeight: parcel.actualWeight,
        chargeableWeight: parcel.chargeableWeight,
        length: parcel.length,
        width: parcel.width,
        height: parcel.height
      },
      freeShipping: { applied: freeShipping.freeShipping, threshold: freeShipping.threshold, remaining: freeShipping.remaining },
      options: publicOptions,
      optionCount: publicOptions.length,
      fallback: null,
      message: freeShipping.freeShipping ? 'Đơn hàng được miễn phí giao hàng.' : ''
    }
  }
}

export type QuoteValidationInput = {
  quoteId: string
  optionId?: string
  cart: CartWithItems
  itemIds?: string[]
  subtotal: number
  discount: number
  address?: QuoteInput['address']
}

export type ValidatedQuote = {
  recordId: string
  mode: ShippingQuoteMode
  option: StoredOption
  address: ShippingAddressResolution | null
  parcel: {
    actualWeight: number
    chargeableWeight: number
    length: number
    width: number
    height: number
    amount: number
    cod: number
  } | null
  shippingTotal: number
  carrierFee: number
  freeShipping: boolean
  cod: number
}

function recordOptions(record: PbRecord): StoredOption[] {
  return Array.isArray(record.options) ? (record.options as StoredOption[]) : []
}

function recordAddress(record: PbRecord): ShippingAddressResolution | null {
  const source = record.address_to
  if (!source || typeof source !== 'object') return null
  const cityCode = String((source as any).cityCode ?? '')
  if (!cityCode) return null
  return {
    resolution: 'resolved',
    city: String((source as any).city ?? ''),
    cityCode,
    district: String((source as any).district ?? ''),
    districtCode: String((source as any).districtCode ?? ''),
    ward: String((source as any).ward ?? ''),
    wardCode: String((source as any).wardCode ?? ''),
    districtOptions: []
  }
}

/**
 * Xác thực quote trước khi tạo đơn: session, giỏ hàng, hạn dùng, option và địa chỉ.
 * Sai lệch → 409 kèm `data.code` để checkout báo lại giá một lần.
 */
export async function validateQuote(event: any, input: QuoteValidationInput): Promise<ValidatedQuote> {
  const record = await pbGetRecord<PbRecord>(QUOTE_COLLECTION, input.quoteId)
  if (!record) throw quoteError('SHIPPING_QUOTE_EXPIRED', 'Phí giao đã hết hạn, vui lòng tính lại')

  const status = String(record.status ?? '')
  if (status === 'used') throw quoteError('SHIPPING_QUOTE_USED', 'Phí giao đã được dùng, vui lòng tính lại')
  if (status !== 'active') throw quoteError('SHIPPING_QUOTE_EXPIRED', 'Phí giao đã hết hạn, vui lòng tính lại')

  const expiresAt = String(record.expires_at ?? '')
  if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
    await pbUpdate(QUOTE_COLLECTION, String(record.id), { status: 'expired' }).catch(() => undefined)
    throw quoteError('SHIPPING_QUOTE_EXPIRED', 'Phí giao đã hết hạn, vui lòng tính lại')
  }

  if (String(record.session_hash ?? '') !== sessionHash(input.cart.id, undefined)) {
    throw quoteError('SHIPPING_QUOTE_STALE', 'Phiên thanh toán đã thay đổi, vui lòng tính lại phí giao')
  }

  const requestedIds = input.itemIds?.length
    ? new Set(input.itemIds.map((id) => String(id)))
    : null
  const hash = cartHash(
    requestedIds ? input.cart.items.filter((item) => requestedIds.has(item.id)) : input.cart.items,
    input.subtotal,
    input.discount
  )
  if (String(record.cart_hash ?? '') !== hash) {
    throw quoteError('SHIPPING_QUOTE_STALE', 'Giỏ hàng hoặc giá trị đơn đã thay đổi, vui lòng tính lại phí giao')
  }

  const netMerchandise = Math.max(0, input.subtotal - input.discount)
  const parcel = (record.parcel ?? {}) as any
  if (parcel?.amount !== undefined && Number(parcel.amount) !== netMerchandise) {
    throw quoteError('SHIPPING_QUOTE_STALE', 'Giá trị đơn đã thay đổi, vui lòng tính lại phí giao')
  }

  if (input.address) {
    const stored = (record.address_to ?? {}) as any
    if (String(stored.signature ?? '') !== addressSignature(input.address)) {
      throw quoteError('SHIPPING_QUOTE_STALE', 'Địa chỉ giao hàng đã thay đổi, vui lòng tính lại phí giao')
    }
  }

  const options = recordOptions(record)
  if (options.length === 0) {
    throw quoteError('SHIPPING_QUOTE_STALE', 'Không tìm thấy phương án vận chuyển, vui lòng tính lại')
  }

  const optionId = String(input.optionId ?? record.selected_option_id ?? '')
  const option = options.find((item) => item.id === optionId)
  if (!option) {
    throw quoteError('SHIPPING_QUOTE_STALE', 'Phương án vận chuyển không còn hiệu lực, vui lòng tính lại')
  }

  return {
    recordId: String(record.id),
    mode: (record.mode as ShippingQuoteMode) ?? 'live',
    option,
    address: recordAddress(record),
    parcel: parcel && parcel.chargeableWeight !== undefined
      ? {
          actualWeight: Number(parcel.actualWeight ?? 0),
          chargeableWeight: Number(parcel.chargeableWeight ?? 0),
          length: Number(parcel.length ?? 0),
          width: Number(parcel.width ?? 0),
          height: Number(parcel.height ?? 0),
          amount: Number(parcel.amount ?? 0),
          cod: Number(parcel.cod ?? 0)
        }
      : null,
    shippingTotal: Math.max(0, Math.round(Number(option.customerFee ?? 0))),
    carrierFee: Math.max(0, Math.round(Number(option.fee ?? 0))),
    freeShipping: record.free_shipping_applied === true,
    cod: Math.max(0, Math.round(Number(record.cod_amount ?? 0)))
  }
}

export async function markQuoteUsed(recordId: string, orderId: string) {
  if (!recordId) return
  await pbUpdate(QUOTE_COLLECTION, recordId, {
    status: 'used',
    order: orderId,
    used_at: new Date().toISOString()
  }).catch(() => undefined)
}
