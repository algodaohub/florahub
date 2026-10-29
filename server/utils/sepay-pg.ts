import { createHmac } from 'node:crypto'
import type { H3Event } from 'h3'
import type { StorePayments } from '~/types/store'
import { resolvePaymentMethod } from '~~/utils/payments'
import type { PbRecord } from './pocketbase'
import { readPaymentSettings } from './payment-settings'

const SANDBOX_URL = 'https://pay-sandbox.sepay.vn'
const PRODUCTION_URL = 'https://pay.sepay.vn'

/**
 * Credentials của Cổng thanh toán SePay (hosted checkout) đọc từ PocketBase.
 * Config cửa hàng được trả công khai nên không chứa secret.
 */
export async function sepayPgSettings() {
  const settings = await readPaymentSettings()
  return {
    merchantId: settings.pg.merchantId,
    secretKey: settings.pg.secretKey,
    ipnSecret: settings.pg.ipnSecret || settings.pg.secretKey,
    publicUrl: settings.pg.publicUrl,
    baseUrl: settings.pg.env === 'production' ? PRODUCTION_URL : SANDBOX_URL,
    configured: Boolean(settings.pg.merchantId && settings.pg.secretKey)
  }
}

export async function isSepayPgConfigured() {
  return (await sepayPgSettings()).configured
}

/** Server không tin cờ `ready` đến từ client; tự kiểm tra credentials trong DB. */
export async function resolvePaymentMethodForServer(payments: StorePayments | null | undefined) {
  return resolvePaymentMethod(payments, await isSepayPgConfigured())
}

const SIGNATURE_FIELDS = [
  'order_amount',
  'merchant',
  'currency',
  'operation',
  'order_description',
  'order_invoice_number',
  'customer_id',
  'payment_method',
  'success_url',
  'error_url',
  'cancel_url'
] as const

/**
 * Chuỗi ký: các field có mặt, đúng thứ tự, nối `key=value` bằng dấu phẩy,
 * giá trị thô không URL-encode. Chữ ký = base64(HMAC-SHA256(raw, secret_key)).
 */
export function buildSepaySignature(fields: Record<string, string>, secretKey: string) {
  const raw = SIGNATURE_FIELDS.filter((key) => String(fields[key] ?? '').length > 0)
    .map((key) => `${key}=${fields[key]}`)
    .join(',')
  return createHmac('sha256', secretKey).update(raw).digest('base64')
}

export function invoiceForOrder(orderId: string) {
  return `ORD-${orderId}-${Date.now().toString(36)}`
}

/** Invoice có dạng ORD-<order id 15 ký tự>-<suffix>; dùng khi IPN đến trước khi lưu invoice. */
export function invoiceOrderId(invoice: string) {
  const match = /^ORD-([a-z0-9]{15})-/i.exec(String(invoice ?? '').trim())
  return match?.[1]?.toLowerCase() ?? ''
}

/** URL công khai để SePay redirect khách về; ưu tiên cấu hình trong DB khi chạy sau proxy. */
export function publicBaseUrlFor(event: H3Event, configured = '') {
  const fromSettings = String(configured ?? '').trim().replace(/\/+$/, '')
  if (fromSettings) return fromSettings

  const host = String(getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '')
    .split(',')[0]!
    .trim()
  if (!host) return ''
  const proto = String(getRequestHeader(event, 'x-forwarded-proto') || '').split(',')[0]!.trim() || 'https'
  return `${proto}://${host}`
}

export async function sepayPublicBaseUrl(event: H3Event) {
  const { publicUrl } = await sepayPgSettings()
  return publicBaseUrlFor(event, publicUrl)
}

export async function buildSepayCheckout(event: H3Event, order: PbRecord) {
  const settings = await sepayPgSettings()
  if (!settings.configured) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Chưa cấu hình merchant SePay trong /admin/payments'
    })
  }

  const base = publicBaseUrlFor(event, settings.publicUrl)
  if (!base) {
    throw createError({ statusCode: 500, statusMessage: 'Không xác định được URL công khai cho cổng thanh toán' })
  }

  const orderId = String(order.id)
  const invoice = invoiceForOrder(orderId)
  const returnUrl = (state: string) => `${base}/orders/${orderId}?payment=${state}`

  const fields: Record<string, string> = {
    order_amount: String(Math.round(Number(order.total ?? 0))),
    merchant: settings.merchantId,
    currency: 'VND',
    operation: 'PURCHASE',
    order_description: `Thanh toan don hang ${orderId}`,
    order_invoice_number: invoice,
    success_url: returnUrl('success'),
    error_url: returnUrl('error'),
    cancel_url: returnUrl('cancel')
  }
  fields.signature = buildSepaySignature(fields, settings.secretKey)

  return {
    action: `${settings.baseUrl}/v1/checkout/init`,
    fields,
    invoice
  }
}
