import { requireAdminMutation } from '~~/server/utils/admin'
import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { createOrderShipment, orderShippingFromRecord } from '~~/server/utils/order-shipping'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true, resource: 'orders', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const order = await pbGetRecord<PbRecord>('orders', id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })
  if (['cancelled', 'completed'].includes(String(order.status ?? ''))) {
    throw createError({ statusCode: 400, statusMessage: 'Đơn đã kết thúc — không tạo vận đơn' })
  }

  const body = await readBody<{ rateId?: string }>(event).catch(() => null)
  const rateId = String(body?.rateId ?? '').trim()
  if (!rateId || rateId.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Thiếu mã giá vận chuyển (rateId)' })
  }

  const result = await createOrderShipment(order, rateId)

  return {
    shipping: orderShippingFromRecord(result.order),
    eventInserted: result.eventInserted,
    carrierError: result.shipment.carrierError
  }
})
