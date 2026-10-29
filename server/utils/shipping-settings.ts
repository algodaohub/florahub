import type { StoreShippingPolicy } from '~/types/store'
import type { PublicShippingSettings } from '~/types/shipping'
import { pbCreate, pbFirst, pbUpdate, type PbRecord } from './pocketbase'

export const SHIPPING_SETTINGS_COLLECTION = 'shipping_settings'
export const SHIPPING_SETTINGS_SCOPE = 'default'
export const GOSHIP_SANDBOX_BASE_URL = 'https://sandbox.goship.io/api/v2'
export const GOSHIP_PRODUCTION_BASE_URL = 'https://api.goship.io/api/v2'
const CACHE_TTL = 30_000
const MAX_FIELD_LENGTH = 4000

export type ShippingAddressFallback = 'flat' | 'ask_district' | 'block'

export type ShippingSettings = {
  enabled: boolean
  accessToken: string
  clientId: string
  clientSecret: string
  apiBaseUrl: string
  webhookId: string
  webhookUrl: string
  pickup: {
    name: string
    phone: string
    street: string
    ward: string
    district: string
    city: string
    wardCode: string
    districtCode: string
    cityCode: string
  }
  parcel: {
    defaultWeight: number
    defaultItemWeight: number
    packagingWeight: number
    length: number
    width: number
    height: number
  }
  codEnabled: boolean
  autoAdvance: boolean
  quoteTtlSeconds: number
  rateCacheSeconds: number
  quoteRateLimitPerMinute: number
  addressFallback: ShippingAddressFallback
  lastVerifiedAt: string
}

export type ShippingReadiness = {
  api: boolean
  webhook: boolean
  pickup: boolean
  policy: boolean
}

type ShippingRecord = PbRecord & {
  scope?: string
  enabled?: boolean
  goship_access_token?: string
  goship_client_id?: string
  goship_client_secret?: string
  goship_api_base_url?: string
  goship_webhook_id?: string
  goship_webhook_url?: string
  pickup_name?: string
  pickup_phone?: string
  pickup_street?: string
  pickup_ward?: string
  pickup_district?: string
  pickup_city?: string
  pickup_ward_code?: string
  pickup_district_code?: string
  pickup_city_code?: string
  default_weight?: number
  default_item_weight?: number
  packaging_weight?: number
  default_length?: number
  default_width?: number
  default_height?: number
  cod_enabled?: boolean
  auto_advance?: boolean
  quote_ttl_seconds?: number
  rate_cache_seconds?: number
  quote_rate_limit_per_minute?: number
  address_fallback?: string
  last_verified_at?: string
}

function text(value: unknown) {
  return String(value ?? '').trim().slice(0, MAX_FIELD_LENGTH)
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function emptySettings(): ShippingSettings {
  return {
    enabled: false,
    accessToken: '',
    clientId: '',
    clientSecret: '',
    apiBaseUrl: GOSHIP_SANDBOX_BASE_URL,
    webhookId: '',
    webhookUrl: '',
    pickup: { name: '', phone: '', street: '', ward: '', district: '', city: '', wardCode: '', districtCode: '', cityCode: '' },
    parcel: { defaultWeight: 1000, defaultItemWeight: 500, packagingWeight: 100, length: 30, width: 20, height: 15 },
    codEnabled: true,
    autoAdvance: true,
    quoteTtlSeconds: 600,
    rateCacheSeconds: 45,
    quoteRateLimitPerMinute: 20,
    addressFallback: 'flat',
    lastVerifiedAt: ''
  }
}

function fallbackValue(value: unknown): ShippingAddressFallback {
  return value === 'block' || value === 'ask_district' ? value : 'flat'
}

function recordToSettings(record: ShippingRecord | null): ShippingSettings {
  const defaults = emptySettings()
  if (!record) return defaults
  return {
    enabled: record.enabled === true,
    accessToken: text(record.goship_access_token),
    clientId: text(record.goship_client_id),
    clientSecret: text(record.goship_client_secret),
    apiBaseUrl: text(record.goship_api_base_url) || defaults.apiBaseUrl,
    webhookId: text(record.goship_webhook_id),
    webhookUrl: text(record.goship_webhook_url),
    pickup: {
      name: text(record.pickup_name),
      phone: text(record.pickup_phone),
      street: text(record.pickup_street),
      ward: text(record.pickup_ward),
      district: text(record.pickup_district),
      city: text(record.pickup_city),
      wardCode: text(record.pickup_ward_code),
      districtCode: text(record.pickup_district_code),
      cityCode: text(record.pickup_city_code)
    },
    parcel: {
      defaultWeight: clamp(record.default_weight, 0, 1_000_000, defaults.parcel.defaultWeight),
      defaultItemWeight: clamp(record.default_item_weight, 0, 1_000_000, defaults.parcel.defaultItemWeight),
      packagingWeight: clamp(record.packaging_weight, 0, 100_000, defaults.parcel.packagingWeight),
      length: clamp(record.default_length, 1, 200, defaults.parcel.length),
      width: clamp(record.default_width, 1, 200, defaults.parcel.width),
      height: clamp(record.default_height, 1, 200, defaults.parcel.height)
    },
    codEnabled: record.cod_enabled !== false,
    autoAdvance: record.auto_advance !== false,
    quoteTtlSeconds: clamp(record.quote_ttl_seconds, 60, 1800, defaults.quoteTtlSeconds),
    rateCacheSeconds: clamp(record.rate_cache_seconds, 0, 3600, defaults.rateCacheSeconds),
    quoteRateLimitPerMinute: clamp(record.quote_rate_limit_per_minute, 1, 600, defaults.quoteRateLimitPerMinute),
    addressFallback: fallbackValue(record.address_fallback),
    lastVerifiedAt: text(record.last_verified_at)
  }
}

let cache: { settings: ShippingSettings; expiresAt: number } | null = null
let loading: Promise<ShippingSettings> | null = null

export function invalidateShippingSettings() {
  cache = null
}

export async function readShippingSettings(): Promise<ShippingSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.settings
  if (!loading) {
    loading = (async () => {
      let settings = emptySettings()
      try {
        const record = await pbFirst<ShippingRecord>(SHIPPING_SETTINGS_COLLECTION, {
          filter: `scope = "${SHIPPING_SETTINGS_SCOPE}"`,
          perPage: 1
        })
        settings = recordToSettings(record)
      } catch {
        // Chưa migrate collection hoặc PB tạm lỗi — coi như chưa cấu hình.
      }
      cache = { settings, expiresAt: Date.now() + CACHE_TTL }
      return settings
    })().finally(() => {
      loading = null
    })
  }
  return loading
}

export function pickupComplete(settings: ShippingSettings) {
  const pickup = settings.pickup
  return Boolean(
    pickup.name && pickup.phone && pickup.street && pickup.wardCode && pickup.districtCode && pickup.cityCode
  )
}

export function shippingReadiness(settings: ShippingSettings, policy?: StoreShippingPolicy): ShippingReadiness {
  return {
    api: Boolean(settings.enabled && settings.accessToken),
    webhook: Boolean(settings.clientSecret && (settings.webhookId || settings.webhookUrl)),
    pickup: pickupComplete(settings),
    policy: policy ? policy.enabled : false
  }
}

export function isGoshipConfigured(settings: ShippingSettings) {
  return Boolean(settings.enabled && settings.accessToken && pickupComplete(settings))
}

function mask(value: string) {
  return value ? `••••${value.slice(-4)}` : ''
}

export function publicShippingSettings(
  settings: ShippingSettings,
  policy: StoreShippingPolicy
): PublicShippingSettings {
  return {
    enabled: settings.enabled,
    apiBaseUrl: settings.apiBaseUrl,
    accessToken: { has: Boolean(settings.accessToken), hint: mask(settings.accessToken) },
    clientId: settings.clientId,
    clientSecret: { has: Boolean(settings.clientSecret), hint: mask(settings.clientSecret) },
    pickup: { ...settings.pickup },
    parcel: { ...settings.parcel },
    codEnabled: settings.codEnabled,
    autoAdvance: settings.autoAdvance,
    quoteTtlSeconds: settings.quoteTtlSeconds,
    rateCacheSeconds: settings.rateCacheSeconds,
    quoteRateLimitPerMinute: settings.quoteRateLimitPerMinute,
    addressFallback: settings.addressFallback,
    webhook: { id: settings.webhookId, url: settings.webhookUrl },
    lastVerifiedAt: settings.lastVerifiedAt,
    readiness: shippingReadiness(settings, policy),
    policy: {
      enabled: policy.enabled,
      allowCustomerChoice: policy.allowCustomerChoice,
      freeShippingThreshold: policy.freeShippingThreshold,
      fallbackBehavior: policy.fallbackBehavior,
      fallbackFee: policy.fallbackFee,
      codEnabled: settings.codEnabled,
      showEta: policy.showEta,
      showSuccessRate: policy.showSuccessRate,
      maxOptions: policy.maxOptions,
      autoStrategy: policy.autoStrategy,
      preferredCarrier: policy.preferredCarrier,
      allowedCarriers: policy.allowedCarriers,
      blockedCarriers: policy.blockedCarriers,
      markupPercent: policy.markupPercent,
      absorbFeeDifference: policy.absorbFeeDifference
    }
  }
}

export type ShippingSettingsInput = {
  enabled?: boolean
  accessToken?: string
  clientId?: string
  clientSecret?: string
  apiBaseUrl?: string
  pickup?: Partial<ShippingSettings['pickup']>
  parcel?: Partial<ShippingSettings['parcel']>
  codEnabled?: boolean
  autoAdvance?: boolean
  quoteTtlSeconds?: number
  rateCacheSeconds?: number
  quoteRateLimitPerMinute?: number
  addressFallback?: string
}

function allowedApiBaseUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Goship API base URL không hợp lệ' })
  }
  const host = parsed.hostname
  const local = host === 'localhost' || host === '127.0.0.1'
  if (!local && !/^(sandbox\.|api\.)?goship\.io$/i.test(host)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Goship API base URL chỉ được trỏ tới goship.io (hoặc localhost khi dev)'
    })
  }
  if (!local && parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Goship API base URL phải dùng HTTPS' })
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`
}

/** Giá trị `undefined` giữ nguyên, chuỗi rỗng xoá, còn lại ghi đè. */
function mergeField(current: string, incoming: string | undefined) {
  if (incoming === undefined) return current
  if (incoming === '') return ''
  return incoming.trim()
}

/** Chặn sớm để không ghi vào cột PB bị giới hạn độ dài và mất lỗi gốc vào message chung. */
function limitText(value: string, max: number, label: string) {
  if (value.length > max) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} quá dài (${value.length}/${max} ký tự) — kiểm tra lại giá trị đã dán`
    })
  }
}

function validateSettingsLengths(settings: ShippingSettings) {
  limitText(settings.accessToken, 4000, 'Goship access token')
  limitText(settings.clientId, 500, 'Goship client ID')
  limitText(settings.clientSecret, 1000, 'Goship client secret')
  limitText(settings.apiBaseUrl, 300, 'Goship API base URL')
  limitText(settings.pickup.name, 120, 'Tên người gửi')
  limitText(settings.pickup.phone, 40, 'Số điện thoại lấy hàng')
  limitText(settings.pickup.street, 300, 'Địa chỉ lấy hàng')
  limitText(settings.pickup.ward, 120, 'Phường/xã lấy hàng')
  limitText(settings.pickup.district, 120, 'Quận/huyện lấy hàng')
  limitText(settings.pickup.city, 120, 'Tỉnh/thành lấy hàng')
}

export async function saveShippingSettings(input: ShippingSettingsInput): Promise<ShippingSettings> {
  const existing = await pbFirst<ShippingRecord>(SHIPPING_SETTINGS_COLLECTION, {
    filter: `scope = "${SHIPPING_SETTINGS_SCOPE}"`,
    perPage: 1
  })
  const current = recordToSettings(existing)

  const next: ShippingSettings = {
    enabled: input.enabled === undefined ? current.enabled : Boolean(input.enabled),
    accessToken: mergeField(current.accessToken, input.accessToken),
    clientId: mergeField(current.clientId, input.clientId),
    clientSecret: mergeField(current.clientSecret, input.clientSecret),
    apiBaseUrl: mergeField(current.apiBaseUrl, input.apiBaseUrl) || GOSHIP_SANDBOX_BASE_URL,
    webhookId: current.webhookId,
    webhookUrl: current.webhookUrl,
    pickup: {
      name: mergeField(current.pickup.name, input.pickup?.name),
      phone: mergeField(current.pickup.phone, input.pickup?.phone),
      street: mergeField(current.pickup.street, input.pickup?.street),
      ward: mergeField(current.pickup.ward, input.pickup?.ward),
      district: mergeField(current.pickup.district, input.pickup?.district),
      city: mergeField(current.pickup.city, input.pickup?.city),
      wardCode: mergeField(current.pickup.wardCode, input.pickup?.wardCode),
      districtCode: mergeField(current.pickup.districtCode, input.pickup?.districtCode),
      cityCode: mergeField(current.pickup.cityCode, input.pickup?.cityCode)
    },
    parcel: {
      defaultWeight: clamp(input.parcel?.defaultWeight ?? current.parcel.defaultWeight, 0, 1_000_000, current.parcel.defaultWeight),
      defaultItemWeight: clamp(
        input.parcel?.defaultItemWeight ?? current.parcel.defaultItemWeight,
        0,
        1_000_000,
        current.parcel.defaultItemWeight
      ),
      packagingWeight: clamp(
        input.parcel?.packagingWeight ?? current.parcel.packagingWeight,
        0,
        100_000,
        current.parcel.packagingWeight
      ),
      length: clamp(input.parcel?.length ?? current.parcel.length, 1, 200, current.parcel.length),
      width: clamp(input.parcel?.width ?? current.parcel.width, 1, 200, current.parcel.width),
      height: clamp(input.parcel?.height ?? current.parcel.height, 1, 200, current.parcel.height)
    },
    codEnabled: input.codEnabled === undefined ? current.codEnabled : Boolean(input.codEnabled),
    autoAdvance: input.autoAdvance === undefined ? current.autoAdvance : Boolean(input.autoAdvance),
    quoteTtlSeconds: clamp(input.quoteTtlSeconds ?? current.quoteTtlSeconds, 60, 1800, current.quoteTtlSeconds),
    rateCacheSeconds: clamp(input.rateCacheSeconds ?? current.rateCacheSeconds, 0, 3600, current.rateCacheSeconds),
    quoteRateLimitPerMinute: clamp(
      input.quoteRateLimitPerMinute ?? current.quoteRateLimitPerMinute,
      1,
      600,
      current.quoteRateLimitPerMinute
    ),
    addressFallback:
      input.addressFallback === undefined ? current.addressFallback : fallbackValue(input.addressFallback),
    lastVerifiedAt: current.lastVerifiedAt
  }

  validateSettingsLengths(next)

  if (next.apiBaseUrl !== GOSHIP_SANDBOX_BASE_URL && next.apiBaseUrl !== GOSHIP_PRODUCTION_BASE_URL) {
    next.apiBaseUrl = allowedApiBaseUrl(next.apiBaseUrl)
  }

  const body = {
    scope: SHIPPING_SETTINGS_SCOPE,
    enabled: next.enabled,
    goship_access_token: next.accessToken,
    goship_client_id: next.clientId,
    goship_client_secret: next.clientSecret,
    goship_api_base_url: next.apiBaseUrl,
    pickup_name: next.pickup.name,
    pickup_phone: next.pickup.phone,
    pickup_street: next.pickup.street,
    pickup_ward: next.pickup.ward,
    pickup_district: next.pickup.district,
    pickup_city: next.pickup.city,
    pickup_ward_code: next.pickup.wardCode,
    pickup_district_code: next.pickup.districtCode,
    pickup_city_code: next.pickup.cityCode,
    default_weight: next.parcel.defaultWeight,
    default_item_weight: next.parcel.defaultItemWeight,
    packaging_weight: next.parcel.packagingWeight,
    default_length: next.parcel.length,
    default_width: next.parcel.width,
    default_height: next.parcel.height,
    cod_enabled: next.codEnabled,
    auto_advance: next.autoAdvance,
    quote_ttl_seconds: next.quoteTtlSeconds,
    rate_cache_seconds: next.rateCacheSeconds,
    quote_rate_limit_per_minute: next.quoteRateLimitPerMinute,
    address_fallback: next.addressFallback
  }

  if (existing) await pbUpdate(SHIPPING_SETTINGS_COLLECTION, existing.id, body)
  else await pbCreate(SHIPPING_SETTINGS_COLLECTION, body)

  invalidateShippingSettings()
  return next
}

/** Lưu trạng thái webhook đã đăng ký và mốc test kết nối thành công. */
export async function saveShippingConnectionState(input: {
  webhookId?: string
  webhookUrl?: string
  verifiedAt?: string
}) {
  const existing = await pbFirst<ShippingRecord>(SHIPPING_SETTINGS_COLLECTION, {
    filter: `scope = "${SHIPPING_SETTINGS_SCOPE}"`,
    perPage: 1
  })
  const body: Record<string, unknown> = {}
  if (input.webhookId !== undefined) body.goship_webhook_id = input.webhookId
  if (input.webhookUrl !== undefined) body.goship_webhook_url = input.webhookUrl
  if (input.verifiedAt !== undefined) body.last_verified_at = input.verifiedAt

  if (existing) await pbUpdate(SHIPPING_SETTINGS_COLLECTION, existing.id, body)
  else await pbCreate(SHIPPING_SETTINGS_COLLECTION, { scope: SHIPPING_SETTINGS_SCOPE, ...body })

  invalidateShippingSettings()
}

/** Khoá HMAC webhook (client_secret) — chỉ dùng server-side. */
export async function readWebhookSecret() {
  const settings = await readShippingSettings()
  return settings.clientSecret
}
