import { findOrder, loadOrderItems, toOrderDetail } from '~~/server/utils/order'
import { pbFirst, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { readPaymentSettings } from '~~/server/utils/payment-settings'
import { reconcileOrder } from '~~/server/utils/sepay-api'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  let order = await findOrder(id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })

  // Polling trang đơn gọi ?check=1: đối soát với SePay Open API (throttle theo đơn).
  if (String(getQuery(event).check ?? '') === '1') {
    const payable =
      String(order.payment_status ?? '') === 'pending' &&
      String(order.status ?? '') !== 'cancelled' &&
      ['qr', 'sepay'].includes(String(order.payment_method))
    if (payable) {
      try {
        const settings = await readPaymentSettings()
        if (settings.apiToken) {
          const result = await reconcileOrder(order)
          if (result.paid) {
            order =
              (await pbFirst<PbRecord>('orders', { filter: `id = ${pbQuote(order.id)}` })) ?? order
          }
        }
      } catch (error) {
        console.warn('[orders] đối soát thanh toán lỗi', error instanceof Error ? error.message : error)
      }
    }
  }

  const items = await loadOrderItems([order.id])
  return toOrderDetail(order, items)
})
