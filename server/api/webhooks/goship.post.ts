import { createHmac, timingSafeEqual } from 'node:crypto'
import { findOrder } from '~~/server/utils/order'
import {
  advanceOrderStatus,
  applyShipmentToOrder,
  shipmentUpdateFromWebhook
} from '~~/server/utils/order-shipping'
import { pbFirst, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { readShippingSettings, readWebhookSecret } from '~~/server/utils/shipping-settings'

/**
 * Webhook Goship: cập nhật vận đơn + nhật ký, tự chuyển trạng thái nếu bật `auto_advance`.
 *
 * URL khai báo khi đăng ký webhook (nút trong /admin/shipping): https://<domain>/api/webhooks/goship
 * Xác thực: `x-goship-hmac-sha256` = base64(HMAC-SHA256(raw_body, client_secret)).
 */
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function reject(event: any, status: number, message: string) {
  setResponseStatus(event, status)
  return { success: false, message }
}

async function findOrderForPayload(payload: any, update: ReturnType<typeof shipmentUpdateFromWebhook>) {
  const orderId = String(payload?.order_id ?? '').trim()
  if (orderId) {
    const byId = await findOrder(orderId)
    if (byId) return byId
  }

  const filters: string[] = []
  if (update.code) filters.push(`shipping_code = ${pbQuote(update.code)}`)
  if (update.shipmentId) filters.push(`shipping_shipment_id = ${pbQuote(update.shipmentId)}`)
  if (filters.length === 0) return null
  return pbFirst<PbRecord>('orders', { filter: filters.join(' || ') })
}

export default defineEventHandler(async (event) => {
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  if (!raw) return reject(event, 400, 'Body rỗng')

  const secret = await readWebhookSecret()
  if (!secret) return reject(event, 503, 'Chưa cấu hình client secret trong /admin/shipping')

  const provided = String(getRequestHeader(event, 'x-goship-hmac-sha256') ?? '').trim()
  const expected = createHmac('sha256', secret).update(raw).digest('base64')
  if (!provided || !safeEqual(expected, provided)) return reject(event, 401, 'Sai chữ ký')

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return reject(event, 400, 'Body không đọc được')
  }
  if (!payload || typeof payload !== 'object') return reject(event, 400, 'Body không hợp lệ')

  const update = shipmentUpdateFromWebhook(payload)
  const order = await findOrderForPayload(payload, update)
  if (!order) {
    console.info('[goship] không tìm thấy đơn cho webhook', {
      orderId: (payload as any)?.order_id,
      code: update.code
    })
    return { success: true }
  }

  const applied = await applyShipmentToOrder(order, update)
  const settings = await readShippingSettings()
  const advance = advanceOrderStatus(applied.order, update.statusCode ?? 0, settings, 'webhook')

  console.info('[goship] webhook', {
    order: order.id,
    code: update.code,
    status: update.statusCode,
    eventInserted: applied.eventInserted
  })

  return { success: true }
})
