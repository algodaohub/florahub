import { readShippingSettings, type ShippingSettings } from './shipping-settings'

const MIN_INTERVAL_MS = 350
const MAX_RETRY_WAIT_MS = 5000
const REQUEST_TIMEOUT_MS = 10_000

let lastRequestAt = 0
let queue: Promise<unknown> = Promise.resolve()

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
}

async function call<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const settings = await readShippingSettings()
  if (!settings.accessToken) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Chưa cấu hình Goship access token trong /admin/shipping'
    })
  }

  const run = queue.then(async () => {
    const gap = MIN_INTERVAL_MS - (Date.now() - lastRequestAt)
    if (gap > 0) await wait(gap)
    try {
      return await requestWithRetry<T>(settings, path, options)
    } finally {
      lastRequestAt = Date.now()
    }
  })
  queue = run.catch(() => undefined)
  return run
}

function fieldErrors(data: any) {
  // Goship bọc lỗi validate trong data.data.errors, một số endpoint trả thẳng data.errors.
  // `errors` có thể là mảng chuỗi (vd "Không tìm thấy dịch vụ phù hợp.") hoặc object theo field.
  const errors = data?.data?.errors ?? data?.errors
  if (!errors) return ''
  if (typeof errors === 'string') return errors.trim()
  if (Array.isArray(errors)) {
    return errors
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .filter(Boolean)
      .join('; ')
  }
  if (typeof errors === 'object') {
    return Object.entries(errors)
      .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : String(messages)}`)
      .join('; ')
  }
  return ''
}

async function requestWithRetry<T>(
  settings: ShippingSettings,
  path: string,
  options: RequestOptions,
  retried = false
): Promise<T> {
  const url = new URL(`${settings.apiBaseUrl.replace(/\/+$/, '')}${path}`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' })
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Không kết nối được Goship API' })
  }

  if (response.status === 429 && !retried) {
    const retryAfter = Number(response.headers.get('retry-after') ?? 1)
    const delay = Math.min(MAX_RETRY_WAIT_MS, Math.max(1, Number.isFinite(retryAfter) ? retryAfter : 1) * 1000)
    await wait(delay)
    return requestWithRetry<T>(settings, path, options, true)
  }

  const text = await response.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Goship từ chối access token — kiểm tra lại trong /admin/shipping'
      })
    }
    if (response.status === 422) {
      const detail =
        fieldErrors(data) ||
        String(data?.data?.exception ?? data?.exception ?? '').trim() ||
        String(data?.message ?? '').trim() ||
        'Goship báo dữ liệu không hợp lệ'
      console.warn('[goship] 422', path, detail)
      throw createError({ statusCode: 422, statusMessage: detail })
    }
    throw createError({
      statusCode: 502,
      statusMessage: data?.message || `Goship API trả về lỗi ${response.status}`
    })
  }

  return data as T
}

function rowsOf(data: any, key: string): any[] {
  const candidates = [data?.[key], data?.data, data]
  return candidates.find((value) => Array.isArray(value)) ?? []
}

function pick(item: any, ...keys: string[]) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}

export type GoshipLocation = {
  code: string
  name: string
  parentCode: string
}

export async function listCities(): Promise<GoshipLocation[]> {
  const data = await call<any>('/cities')
  return rowsOf(data, 'cities')
    .map((item) => ({
      code: String(pick(item, 'id', 'code', 'city_id')).trim(),
      name: String(pick(item, 'name', 'city_name')).trim(),
      parentCode: ''
    }))
    .filter((item) => item.code && item.name)
}

export type GoshipCarrier = {
  code: string
  name: string
  shortName: string
  logo: string
}

export async function listCarriers(): Promise<GoshipCarrier[]> {
  const data = await call<any>('/carriers')
  return rowsOf(data, 'carriers')
    .map((item) => {
      const shortName = String(pick(item, 'short_name', 'carrier_short_name', 'code')).trim()
      return {
        code: String(pick(item, 'code', 'carrier_code', 'short_name', 'id')).trim().toLowerCase(),
        name: String(pick(item, 'name', 'carrier_name', shortName)).trim(),
        shortName,
        logo: String(pick(item, 'logo', 'carrier_logo')).trim()
      }
    })
    .filter((item) => item.code)
}

export type GoshipRateInput = {
  addressFrom: { district: string; city: string }
  addressTo: { district: string; city: string }
  parcel: { cod: number; amount: number; weight: number; width: number; height: number; length: number }
}

export type GoshipRate = {
  rateId: string
  ownAccount: boolean
  carrier: string
  carrierName: string
  carrierLogo: string
  service: string
  totalFee: number
  expected: string
  successRate: number | null
  codFee: number
  insuranceFee: number
  remoteAreaFee: number
  returnFee: number
  totalAmountShop: number
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeRate(item: any): GoshipRate {
  const report = item?.report ?? {}
  return {
    rateId: String(pick(item, 'id', 'rate')).trim(),
    ownAccount: Number(item?.own_account ?? 0) === 1 || item?.own_account === true,
    carrier: String(pick(item, 'carrier_short_name', 'carrier')).trim().toLowerCase(),
    carrierName: String(pick(item, 'carrier_name', 'carrier_short_name')).trim(),
    carrierLogo: String(pick(item, 'carrier_logo')).trim(),
    service: String(pick(item, 'service', 'service_name')).trim(),
    totalFee: Math.round(Number(item?.total_fee ?? item?.fee ?? 0)),
    expected: String(pick(item, 'expected', report?.avg_time_delivery_format)).trim(),
    successRate: numberOrNull(pick(report, 'success_percent', 'success_rate')),
    codFee: Math.round(Number(item?.cod_fee ?? 0)),
    insuranceFee: Math.round(Number(item?.insurance_fee ?? 0)),
    remoteAreaFee: Math.round(Number(item?.remote_area_fee ?? 0)),
    returnFee: Math.round(Number(item?.return_fee ?? 0)),
    totalAmountShop: Math.round(Number(item?.total_amount_shop ?? 0))
  }
}

export async function getRates(input: GoshipRateInput): Promise<GoshipRate[]> {
  const data = await call<any>('/rates', {
    method: 'POST',
    body: {
      shipment: {
        address_from: { district: input.addressFrom.district, city: input.addressFrom.city },
        address_to: { district: input.addressTo.district, city: input.addressTo.city },
        parcel: {
          cod: input.parcel.cod,
          amount: input.parcel.amount,
          width: input.parcel.width,
          height: input.parcel.height,
          length: input.parcel.length,
          weight: input.parcel.weight
        }
      }
    }
  })
  return rowsOf(data, 'rates').map(normalizeRate).filter((rate) => rate.rateId)
}

export type GoshipShipmentInput = {
  rateId: string
  orderId: string
  payer: number
  cod: number
  amount: number
  weight: number
  width: number
  height: number
  length: number
  /** Ghi chú giao hàng gửi kèm vận đơn (Goship `parcel.metadata`). */
  note?: string
  addressFrom: { name: string; phone: string; street: string; ward: string; district: string; city: string }
  addressTo: { name: string; phone: string; street: string; ward: string; district: string; city: string }
}

export type GoshipShipment = {
  id: string
  status: number
  statusText: string
  trackingNumber: string
  carrier: string
  carrierShortName: string
  sortingCode: string
  amountReturnShop: number
  carrierError: string
  raw: unknown
}

function normalizeShipment(data: any): GoshipShipment {
  const item = data?.shipment ?? data?.data ?? data ?? {}
  return {
    id: String(pick(item, 'id', 'shipment_id')).trim(),
    status: Number(pick(item, 'shipment_status', 'status') || 0),
    statusText: String(pick(item, 'shipment_status_text', 'status_text')).trim(),
    trackingNumber: String(pick(item, 'tracking_number', 'tracking_code')).trim(),
    carrier: String(pick(item, 'carrier', 'carrier_code')).trim(),
    carrierShortName: String(pick(item, 'carrier_short_name')).trim(),
    sortingCode: String(pick(item, 'sorting_code')).trim(),
    amountReturnShop: Number(pick(item, 'amount_return_shop') || 0),
    carrierError: String(pick(item, 'carrier_error')).trim(),
    raw: data
  }
}

export async function createShipment(input: GoshipShipmentInput): Promise<GoshipShipment> {
  const data = await call<any>('/shipments', {
    method: 'POST',
    body: {
      shipment: {
        rate: input.rateId,
        payer: input.payer,
        order_id: input.orderId,
        is_recall: 0,
        address_from: input.addressFrom,
        address_to: input.addressTo,
        parcel: {
          cod: input.cod,
          amount: input.amount,
          weight: input.weight,
          width: input.width,
          height: input.height,
          length: input.length,
          // `metadata` là "Ghi chú vận đơn". Goship ghi thẳng vào cột DB nên phải là chuỗi,
          // gửi object sẽ bị PHP báo "Array to string conversion" và trả 422.
          ...(input.note ? { metadata: input.note } : {})
        }
      }
    }
  })
  return normalizeShipment(data)
}

export async function getShipment(code: string): Promise<GoshipShipment | null> {
  const data = await call<any>('/shipments/search', { query: { code } })
  const item = Array.isArray(data?.data) ? data.data[0] : (data?.data ?? data?.shipment ?? data)
  if (!item || (!item.id && !item.tracking_number && !item.code)) return null
  return normalizeShipment(item)
}

export async function cancelShipment(id: string): Promise<void> {
  await call<any>(`/shipments/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export type GoshipWebhook = { id: string; url: string }

export async function registerWebhook(url: string): Promise<GoshipWebhook> {
  // Goship yêu cầu field `endpoint` — gửi `url` sẽ bị 422 "endpoint là bắt buộc".
  const data = await call<any>('/webhooks', { method: 'POST', body: { endpoint: url } })
  const item = data?.webhook ?? data?.data ?? data ?? {}
  return {
    id: String(pick(item, 'id', 'webhook_id')).trim(),
    url: String(pick(item, 'endpoint', 'url', 'callback_url') || url).trim()
  }
}

export async function deleteWebhook(id: string): Promise<void> {
  await call<any>(`/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Gọi danh mục nhỏ để xác nhận token còn hiệu lực. */
export async function testConnection() {
  const cities = await listCities()
  return { ok: true, cityCount: cities.length }
}
