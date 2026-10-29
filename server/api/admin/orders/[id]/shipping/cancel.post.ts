import { requireAdminMutation } from '~~/server/utils/admin'
import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { cancelOrderShipment, orderShippingFromRecord } from '~~/server/utils/order-shipping'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true, resource: 'orders', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const order = await pbGetRecord<PbRecord>('orders', id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })

  const updated = await cancelOrderShipment(order)
  return { shipping: orderShippingFromRecord(updated) }
})
