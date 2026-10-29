import type { SiteSettings } from '~/types'
import { pbFetch, type PbList } from './pocketbase'

type SettingsRecord = {
  site_name?: string
  tagline?: string
  description?: string
  logo_url?: string
  favicon_url?: string
  primary_color?: string
  primary_dark_color?: string
  primary_soft_color?: string
  accent_color?: string
  accent_soft_color?: string
  paper_color?: string
  paper_deep_color?: string
  ink_color?: string
  muted_color?: string
  hairline_color?: string
  discount_color?: string
  hotline?: string
  email?: string
  address?: string
  currency?: string
  locale?: string
  // Hai cột cũ chỉ còn dùng để seed chính sách vận chuyển cho store legacy.
  shipping_fee?: string
  free_shipping_threshold?: string
  affiliate_commission_rate?: string
}

export type LegacyShipping = {
  shippingFee?: number
  freeShippingThreshold?: number
}

export function legacyShippingFromSettings(record: SettingsRecord | null): LegacyShipping | null {
  if (!record) return null
  const number = (raw: unknown) => {
    if (typeof raw !== 'string' || !raw.trim()) return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
  }
  const shippingFee = number(record.shipping_fee)
  const freeShippingThreshold = number(record.free_shipping_threshold)
  if (shippingFee === undefined && freeShippingThreshold === undefined) return null
  return { ...(shippingFee !== undefined ? { shippingFee } : {}), ...(freeShippingThreshold !== undefined ? { freeShippingThreshold } : {}) }
}

export const fallbackSiteSettings: SiteSettings = {
  siteName: 'Cửa hàng',
  tagline: '',
  description: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#3F6B4F',
  primaryDarkColor: '#2E523C',
  primarySoftColor: '#E5EDE6',
  accentColor: '#B9764A',
  accentSoftColor: '#F3E5DA',
  paperColor: '#F7F3EB',
  paperDeepColor: '#EFE8DB',
  inkColor: '#2B2A26',
  mutedColor: '#7C766B',
  hairlineColor: '#E3DCCE',
  discountColor: '#B4553F',
  hotline: '',
  email: '',
  address: '',
  currency: 'VND',
  locale: 'vi-VN',
  affiliateCommissionRate: 5
}

export function mapSiteSettings(record: SettingsRecord): SiteSettings {
  const value = (key: keyof SettingsRecord, fallbackValue: string) => {
    const raw = record[key]
    return typeof raw === 'string' && raw.trim() ? raw.trim() : fallbackValue
  }
  const numberValue = (key: keyof SettingsRecord, fallbackValue: number) => {
    const raw = record[key]
    if (typeof raw !== 'string' || !raw.trim()) return fallbackValue
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackValue
  }

  return {
    siteName: value('site_name', fallbackSiteSettings.siteName),
    tagline: value('tagline', fallbackSiteSettings.tagline),
    description: value('description', fallbackSiteSettings.description),
    logoUrl: value('logo_url', fallbackSiteSettings.logoUrl),
    faviconUrl: value('favicon_url', fallbackSiteSettings.faviconUrl),
    primaryColor: value('primary_color', fallbackSiteSettings.primaryColor),
    primaryDarkColor: value('primary_dark_color', fallbackSiteSettings.primaryDarkColor),
    primarySoftColor: value('primary_soft_color', fallbackSiteSettings.primarySoftColor),
    accentColor: value('accent_color', fallbackSiteSettings.accentColor),
    accentSoftColor: value('accent_soft_color', fallbackSiteSettings.accentSoftColor),
    paperColor: value('paper_color', fallbackSiteSettings.paperColor),
    paperDeepColor: value('paper_deep_color', fallbackSiteSettings.paperDeepColor),
    inkColor: value('ink_color', fallbackSiteSettings.inkColor),
    mutedColor: value('muted_color', fallbackSiteSettings.mutedColor),
    hairlineColor: value('hairline_color', fallbackSiteSettings.hairlineColor),
    discountColor: value('discount_color', fallbackSiteSettings.discountColor),
    hotline: value('hotline', fallbackSiteSettings.hotline),
    email: value('email', fallbackSiteSettings.email),
    address: value('address', fallbackSiteSettings.address),
    currency: value('currency', fallbackSiteSettings.currency),
    locale: value('locale', fallbackSiteSettings.locale),
    affiliateCommissionRate: numberValue('affiliate_commission_rate', fallbackSiteSettings.affiliateCommissionRate)
  }
}

let cached: { value: SettingsRecord | null; expiresAt: number } | null = null

export async function getSettingsRecord(): Promise<SettingsRecord | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.value
  try {
    const result = await pbFetch<PbList<SettingsRecord>>(
      '/api/collections/settings/records?perPage=1&sort=-created'
    )
    const value = result.items[0] ?? null
    cached = { value, expiresAt: Date.now() + 15_000 }
    return value
  } catch {
    return null
  }
}

export function clearSettingsCache() {
  cached = null
}
