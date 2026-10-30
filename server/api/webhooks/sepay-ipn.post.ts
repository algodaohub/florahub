import { timingSafeEqual } from 'node:crypto'
import { findOrder } from '~~/server/utils/order'
import { pbFirst, pbQuote, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { invoiceOrderId, sepayPgSettings } from '~~/server/utils/sepay-pg'
import { syncCommissionAtPayment } from '~~/server/utils/affiliate-commission'

/**
 * IPN của Cổng thanh toán SePay (hosted checkout).
 *
 * Khai báo tại my.sepay.vn → Cổng thanh toán → IPN URL:
 *   https://<domain>/api/webhooks/sepay-ipn
 * Xác thực bằng header `X-Secret-Key` = IPN secret (hoặc merchant secret) trong `payment_settings`.
 */
type SepayIpnPayload = {
  notification_type?: string
  order?: {
    order_id?: string
    order_status?: string
    order_currency?: string
    order_amount?: number | string
    order_invoice_number?: string
  }
  transaction?: {
    id?: number | string
    transaction_id?: string
    transaction_status?: string
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function reject(event: any, status: number, message: string) {
  setResponseStatus(event, status)
  return { success: false, message }
}

export default defineEventHandler(async (event) => {
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  const { ipnSecret } = await sepayPgSettings()

  if (!ipnSecret) return reject(event, 503, 'Chưa cấu hình merchant secret trong /admin/payments')

  const provided = String(getRequestHeader(event, 'x-secret-key') ?? '').trim()
  if (!provided || !safeEqual(provided, ipnSecret)) return reject(event, 401, 'Sai secret key')

  let payload: SepayIpnPayload
  try {
    payload = JSON.parse(raw) as SepayIpnPayload
  } catch {
    return reject(event, 400, 'Body không đọc được')
  }

  if (payload.notification_type !== 'ORDER_PAID') {
    console.info('[sepay-ipn] bỏ qua thông báo', payload.notification_type)
    return { success: true }
  }

  const data = payload.order ?? {}
  const invoice = String(data.order_invoice_number ?? '').trim()
  const byInvoice = invoice
    ? await pbFirst<PbRecord>('orders', { filter: `sepay_invoice_number = ${pbQuote(invoice)}` })
    : null
  const embeddedId = invoiceOrderId(invoice)
  const order = byInvoice ?? (embeddedId ? await findOrder(embeddedId) : null)

  if (!order) {
    console.info('[sepay-ipn] không tìm thấy đơn', { invoice })
    return { success: true }
  }

  if (String(order.payment_status) === 'paid') return { success: true }

  const currency = String(data.order_currency ?? '').toUpperCase()
  const status = String(data.order_status ?? '').toUpperCase()
  const amount = Math.round(Number(data.order_amount ?? 0))
  const expected = Math.round(Number(order.total ?? 0))

  if (currency && currency !== 'VND') {
    console.warn('[sepay-ipn] sai tiền tệ', { order: order.id, currency })
    return { success: true }
  }
  if (status && !['CAPTURED', 'AUTHENTICATION_NOT_NEEDED'].includes(status)) {
    console.warn('[sepay-ipn] trạng thái chưa thu tiền', { order: order.id, status })
    return { success: true }
  }
  if (amount !== expected) {
    console.warn('[sepay-ipn] số tiền không khớp', { order: order.id, amount, expected })
    return { success: true }
  }

  const transactionId = String(payload.transaction?.transaction_id ?? payload.transaction?.id ?? '').trim()
  const sepayOrderId = String(data.order_id ?? '').trim()

  await pbUpdate('orders', order.id, {
    payment_status: 'paid',
    ...(transactionId ? { sepay_transaction_id: transactionId } : {}),
    ...(sepayOrderId ? { sepay_order_id: sepayOrderId } : {}),
    paid_at: new Date().toISOString()
  })
  await syncCommissionAtPayment({ ...order, payment_status: 'paid' }, event).catch(() => undefined)

  console.info('[sepay-ipn] đã xác nhận thanh toán', { order: order.id, amount, transactionId })
  return { success: true }
})
