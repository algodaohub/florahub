import { requireAdminMutation } from '~~/server/utils/admin'
import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { quoteOrderShipping } from '~~/server/utils/order-shipping'

/** Báo giá lại cho đơn đã đặt, dùng khi rate cũ hết hạn hoặc admin muốn đổi hãng. */
export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true, resource: 'orders', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const order = await pbGetRecord<PbRecord>('orders', id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })
  if (['cancelled', 'completed'].includes(String(order.status ?? ''))) {
    throw createError({ statusCode: 400, statusMessage: 'Đơn đã kết thúc — không báo giá vận chuyển' })
  }

  return {
    orderId: order.id,
    quotedAt: new Date().toISOString(),
    options: await quoteOrderShipping(order)
  }
})
