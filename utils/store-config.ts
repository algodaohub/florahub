import type { StoreConfig, StorePreset, StoreShippingPolicy, StoreTone } from '~/types/store'
import { defaultConfig, findPreset } from './store-presets'

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<unknown> ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Khoá localStorage phát sau mỗi lần lưu cấu hình. Các tab đang mở storefront
 * lắng nghe khoá này để tải lại theme ngay, không cần F5.
 */
export const STORE_CONFIG_UPDATED_KEY = 'florahub:store-config-updated'

export function mergeConfig<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return base
  const output: Record<string, unknown> = isPlainObject(base) ? { ...base } : {}

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) continue
    const current = output[key]
    output[key] = isPlainObject(value) && isPlainObject(current) ? mergeConfig(current, value) : value
  }

  return output as T
}

export const toneLabels: Record<StoreTone, string> = {
  'am-ap': 'Ấm áp',
  'sang-trong': 'Sang trọng',
  'toi-gian': 'Tối giản',
  'tuoi-tre': 'Tươi trẻ',
  pastel: 'Pastel',
  'nong-nghiep': 'Nông nghiệp'
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

const hex = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
    ? value.trim()
    : fallback

const clampDecimal = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed * 10) / 10))
}

const carrierList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const item of value) {
    const code = String(item ?? '').trim().toLowerCase()
    if (!code || code.length > 40) continue
    seen.add(code)
    if (seen.size >= 20) break
  }
  return [...seen]
}

/**
 * Chuẩn hoá chính sách vận chuyển. Storefront cũ chưa có khối `shipping` sẽ
 * được nạp từ phí cố định cũ để không mất mức phí đang dùng.
 */
const normalizeShipping = (
  config: StoreConfig,
  source: Record<string, unknown> | null,
  legacyFeatures: Record<string, unknown> | null
): StoreShippingPolicy => {
  const defaults = defaultConfig.shipping
  const legacyFee = Number(legacyFeatures?.shippingFee)
  const legacyThreshold = Number(legacyFeatures?.freeShippingThreshold)
  const read = (key: string, fallback: unknown): unknown =>
    source && source[key] !== undefined && source[key] !== null ? source[key] : fallback

  const strategy = String(read('autoStrategy', defaults.autoStrategy))
  const fallbackBehavior = String(read('fallbackBehavior', defaults.fallbackBehavior))

  return {
    enabled: read('enabled', true) !== false,
    allowCustomerChoice: read('allowCustomerChoice', true) !== false,
    autoStrategy: ['cheapest', 'fastest', 'preferred'].includes(strategy)
      ? (strategy as StoreShippingPolicy['autoStrategy'])
      : defaults.autoStrategy,
    preferredCarrier: String(read('preferredCarrier', defaults.preferredCarrier)).trim().toLowerCase().slice(0, 40),
    maxOptions: clamp(read('maxOptions', defaults.maxOptions), 1, 8, defaults.maxOptions),
    allowedCarriers: carrierList(read('allowedCarriers', defaults.allowedCarriers)),
    blockedCarriers: carrierList(read('blockedCarriers', defaults.blockedCarriers)),
    markupPercent: clampDecimal(read('markupPercent', defaults.markupPercent), 0, 100, defaults.markupPercent),
    freeShippingThreshold: clamp(
      read('freeShippingThreshold', Number.isFinite(legacyThreshold) ? legacyThreshold : defaults.freeShippingThreshold),
      0,
      100_000_000,
      defaults.freeShippingThreshold
    ),
    fallbackBehavior: ['flat', 'block'].includes(fallbackBehavior)
      ? (fallbackBehavior as StoreShippingPolicy['fallbackBehavior'])
      : defaults.fallbackBehavior,
    fallbackFee: clamp(
      read('fallbackFee', Number.isFinite(legacyFee) ? legacyFee : defaults.fallbackFee),
      0,
      10_000_000,
      defaults.fallbackFee
    ),
    showEta: read('showEta', true) !== false,
    showSuccessRate: read('showSuccessRate', false) === true,
    absorbFeeDifference: read('absorbFeeDifference', true) !== false
  }
}

/** Merge a stored/partial payload onto defaults and clamp every unsafe value. */
export function normalizeConfig(raw: unknown): StoreConfig {
  const merged = mergeConfig(defaultConfig, raw)
  const config = merged as StoreConfig
  const rawShipping =
    isPlainObject(raw) && isPlainObject(raw.shipping) ? (raw.shipping as Record<string, unknown>) : null
  const rawFeatures =
    isPlainObject(raw) && isPlainObject(raw.features) ? (raw.features as Record<string, unknown>) : null

  return {
    ...config,
    brand: {
      name: String(config.brand?.name ?? defaultConfig.brand.name).slice(0, 60) || defaultConfig.brand.name,
      tagline: String(config.brand?.tagline ?? ''),
      description: String(config.brand?.description ?? ''),
      logoUrl: String(config.brand?.logoUrl ?? ''),
      faviconUrl: String(config.brand?.faviconUrl ?? ''),
      hotline: String(config.brand?.hotline ?? ''),
      email: String(config.brand?.email ?? ''),
      address: String(config.brand?.address ?? '')
    },
    colors: {
      primary: hex(config.colors?.primary, defaultConfig.colors.primary),
      primaryDark: hex(config.colors?.primaryDark, defaultConfig.colors.primaryDark),
      primarySoft: hex(config.colors?.primarySoft, defaultConfig.colors.primarySoft),
      onPrimary: hex(config.colors?.onPrimary, defaultConfig.colors.onPrimary),
      accent: hex(config.colors?.accent, defaultConfig.colors.accent),
      accentSoft: hex(config.colors?.accentSoft, defaultConfig.colors.accentSoft),
      paper: hex(config.colors?.paper, defaultConfig.colors.paper),
      paperDeep: hex(config.colors?.paperDeep, defaultConfig.colors.paperDeep),
      ink: hex(config.colors?.ink, defaultConfig.colors.ink),
      muted: hex(config.colors?.muted, defaultConfig.colors.muted),
      hairline: hex(config.colors?.hairline, defaultConfig.colors.hairline),
      discount: hex(config.colors?.discount, defaultConfig.colors.discount)
    },
    typography: {
      displayFont: config.typography?.displayFont ?? defaultConfig.typography.displayFont,
      bodyFont: config.typography?.bodyFont ?? defaultConfig.typography.bodyFont,
      displayWeight: clamp(config.typography?.displayWeight, 300, 800, 600),
      headingTracking: String(config.typography?.headingTracking ?? defaultConfig.typography.headingTracking)
    },
    shape: {
      cardRadius: clamp(config.shape?.cardRadius, 0, 40, 20),
      buttonRadius: clamp(config.shape?.buttonRadius, 0, 999, 999),
      inputRadius: clamp(config.shape?.inputRadius, 0, 999, 999),
      imageRadius: clamp(config.shape?.imageRadius, 0, 40, 18),
      shadow: ['none', 'soft', 'strong'].includes(config.shape?.shadow) ? config.shape.shadow : 'soft'
    },
    layout: {
      shellWidth: clamp(config.layout?.shellWidth, 320, 1920, 480),
      gutter: clamp(config.layout?.gutter, 8, 40, 12),
      headerStyle: ['classic', 'centered', 'minimal'].includes(config.layout?.headerStyle)
        ? config.layout.headerStyle
        : 'classic',
      showTagline: Boolean(config.layout?.showTagline),
      assistantInHeader: config.layout?.assistantInHeader !== false,
      announcement: {
        enabled: Boolean(config.layout?.announcement?.enabled),
        text: String(config.layout?.announcement?.text ?? ''),
        href: String(config.layout?.announcement?.href ?? '')
      },
      productGridColumns: clamp(config.layout?.productGridColumns, 2, 4, 3),
      productCardStyle: ['soft', 'flat', 'bordered'].includes(config.layout?.productCardStyle)
        ? config.layout.productCardStyle
        : 'soft',
      bottomNav: {
        enabled: config.layout?.bottomNav?.enabled !== false,
        items: Array.isArray(config.layout?.bottomNav?.items) && config.layout.bottomNav.items.length
          ? config.layout.bottomNav.items.filter((item) =>
              ['home', 'categories', 'cart', 'account', 'assistant'].includes(item)
            )
          : defaultConfig.layout.bottomNav.items
      },
      footer: {
        enabled: Boolean(config.layout?.footer?.enabled),
        text: String(config.layout?.footer?.text ?? '')
      }
    },
    features: {
      affiliate: Boolean(config.features?.affiliate),
      wallet: Boolean(config.features?.wallet),
      reviews: Boolean(config.features?.reviews),
      flashSale: Boolean(config.features?.flashSale),
      wishlist: Boolean(config.features?.wishlist),
      trackOrder: Boolean(config.features?.trackOrder),
      currency: String(config.features?.currency ?? 'VND').toUpperCase().slice(0, 3),
      locale: String(config.features?.locale ?? 'vi-VN'),
      taxRate: clamp(config.features?.taxRate, 0, 100, 0),
      affiliateCommissionRate: clamp(config.features?.affiliateCommissionRate, 0, 100, 5),
      minOrderQuantity: clamp(config.features?.minOrderQuantity, 0, 9999, 0)
    },
    shipping: normalizeShipping(config, rawShipping, rawFeatures),
    seo: {
      titleTemplate: String(config.seo?.titleTemplate ?? ''),
      description: String(config.seo?.description ?? ''),
      keywords: String(config.seo?.keywords ?? ''),
      ogImage: String(config.seo?.ogImage ?? '')
    },
    content: {
      hero: {
        enabled: config.content?.hero?.enabled !== false,
        eyebrow: String(config.content?.hero?.eyebrow ?? ''),
        title: String(config.content?.hero?.title ?? ''),
        subtitle: String(config.content?.hero?.subtitle ?? ''),
        ctaLabel: String(config.content?.hero?.ctaLabel ?? ''),
        ctaHref: String(config.content?.hero?.ctaHref ?? '/categories'),
        image: String(config.content?.hero?.image ?? '')
      }
    },
    payments: {
      method: (['qr', 'cod', 'sepay'] as const).includes(config.payments?.method as never)
        ? (config.payments?.method as StoreConfig['payments']['method'])
        : 'qr',
      qr: {
        enabled: config.payments?.qr?.enabled !== false,
        bankId: String(config.payments?.qr?.bankId ?? '').trim().slice(0, 24),
        bankName: String(config.payments?.qr?.bankName ?? '').trim().slice(0, 60),
        accountNo: String(config.payments?.qr?.accountNo ?? '').replace(/\s+/g, '').slice(0, 32),
        accountName: String(config.payments?.qr?.accountName ?? '').trim().toUpperCase().slice(0, 80),
        template: (['compact', 'compact2', 'qr_only', 'print'] as const).includes(
          config.payments?.qr?.template as never
        )
          ? (config.payments?.qr?.template as StoreConfig['payments']['qr']['template'])
          : 'compact2'
      },
      // Chỉ lưu ý định bật/tắt; credentials nằm trong .env, `ready` do server inject.
      sepay: { enabled: config.payments?.sepay?.enabled === true }
    }
  }
}

export function configFromPreset(presetId: string, overrides?: DeepPartial<StoreConfig>): StoreConfig {
  const preset = findPreset(presetId) ?? findPreset('vuon-nha')
  const base = preset
    ? mergeConfig(defaultConfig, {
        tone: preset.config.tone,
        colors: preset.config.colors,
        typography: preset.config.typography,
        shape: preset.config.shape,
        layout: preset.config.layout
      })
    : defaultConfig

  return normalizeConfig(overrides ? mergeConfig(base, overrides) : base)
}

export function presetSwatches(preset: StorePreset | undefined) {
  return preset?.swatches ?? [defaultConfig.colors.primary, defaultConfig.colors.accent, defaultConfig.colors.paper]
}
