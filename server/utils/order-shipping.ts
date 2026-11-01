import type { AdminOrderShipping, AdminShipmentEvent, ShippingQuoteOption } from '~/types/shipping'
import { canCancelOrder, canSetOrderStatus } from '~~/utils/order-state'
import { ensureOrderAccounting } from './accounting'
import { approveDueCommissionForOrder, cancelCommissionForOrder } from './affiliate-commission'
import { createShipment, getRates, getShipment, cancelShipment, type GoshipShipment } from './goship'
import { pbCreate, pbFirst, pbListPage, pbQuote, pbUpdate, type PbRecord } from './pocketbase'
import { pickupAddressForShipment, rateAddressFromPickup, validatePickup } from './shipping-address'
import {
  computeCustomerFee,
  rankOptions,
  readStoreShippingPolicy
} from './shipping-policy'
import { readShippingSettings, type ShippingSettings } from './shipping-settings'

const EVENT_COLLECTION = 'shipment_events'

export type ShipmentUpdate = {
  shipmentId?: string
  code?: string
  statusCode?: number
  statusText?: string
  trackingNumber?: string
  trackingUrl?: string
  carrier?: string
  carrierName?: string
  fee?: number
  cod?: number
  payer?: number
  isReturn?: boolean
  isLost?: boolean
  message?: string
  eventTime?: string
  raw?: unknown
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

export function orderShippingFromRecord(order: PbRecord): AdminOrderShipping {
  return {
    provider: String(order.shipping_provider ?? ''),
    quoteId: String(order.shipping_quote_id ?? ''),
    optionId: String(order.shipping_option_id ?? ''),
    rateId: String(order.shipping_rate_id ?? ''),
    carrier: String(order.shipping_carrier ?? ''),
    carrierName: String(order.shipping_carrier_name ?? ''),
    service: String(order.shipping_service ?? ''),
    shipmentId: String(order.shipping_shipment_id ?? ''),
    code: String(order.shipping_code ?? ''),
    trackingNumber: String(order.shipping_tracking_number ?? ''),
    trackingUrl: String(order.shipping_tracking_url ?? ''),
    statusCode: num(order.shipping_status_code),
    statusText: String(order.shipping_status_text ?? ''),
    feeQuoted: num(order.shipping_fee_quoted),
    feeActual: num(order.shipping_fee_actual),
    cod: num(order.shipping_cod),
    payer: num(order.shipping_payer),
    selectedManually: order.shipping_selected_manually === true,
    chargeableWeight: num(order.shipping_chargeable_weight),
    cityName: String(order.shipping_city_name ?? ''),
    districtName: String(order.shipping_district_name ?? ''),
    wardName: String(order.shipping_ward_name ?? ''),
    cityCode: String(order.shipping_city_code ?? ''),
    districtCode: String(order.shipping_district_code ?? ''),
    wardCode: String(order.shipping_ward_code_goship ?? ''),
    returning: order.shipping_returning === true,
    createdAt: String(order.shipping_created_at ?? ''),
    updatedAt: String(order.shipping_updated_at ?? '')
  }
}

/** Vận đơn đã bị huỷ — cho phép báo giá lại và tạo vận đơn mới. */
export function isShipmentCancelled(order: PbRecord): boolean {
  return String(order.shipping_status_text ?? '').includes('Đã huỷ vận đơn')
}

export function shipmentUpdateFromWebhook(payload: any): ShipmentUpdate {
  return {
    shipmentId: String(payload?.shipment_id ?? payload?.id ?? ''),
    code: String(payload?.gcode ?? payload?.code ?? payload?.carrier_code ?? ''),
    statusCode: num(payload?.status ?? payload?.status_code),
    statusText: String(payload?.status_text ?? ''),
    trackingNumber: String(payload?.tracking_number ?? ''),
    trackingUrl: String(payload?.tracking_url ?? ''),
    carrier: String(payload?.carrier_short_name ?? payload?.carrier ?? ''),
    carrierName: String(payload?.carrier_name ?? payload?.carrier_short_name ?? ''),
    fee: payload?.fee === undefined ? undefined : num(payload.fee),
    cod: payload?.cod === undefined ? undefined : num(payload.cod),
    payer: payload?.payer === undefined ? undefined : num(payload.payer),
    isReturn: payload?.is_return === true || payload?.is_return === 1,
    isLost: payload?.is_lost === true || payload?.is_lost === 1,
    message: String(payload?.message ?? ''),
    eventTime: String(payload?.update_time ?? payload?.event_time ?? ''),
    raw: payload
  }
}

export function shipmentUpdateFromGoship(shipment: GoshipShipment): ShipmentUpdate {
  return {
    shipmentId: shipment.id,
    code: shipment.sortingCode || shipment.id,
    statusCode: shipment.status,
    statusText: shipment.statusText,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrierShortName || shipment.carrier,
    carrierName: shipment.carrierShortName || shipment.carrier,
    fee: undefined,
    message: shipment.carrierError,
    eventTime: new Date().toISOString(),
    raw: shipment.raw
  }
}

async function recordShipmentEvent(orderId: string, update: ShipmentUpdate) {
  const code = update.code ?? ''
  const statusCode = update.statusCode ?? 0
  const eventTime = update.eventTime ?? ''
  const dedupeFilter = [
    `order = ${pbQuote(orderId)}`,
    `status_code = ${statusCode}`,
    `code = ${pbQuote(code)}`,
    eventTime ? `event_time = ${pbQuote(eventTime)}` : ''
  ]
    .filter(Boolean)
    .join(' && ')

  const existing = await pbFirst<PbRecord>(EVENT_COLLECTION, { filter: dedupeFilter })
  if (existing) return false

  await pbCreate(EVENT_COLLECTION, {
    order: orderId,
    provider: 'goship',
    code,
    status_code: statusCode,
    status_text: update.statusText ?? '',
    message: update.message ?? '',
    event_time: eventTime,
    raw: update.raw ?? null
  })
  return true
}

export async function listShipmentEvents(orderId: string, limit = 20): Promise<AdminShipmentEvent[]> {
  if (!orderId) return []
  try {
    const result = await pbListPage<PbRecord>(EVENT_COLLECTION, {
      filter: `order = ${pbQuote(orderId)}`,
      sort: '-created',
      perPage: Math.min(50, Math.max(1, limit))
    })
    return result.items.map((item) => ({
      id: item.id,
      statusCode: num(item.status_code),
      statusText: String(item.status_text ?? ''),
      message: String(item.message ?? ''),
      eventTime: String(item.event_time ?? ''),
      createdAt: String(item.created ?? '')
    }))
  } catch {
    return []
  }
}

/** Áp cập nhật vận đơn vào đơn hàng + ghi nhật ký; không đụng tới thanh toán. */
export async function applyShipmentToOrder(order: PbRecord, update: ShipmentUpdate) {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    shipping_provider: 'goship',
    shipping_updated_at: now
  }

  if (update.shipmentId) patch.shipping_shipment_id = update.shipmentId
  if (update.code) patch.shipping_code = update.code
  if (update.statusCode !== undefined) patch.shipping_status_code = update.statusCode
  if (update.statusText !== undefined) patch.shipping_status_text = update.statusText
  if (update.trackingNumber) patch.shipping_tracking_number = update.trackingNumber
  if (update.trackingUrl) patch.shipping_tracking_url = update.trackingUrl
  if (update.carrier) patch.shipping_carrier = update.carrier
  if (update.carrierName) patch.shipping_carrier_name = update.carrierName
  if (update.fee !== undefined) patch.shipping_fee_actual = update.fee
  if (update.cod !== undefined) patch.shipping_cod = update.cod
  if (update.payer !== undefined) patch.shipping_payer = update.payer
  if (update.isReturn) patch.shipping_returning = true
  if (!order.shipping_created_at) patch.shipping_created_at = now

  const fresh = await pbUpdate<PbRecord>('orders', order.id, patch)

  const inserted = await recordShipmentEvent(order.id, update).catch((error) => {
    console.warn('[order-shipping] không ghi được shipment event', order.id, error instanceof Error ? error.message : error)
    return false
  })

  return { order: fresh, eventInserted: inserted }
}

/**
 * Mapping trạng thái Goship sang trạng thái FloraHub, chỉ đi qua máy trạng thái hiện có.
 * Trả cảnh báo để admin xử lý các trường hợp không thể tự chuyển.
 */
export async function advanceOrderStatus(
  order: PbRecord,
  statusCode: number,
  settings: ShippingSettings,
  actor: 'webhook' | 'admin' = 'webhook'
) {
  if (!settings.autoAdvance && actor === 'webhook') return { changed: false, warning: '' }

  const current = String(order.status ?? '')
  const payment = String(order.payment_status ?? '')
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {}
  let warning = ''

  if ([903, 904].includes(statusCode)) {
    if (current === 'confirmed' && canSetOrderStatus(current, 'shipping')) {
      patch.status = 'shipping'
    }
  } else if ([905, 913].includes(statusCode)) {
    if (current === 'shipping' && payment === 'paid' && canSetOrderStatus(current, 'completed')) {
      patch.status = 'completed'
      if (!order.completed_at) patch.completed_at = now
    } else if (payment !== 'paid' && payment !== 'refunded') {
      warning = 'Hãng báo đã giao nhưng đơn chưa xác nhận thanh toán — cần kiểm tra trước khi hoàn tất.'
    }
  } else if ([907, 908].includes(statusCode)) {
    patch.shipping_returning = true
    warning = 'Hãng báo chuyển hoàn — đơn chưa bị huỷ tự động, cần admin xử lý.'
  } else if (statusCode === 914) {
    if (canCancelOrder(current) && payment !== 'paid') {
      patch.status = 'cancelled'
      if (!order.cancelled_at) patch.cancelled_at = now
    } else if (payment === 'paid') {
      warning = 'Hãng báo huỷ nhưng đơn đã thanh toán — cần hoàn tiền thủ công.'
    } else {
      warning = 'Hãng báo huỷ nhưng trạng thái đơn không cho phép huỷ tự động.'
    }
  } else if (statusCode === 1000) {
    warning = 'Hãng báo đơn lỗi — cần admin kiểm tra và xử lý.'
  }

  if (Object.keys(patch).length === 0) return { changed: false, warning }

  const updated = await pbUpdate<PbRecord>('orders', order.id, patch)
  if (patch.status === 'completed') {
    try {
      const sync = await ensureOrderAccounting(updated)
      if (sync.warnings.length) warning = [warning, ...sync.warnings].filter(Boolean).join(' · ')
    } catch (error) {
      warning = [warning, error instanceof Error ? error.message : 'Không đồng bộ được sổ kế toán']
        .filter(Boolean)
        .join(' · ')
    }
    await approveDueCommissionForOrder(updated).catch(() => undefined)
  } else if (patch.status === 'cancelled') {
    await cancelCommissionForOrder(updated.id).catch(() => undefined)
  }
  return { changed: true, warning }
}

async function orderMessage(orderId: string, message: string) {
  const order = await pbFirst<PbRecord>('orders', { filter: `id = ${pbQuote(orderId)}` })
  if (!order) return
  const existing = String(order.shipping_status_text ?? '')
  if (message && !existing.includes(message)) {
    await pbUpdate('orders', orderId, { shipping_status_text: message }).catch(() => undefined)
  }
}

export type OrderQuoteOption = ShippingQuoteOption & { rateId: string }

/** Báo giá lại cho đơn đã đặt (rate cũ hết hạn hoặc admin đổi hãng). Không lưu quote. */
export async function quoteOrderShipping(order: PbRecord): Promise<OrderQuoteOption[]> {
  const settings = await readShippingSettings()
  if (!settings.enabled) {
    throw createError({ statusCode: 400, statusMessage: 'Goship đang tắt trong /admin/shipping' })
  }
  validatePickup(settings)

  const to = {
    ward: String(order.shipping_ward_code_goship ?? ''),
    district: String(order.shipping_district_code ?? ''),
    city: String(order.shipping_city_code ?? '')
  }
  if (!to.ward || !to.district || !to.city) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Đơn thiếu mã địa chỉ Goship — hãy cập nhật địa chỉ giao hàng trước khi báo giá'
    })
  }

  const policy = await readStoreShippingPolicy()
  const amount = Math.max(0, num(order.subtotal) - num(order.discount_total))
  const cod = String(order.payment_method ?? '') === 'cod' ? num(order.total) : 0
  const weight = num(order.shipping_chargeable_weight) || settings.parcel.defaultWeight

  const rates = await getRates({
    addressFrom: rateAddressFromPickup(settings),
    addressTo: { city: to.city, district: to.district },
    parcel: {
      cod,
      amount,
      weight,
      width: settings.parcel.width,
      height: settings.parcel.height,
      length: settings.parcel.length
    }
  })

  const options: OrderQuoteOption[] = rates.map((rate) => {
    const fee = computeCustomerFee(policy, rate.totalFee, amount)
    return {
      id: rate.rateId,
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
  })

  return rankOptions(policy, options)
}

/** Tạo vận đơn Goship cho đơn đã có đủ mã địa chỉ và rate. */
export async function createOrderShipment(order: PbRecord, rateId: string) {
  const settings = await readShippingSettings()
  if (!settings.enabled) {
    throw createError({ statusCode: 400, statusMessage: 'Goship đang tắt trong /admin/shipping' })
  }
  validatePickup(settings)

  // Đã có vận đơn thì chỉ hiển thị hãng đã chọn, không cho tạo lại hãng khác (trừ khi đã huỷ).
  const existingShipment = String(order.shipping_shipment_id ?? order.shipping_code ?? '').trim()
  if (existingShipment && !isShipmentCancelled(order)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Đơn đã có vận đơn — huỷ vận đơn trước khi tạo lại.'
    })
  }

  const to = {
    ward: String(order.shipping_ward_code_goship ?? ''),
    district: String(order.shipping_district_code ?? ''),
    city: String(order.shipping_city_code ?? '')
  }
  if (!to.ward || !to.district || !to.city) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Đơn thiếu mã địa chỉ Goship — hãy báo giá lại và chọn địa chỉ hợp lệ'
    })
  }

  const amount = Math.max(0, num(order.subtotal) - num(order.discount_total))
  const cod = String(order.payment_method ?? '') === 'cod' ? num(order.total) : 0
  const weight = num(order.shipping_chargeable_weight) || settings.parcel.defaultWeight

  const shipment = await createShipment({
    rateId,
    orderId: order.id,
    payer: 1,
    cod,
    amount,
    weight,
    width: settings.parcel.width,
    height: settings.parcel.height,
    length: settings.parcel.length,
    note: String(order.note ?? '').trim() || undefined,
    addressFrom: pickupAddressForShipment(settings),
    addressTo: {
      name: String(order.shipping_name ?? ''),
      phone: String(order.shipping_phone ?? ''),
      street: String(order.shipping_address ?? ''),
      ...to
    }
  })

  const applied = await applyShipmentToOrder(order, shipmentUpdateFromGoship(shipment))
  if (!shipment.id || shipment.carrierError) {
    await orderMessage(
      order.id,
      shipment.carrierError || 'Goship chưa trả mã vận đơn — kiểm tra lại sau hoặc đồng bộ.'
    )
  }

  // Tạo vận đơn là bước xác nhận đơn: chuyển pending → confirmed để webhook 903/904 còn tiến được sang shipping.
  let fresh = applied.order
  const current = String(fresh.status ?? '')
  if (shipment.id && !shipment.carrierError && current === 'pending' && canSetOrderStatus(current, 'confirmed')) {
    fresh = await pbUpdate<PbRecord>('orders', fresh.id, { status: 'confirmed' })
  }

  return { shipment, order: fresh, eventInserted: applied.eventInserted }
}

export async function syncOrderShipment(order: PbRecord) {
  const code = String(order.shipping_code ?? order.shipping_shipment_id ?? '').trim()
  if (!code) throw createError({ statusCode: 400, statusMessage: 'Đơn chưa có mã vận đơn để đồng bộ' })
  const shipment = await getShipment(code)
  if (!shipment) throw createError({ statusCode: 404, statusMessage: 'Goship không trả về vận đơn nào' })
  const settings = await readShippingSettings()
  const applied = await applyShipmentToOrder(order, shipmentUpdateFromGoship(shipment))
  const advance = await advanceOrderStatus(applied.order, shipment.status, settings, 'admin')
  return { shipment, order: applied.order, eventInserted: applied.eventInserted, ...advance }
}

export async function cancelOrderShipment(order: PbRecord) {
  const shipmentId = String(order.shipping_shipment_id ?? '').trim()
  if (!shipmentId) throw createError({ statusCode: 400, statusMessage: 'Đơn chưa có vận đơn để huỷ' })
  await cancelShipment(shipmentId)
  const now = new Date().toISOString()
  await pbCreate(EVENT_COLLECTION, {
    order: order.id,
    provider: 'goship',
    code: String(order.shipping_code ?? ''),
    status_code: 0,
    status_text: 'Đã huỷ vận đơn',
    message: 'Admin huỷ vận đơn trên Goship',
    event_time: now,
    raw: null
  }).catch(() => undefined)
  return pbUpdate<PbRecord>('orders', order.id, {
    shipping_status_text: 'Đã huỷ vận đơn',
    shipping_updated_at: now
  })
}
