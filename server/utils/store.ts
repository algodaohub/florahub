import type { H3Event } from 'h3'

type AnyH3Event = H3Event<any>
import type { SiteSettings } from '~/types'
import type { StoreConfig, StoreConfigResponse, StoreRecordMeta } from '~/types/store'
import { defaultConfig } from '~~/utils/store-presets'
import { configFromPreset, mergeConfig, normalizeConfig, type DeepPartial } from '~~/utils/store-config'
import { pbCreate, pbListAll, pbQuote, pbUpdate, type PbRecord } from './pocketbase'
import { getSettingsRecord, legacyShippingFromSettings, mapSiteSettings, type LegacyShipping } from './site'

const STORE_COLLECTION = 'store_configs'
const CACHE_TTL = 10_000

type StoreRecord = PbRecord & {
  name?: string
  domain?: string
  preset?: string
  active?: boolean
  is_default?: boolean
  config?: unknown
}

type CacheEntry = { value: StoreConfigResponse; expiresAt: number }
const cache = new Map<string, CacheEntry>()

export function clearStoreCache() {
  cache.clear()
}

export function normalizeHost(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]!
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
}

export function resolveHost(event?: AnyH3Event): string {
  if (!event) return ''
  const header = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || ''
  return normalizeHost(header)
}

function parseConfig(raw: unknown): Partial<StoreConfig> | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Partial<StoreConfig>
    } catch {
      return null
    }
  }
  return typeof raw === 'object' ? (raw as Partial<StoreConfig>) : null
}

function toMeta(record: StoreRecord): StoreRecordMeta {
  return {
    id: record.id,
    name: String(record.name ?? ''),
    domain: String(record.domain ?? ''),
    preset: String(record.preset ?? ''),
    active: record.active !== false,
    isDefault: record.is_default === true,
    updatedAt: String(record.updated ?? record.created ?? '')
  }
}

/**
 * Chọn store cho một host theo thứ tự ưu tiên cố định:
 * 1. khớp domain chính xác
 * 2. store được đánh dấu `is_default`
 * 3. store có domain rỗng (mới cập nhật nhất — tương thích dữ liệu cũ)
 *
 * Không phụ thuộc vào thời điểm ghi, nên sửa store khác không làm "nhảy" storefront.
 */
export function resolveStoreRecord<T extends { domain?: string; is_default?: boolean }>(
  records: T[],
  host: string
): T | null {
  if (!records.length) return null

  if (host) {
    const exact = records.find((record) => normalizeHost(String(record.domain ?? '')) === host)
    if (exact) return exact
  }

  const flagged = records.find((record) => record.is_default === true)
  if (flagged) return flagged

  return records.find((record) => !normalizeHost(String(record.domain ?? ''))) ?? null
}

/** Bỏ cờ mặc định ở mọi store khác (chỉ một store mặc định tại một thời điểm). */
async function demoteOtherDefaults(keepId: string): Promise<void> {
  const records = await pbListAll<StoreRecord>(STORE_COLLECTION)
  for (const record of records) {
    if (record.id !== keepId && record.is_default === true) {
      await pbUpdate<StoreRecord>(STORE_COLLECTION, record.id, { is_default: false })
    }
  }
}

/** Build a full store config from the legacy single-record `settings` collection. */
export function configFromLegacy(settings: SiteSettings, legacyShipping?: LegacyShipping | null): StoreConfig {
  return normalizeConfig({
    brand: {
      name: settings.siteName,
      tagline: settings.tagline,
      description: settings.description,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      hotline: settings.hotline,
      email: settings.email,
      address: settings.address
    },
    colors: {
      primary: settings.primaryColor,
      primaryDark: settings.primaryDarkColor,
      primarySoft: settings.primarySoftColor,
      accent: settings.accentColor,
      accentSoft: settings.accentSoftColor,
      paper: settings.paperColor,
      paperDeep: settings.paperDeepColor,
      ink: settings.inkColor,
      muted: settings.mutedColor,
      hairline: settings.hairlineColor,
      discount: settings.discountColor
    },
    features: {
      currency: settings.currency,
      locale: settings.locale,
      affiliateCommissionRate: settings.affiliateCommissionRate,
      ...(legacyShipping?.shippingFee !== undefined ? { shippingFee: legacyShipping.shippingFee } : {}),
      ...(legacyShipping?.freeShippingThreshold !== undefined
        ? { freeShippingThreshold: legacyShipping.freeShippingThreshold }
        : {})
    },
    seo: {
      description: settings.description || settings.tagline,
      keywords: settings.tagline
    },
    content: {
      hero: {
        eyebrow: settings.siteName,
        title: settings.tagline || settings.siteName,
        subtitle: settings.description
      }
    }
  })
}

/** Flatten a store config into the legacy SiteSettings shape used by cart/affiliate/orders. */
export function toSiteSettings(config: StoreConfig): SiteSettings {
  return {
    siteName: config.brand.name,
    tagline: config.brand.tagline,
    description: config.brand.description || config.seo.description,
    logoUrl: config.brand.logoUrl,
    faviconUrl: config.brand.faviconUrl,
    primaryColor: config.colors.primary,
    primaryDarkColor: config.colors.primaryDark,
    primarySoftColor: config.colors.primarySoft,
    accentColor: config.colors.accent,
    accentSoftColor: config.colors.accentSoft,
    paperColor: config.colors.paper,
    paperDeepColor: config.colors.paperDeep,
    inkColor: config.colors.ink,
    mutedColor: config.colors.muted,
    hairlineColor: config.colors.hairline,
    discountColor: config.colors.discount,
    hotline: config.brand.hotline,
    email: config.brand.email,
    address: config.brand.address,
    currency: config.features.currency,
    locale: config.features.locale,
    affiliateCommissionRate: config.features.affiliateCommissionRate
  }
}

export async function listStores(): Promise<StoreRecordMeta[]> {
  try {
    const records = await pbListAll<StoreRecord>(STORE_COLLECTION, { sort: '-updated' })
    return records
      .map(toMeta)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  } catch {
    return []
  }
}

/** Resolve the store config for the current request host, with legacy fallback. */
export async function getStoreConfig(event?: AnyH3Event): Promise<StoreConfigResponse> {
  const host = resolveHost(event)
  const cacheKey = host || '_default'
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  let records: StoreRecord[] | null = null
  try {
    records = await pbListAll<StoreRecord>(STORE_COLLECTION, { filter: 'active = true', sort: '-updated' })
  } catch {
    records = null
  }

  let result: StoreConfigResponse

  if (records) {
    const record = resolveStoreRecord(records, host)

    if (record) {
      const matchedDomain = Boolean(host) && normalizeHost(String(record.domain ?? '')) === host
      const meta = toMeta(record)
      result = {
        config: normalizeConfig(parseConfig(record.config)),
        store: { ...meta, isDefault: meta.isDefault || !matchedDomain },
        resolvedBy: matchedDomain ? 'domain' : 'default'
      }
    } else {
      result = await legacyResult()
    }
  } else {
    result = await legacyResult()
  }

  cache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL })
  return result
}

async function legacyResult(): Promise<StoreConfigResponse> {
  const settings = await getSettingsRecord()
  return {
    config: settings
      ? configFromLegacy(mapSiteSettings(settings), legacyShippingFromSettings(settings))
      : defaultConfig,
    store: null,
    resolvedBy: 'fallback'
  }
}

/** Legacy accessor kept so shipping/affiliate pricing follows the active store config. */
export async function getSiteSettings(event?: AnyH3Event): Promise<SiteSettings> {
  const { config } = await getStoreConfig(event)
  return toSiteSettings(config)
}

type SaveOptions = {
  /** Domain the record should be bound to. Empty string means "default store". */
  domain?: string
  name?: string
  preset?: string
  isDefault?: boolean
}

export async function findStoreRecord(event?: AnyH3Event): Promise<StoreRecord | null> {
  const host = resolveHost(event)
  try {
    const records = await pbListAll<StoreRecord>(STORE_COLLECTION, { filter: 'active = true', sort: '-updated' })
    return resolveStoreRecord(records, host)
  } catch {
    return null
  }
}

export async function saveStoreConfig(
  event: AnyH3Event | undefined,
  patch: DeepPartial<StoreConfig>,
  options: SaveOptions = {}
): Promise<StoreConfigResponse> {
  const existing = await findStoreRecord(event)
  const base = existing ? normalizeConfig(parseConfig(existing.config)) : (await getStoreConfig(event)).config
  const merged = normalizeConfig(mergeConfig(base, patch))

  if (existing) {
    const update: Record<string, unknown> = { config: merged }
    if (options.name) update.name = options.name
    if (options.domain !== undefined) update.domain = normalizeHost(options.domain)
    if (options.preset) update.preset = options.preset
    if (options.isDefault !== undefined) update.is_default = options.isDefault

    const saved = await pbUpdate<StoreRecord>(STORE_COLLECTION, existing.id, update)
    if (options.isDefault) await demoteOtherDefaults(saved.id)
  } else {
    const domain = options.domain !== undefined ? normalizeHost(options.domain) : resolveHost(event)
    const created = await pbCreate<StoreRecord>(STORE_COLLECTION, {
      name: options.name || merged.brand.name,
      domain,
      preset: options.preset || merged.tone,
      active: true,
      is_default: !domain,
      config: merged
    })
    if (!domain) await demoteOtherDefaults(created.id)
  }

  clearStoreCache()
  return getStoreConfig(event)
}

export async function createStore(input: {
  name: string
  domain: string
  preset: string
  config?: DeepPartial<StoreConfig>
}): Promise<StoreRecordMeta> {
  const config = configFromPreset(input.preset, {
    brand: { name: input.name },
    ...(input.config ?? {})
  })
  const domain = normalizeHost(input.domain)

  const record = await pbCreate<StoreRecord>(STORE_COLLECTION, {
    name: input.name,
    domain,
    preset: input.preset,
    active: true,
    is_default: !domain,
    config
  })

  // Store mới với domain rỗng trở thành store mặc định của toàn hệ thống.
  if (!domain) await demoteOtherDefaults(record.id)

  clearStoreCache()
  return toMeta(record)
}

export async function applyPresetToStore(
  event: AnyH3Event | undefined,
  presetId: string,
  storeId = ''
): Promise<StoreConfigResponse> {
  const existing = storeId
    ? ((await findStoreById(storeId)) as StoreMetaWithConfig | null)
    : await findStoreRecord(event)
  const current = existing ? normalizeConfig(parseConfig(existing.config)) : (await getStoreConfig(event)).config
  const presetConfig = configFromPreset(presetId)

  // Preset chỉ đổi giao diện; giữ nguyên nhận diện, nội dung, thương mại và thanh toán.
  const merged = normalizeConfig(
    mergeConfig(presetConfig, {
      brand: current.brand,
      features: current.features,
      shipping: current.shipping,
      seo: current.seo,
      content: current.content,
      payments: current.payments,
      layout: { shellWidth: current.layout.shellWidth }
    })
  )

  if (existing) {
    await pbUpdate<StoreRecord>(STORE_COLLECTION, existing.id, { config: merged, preset: presetId })
  } else {
    const domain = resolveHost(event)
    const created = await pbCreate<StoreRecord>(STORE_COLLECTION, {
      name: merged.brand.name,
      domain,
      preset: presetId,
      active: true,
      is_default: !domain,
      config: merged
    })
    if (!domain) await demoteOtherDefaults(created.id)
  }

  clearStoreCache()
  return getStoreConfig(event)
}

export async function findStoreById(id: string): Promise<StoreMetaWithConfig | null> {
  if (!id) return null
  try {
    const records = await pbListAll<StoreRecord>(STORE_COLLECTION, { filter: `id = ${pbQuote(id)}` })
    const record = records[0]
    if (!record) return null
    return { ...toMeta(record), config: normalizeConfig(parseConfig(record.config)) }
  } catch {
    return null
  }
}

export type StoreMetaWithConfig = StoreRecordMeta & { config: StoreConfig }

export function toStoreMeta(meta: StoreRecordMeta): StoreRecordMeta {
  return {
    id: meta.id,
    name: meta.name,
    domain: meta.domain,
    preset: meta.preset,
    active: meta.active,
    isDefault: meta.isDefault === true,
    updatedAt: meta.updatedAt
  }
}

export type StoreMetaPatch = {
  name?: string
  domain?: string
  preset?: string
  active?: boolean
  isDefault?: boolean
}

export async function saveStoreById(
  id: string,
  patch: DeepPartial<StoreConfig>,
  meta: StoreMetaPatch = {}
): Promise<StoreMetaWithConfig> {
  const current = await findStoreById(id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy cửa hàng' })

  const merged = normalizeConfig(mergeConfig(current.config, patch))
  const update: Record<string, unknown> = { config: merged }

  const name = meta.name?.trim()
  if (name) update.name = name
  if (meta.domain !== undefined) update.domain = normalizeHost(meta.domain)
  if (meta.preset) update.preset = meta.preset
  if (meta.active !== undefined) update.active = Boolean(meta.active)
  if (meta.isDefault !== undefined) update.is_default = Boolean(meta.isDefault)

  const saved = await pbUpdate<StoreRecord>(STORE_COLLECTION, id, update)
  if (meta.isDefault) await demoteOtherDefaults(id)
  clearStoreCache()

  return {
    ...current,
    ...toMeta(saved),
    // PATCH có thể bỏ qua field chưa tồn tại ở DB cũ → ưu tiên giá trị vừa ghi.
    ...(name ? { name } : {}),
    ...(meta.preset ? { preset: meta.preset } : {}),
    ...(meta.isDefault !== undefined ? { isDefault: meta.isDefault } : {}),
    config: merged
  }
}

/** Đặt một store làm store mặc định (fallback cho mọi host không khớp domain). */
export async function setDefaultStore(id: string): Promise<StoreRecordMeta> {
  const current = await findStoreById(id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy cửa hàng' })

  const saved = await pbUpdate<StoreRecord>(STORE_COLLECTION, id, { is_default: true, active: true })
  await demoteOtherDefaults(id)
  clearStoreCache()

  return { ...toMeta(saved), isDefault: true }
}
