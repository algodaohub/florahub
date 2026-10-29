import { createEventStream } from 'h3'
import type { PbRecord } from '~~/server/utils/pocketbase'
import { pbGetRecord } from '~~/server/utils/pocketbase'
import { findOrder, loadOrderItems, toOrderDetail } from '~~/server/utils/order'
import { readPaymentSettings } from '~~/server/utils/payment-settings'
import { watchRecord } from '~~/server/utils/pb-realtime'
import { reconcileOrder } from '~~/server/utils/sepay-api'

const RECONCILE_INTERVAL_MS = 20_000
const PING_INTERVAL_MS = 25_000

/**
 * SSE cập nhật đơn hàng theo thời gian thực cho trang /orders/<id>.
 * - Cầu nối realtime PocketBase (admin) → browser, không lộ quyền đọc collection.
 * - Trong lúc còn khách mở trang, server tự đối soát SePay mỗi 20s nếu đơn còn pending.
 */
export default defineEventHandler(async (event) => {
  const initial = await findOrder(String(getRouterParam(event, 'id') ?? ''))
  if (!initial) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })

  const orderId = String(initial.id)
  const items = await loadOrderItems([orderId])
  const stream = createEventStream(event)
  const abort = new AbortController()

  let latest = initial
  let closed = false
  let stopWatch: (() => void) | null = null

  const push = async (record: PbRecord) => {
    latest = record
    if (closed) return
    try {
      await stream.push({ event: 'order', data: JSON.stringify(toOrderDetail(record, items)) })
    } catch {
      closed = true
    }
  }

  // Bắt đầu pipe trước khi push để TransformStream luôn có reader (tránh nghẽn backpressure).
  const sending = stream.send()
  await push(initial)

  try {
    stopWatch = await watchRecord('orders', orderId, (record) => void push(record), abort.signal)
  } catch (error) {
    console.warn('[orders] không mở được realtime PocketBase', error instanceof Error ? error.message : error)
  }

  const settings = await readPaymentSettings()
  const pending = () =>
    !closed &&
    ['qr', 'sepay'].includes(String(latest.payment_method ?? '')) &&
    String(latest.payment_status ?? '') === 'pending' &&
    String(latest.status ?? '') !== 'cancelled'

  const reconcileNow = async () => {
    if (!pending()) return
    try {
      const result = await reconcileOrder(latest)
      if (result.paid) {
        const fresh = await pbGetRecord<PbRecord>('orders', orderId)
        if (fresh) await push(fresh)
      }
    } catch (error) {
      console.warn('[orders] đối soát thanh toán lỗi', error instanceof Error ? error.message : error)
    }
  }

  const reconcileTimer = settings.apiToken
    ? setInterval(() => void reconcileNow(), RECONCILE_INTERVAL_MS)
    : null
  if (settings.apiToken) void reconcileNow()

  const pingTimer = setInterval(() => {
    if (closed) return
    stream.push({ event: 'ping', data: '1' }).catch(() => {
      closed = true
    })
  }, PING_INTERVAL_MS)

  stream.onClosed(() => {
    closed = true
    abort.abort()
    stopWatch?.()
    if (reconcileTimer) clearInterval(reconcileTimer)
    clearInterval(pingTimer)
  })

  await sending
})
