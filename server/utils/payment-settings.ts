import type { StoreConfig } from '~/types/store'
import { pbCreate, pbFirst, pbUpdate, type PbRecord } from './pocketbase'

export const PAYMENT_SETTINGS_COLLECTION = 'payment_settings'
export const PAYMENT_SETTINGS_SCOPE = 'default'
export const SEPAY_API_DEFAULT_BASE_URL = 'https://my.sepay.vn/userapi'
const CACHE_TTL = 30_000
const MAX_FIELD_LENGTH = 500

export type SepayBankAccount = {
  id: string
  accountNumber: string
  accountHolderName: string
  bankName: string
  bankShortName: string
  active: boolean
}

export type PaymentSettings = {
  apiToken: string
  apiBaseUrl: string
  webhookApiKey: string
  webhookSecret: string
  pg: {
    merchantId: string
    secretKey: string
    ipnSecret: string
    env: 'sandbox' | 'production'
    publicUrl: string
  }
  bankAccounts: SepayBankAccount[]
  bankAccountsSyncedAt: string
}

export type PaymentReadiness = {
  webhook: boolean
  api: boolean
  hosted: boolean
}

type PaymentRecord = PbRecord & {
  scope?: string
  sepay_api_token?: string
  sepay_api_base_url?: string
  sepay_webhook_api_key?: string
  sepay_webhook_secret?: string
  sepay_pg_merchant_id?: string
  sepay_pg_secret_key?: string
  sepay_pg_ipn_secret?: string
  sepay_pg_env?: string
  sepay_pg_public_url?: string
  bank_accounts?: unknown
  bank_accounts_synced_at?: string
}

function text(value: unknown) {
  return String(value ?? '').trim().slice(0, MAX_FIELD_LENGTH)
}

function emptySettings(): PaymentSettings {
  return {
    apiToken: '',
    apiBaseUrl: SEPAY_API_DEFAULT_BASE_URL,
    webhookApiKey: '',
    webhookSecret: '',
    pg: { merchantId: '', secretKey: '', ipnSecret: '', env: 'sandbox', publicUrl: '' },
    bankAccounts: [],
    bankAccountsSyncedAt: ''
  }
}

function normalizeBankAccounts(value: unknown): SepayBankAccount[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      id: String(item?.id ?? item?.account_number ?? ''),
      accountNumber: String(item?.accountNumber ?? item?.account_number ?? '').trim(),
      accountHolderName: String(item?.accountHolderName ?? item?.account_holder_name ?? '').trim(),
      bankName: String(item?.bankName ?? item?.bank_name ?? item?.bank_full_name ?? '').trim(),
      bankShortName: String(item?.bankShortName ?? item?.bank_short_name ?? item?.bank_code ?? '').trim(),
      active: item?.active !== false
    }))
    .filter((item) => item.accountNumber)
}

function recordToSettings(record: PaymentRecord | null): PaymentSettings {
  if (!record) return emptySettings()
  return {
    apiToken: text(record.sepay_api_token),
    apiBaseUrl: text(record.sepay_api_base_url) || SEPAY_API_DEFAULT_BASE_URL,
    webhookApiKey: text(record.sepay_webhook_api_key),
    webhookSecret: text(record.sepay_webhook_secret),
    pg: {
      merchantId: text(record.sepay_pg_merchant_id),
      secretKey: text(record.sepay_pg_secret_key),
      ipnSecret: text(record.sepay_pg_ipn_secret),
      env: record.sepay_pg_env === 'production' ? 'production' : 'sandbox',
      publicUrl: text(record.sepay_pg_public_url)
    },
    bankAccounts: normalizeBankAccounts(record.bank_accounts),
    bankAccountsSyncedAt: text(record.bank_accounts_synced_at)
  }
}

let cache: { settings: PaymentSettings; expiresAt: number } | null = null
let loading: Promise<PaymentSettings> | null = null

export function invalidatePaymentSettings() {
  cache = null
}

export async function readPaymentSettings(): Promise<PaymentSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.settings
  if (!loading) {
    loading = (async () => {
      let settings = emptySettings()
      try {
        const record = await pbFirst<PaymentRecord>(PAYMENT_SETTINGS_COLLECTION, {
          filter: `scope = "${PAYMENT_SETTINGS_SCOPE}"`,
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

export function paymentReadiness(settings: PaymentSettings): PaymentReadiness {
  return {
    webhook: Boolean(settings.webhookSecret || settings.webhookApiKey),
    api: Boolean(settings.apiToken),
    hosted: Boolean(settings.pg.merchantId && settings.pg.secretKey)
  }
}

function mask(value: string) {
  return value ? `••••${value.slice(-4)}` : ''
}

export function publicPaymentSettings(settings: PaymentSettings) {
  return {
    apiToken: { has: Boolean(settings.apiToken), hint: mask(settings.apiToken) },
    apiBaseUrl: settings.apiBaseUrl,
    webhookApiKey: { has: Boolean(settings.webhookApiKey), hint: mask(settings.webhookApiKey) },
    webhookSecret: { has: Boolean(settings.webhookSecret), hint: mask(settings.webhookSecret) },
    pg: {
      merchantId: settings.pg.merchantId,
      secretKey: { has: Boolean(settings.pg.secretKey), hint: mask(settings.pg.secretKey) },
      ipnSecret: { has: Boolean(settings.pg.ipnSecret), hint: mask(settings.pg.ipnSecret) },
      env: settings.pg.env,
      publicUrl: settings.pg.publicUrl
    },
    bankAccounts: settings.bankAccounts,
    bankAccountsSyncedAt: settings.bankAccountsSyncedAt,
    readiness: paymentReadiness(settings)
  }
}

export type PaymentSettingsInput = {
  apiToken?: string
  apiBaseUrl?: string
  webhookApiKey?: string
  webhookSecret?: string
  pg?: {
    merchantId?: string
    secretKey?: string
    ipnSecret?: string
    env?: string
    publicUrl?: string
  }
}

function allowedApiBaseUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'SePay API base URL không hợp lệ' })
  }
  const host = parsed.hostname
  const local = host === 'localhost' || host === '127.0.0.1'
  if (!local && !/^(www\.)?my\.sepay\.vn$/i.test(host)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'SePay API base URL chỉ được trỏ tới my.sepay.vn (hoặc localhost khi dev)'
    })
  }
  if (!local && parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'SePay API base URL phải dùng HTTPS' })
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`
}

function allowedPublicUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Public URL không hợp lệ' })
  }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  if (parsed.protocol !== 'https:' && !local) {
    throw createError({ statusCode: 400, statusMessage: 'Public URL phải dùng HTTPS' })
  }
  return value.replace(/\/+$/, '')
}

/** Giá trị `undefined` giữ nguyên, chuỗi rỗng xoá, còn lại ghi đè. */
function mergeField(current: string, incoming: string | undefined) {
  if (incoming === undefined) return current
  if (incoming === '') return ''
  return incoming.trim()
}

export async function savePaymentSettings(input: PaymentSettingsInput): Promise<PaymentSettings> {
  const existing = await pbFirst<PaymentRecord>(PAYMENT_SETTINGS_COLLECTION, {
    filter: `scope = "${PAYMENT_SETTINGS_SCOPE}"`,
    perPage: 1
  })
  const current = recordToSettings(existing)

  const next: PaymentSettings = {
    apiToken: mergeField(current.apiToken, input.apiToken),
    apiBaseUrl: mergeField(current.apiBaseUrl, input.apiBaseUrl),
    webhookApiKey: mergeField(current.webhookApiKey, input.webhookApiKey),
    webhookSecret: mergeField(current.webhookSecret, input.webhookSecret),
    pg: {
      merchantId: mergeField(current.pg.merchantId, input.pg?.merchantId),
      secretKey: mergeField(current.pg.secretKey, input.pg?.secretKey),
      ipnSecret: mergeField(current.pg.ipnSecret, input.pg?.ipnSecret),
      env:
        input.pg?.env === undefined
          ? current.pg.env
          : input.pg.env === 'production'
            ? 'production'
            : 'sandbox',
      publicUrl: mergeField(current.pg.publicUrl, input.pg?.publicUrl)
    },
    bankAccounts: current.bankAccounts,
    bankAccountsSyncedAt: current.bankAccountsSyncedAt
  }

  if (next.apiBaseUrl && next.apiBaseUrl !== SEPAY_API_DEFAULT_BASE_URL) {
    next.apiBaseUrl = allowedApiBaseUrl(next.apiBaseUrl)
  } else if (!next.apiBaseUrl) {
    next.apiBaseUrl = SEPAY_API_DEFAULT_BASE_URL
  }
  if (next.pg.publicUrl) next.pg.publicUrl = allowedPublicUrl(next.pg.publicUrl)

  const body = {
    scope: PAYMENT_SETTINGS_SCOPE,
    sepay_api_token: next.apiToken,
    sepay_api_base_url: next.apiBaseUrl,
    sepay_webhook_api_key: next.webhookApiKey,
    sepay_webhook_secret: next.webhookSecret,
    sepay_pg_merchant_id: next.pg.merchantId,
    sepay_pg_secret_key: next.pg.secretKey,
    sepay_pg_ipn_secret: next.pg.ipnSecret,
    sepay_pg_env: next.pg.env,
    sepay_pg_public_url: next.pg.publicUrl
  }

  if (existing) await pbUpdate(PAYMENT_SETTINGS_COLLECTION, existing.id, body)
  else await pbCreate(PAYMENT_SETTINGS_COLLECTION, body)

  invalidatePaymentSettings()
  return next
}

export async function saveBankAccountsSnapshot(accounts: SepayBankAccount[], syncedAt: string) {
  const existing = await pbFirst<PaymentRecord>(PAYMENT_SETTINGS_COLLECTION, {
    filter: `scope = "${PAYMENT_SETTINGS_SCOPE}"`,
    perPage: 1
  })
  const body = {
    scope: PAYMENT_SETTINGS_SCOPE,
    sepay_api_base_url: (await readPaymentSettings()).apiBaseUrl,
    bank_accounts: accounts,
    bank_accounts_synced_at: syncedAt
  }
  if (existing) await pbUpdate(PAYMENT_SETTINGS_COLLECTION, existing.id, body)
  else await pbCreate(PAYMENT_SETTINGS_COLLECTION, body)
  invalidatePaymentSettings()
}

/** Gắn cờ runtime vào config công khai; normalizeConfig sẽ strip các cờ này khi lưu. */
export function withPaymentReadiness(config: StoreConfig, settings: PaymentSettings): StoreConfig {
  const readiness = paymentReadiness(settings)
  return {
    ...config,
    payments: {
      ...config.payments,
      qr: { ...config.payments.qr, webhookReady: readiness.webhook, apiReady: readiness.api },
      sepay: { ...config.payments.sepay, ready: readiness.hosted }
    }
  }
}
