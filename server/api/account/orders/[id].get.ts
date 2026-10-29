import { requirePbUser, pbFirst, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { loadOrderItems, toOrderDetail } from '~~/server/utils/order'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã đơn hàng' })

  const { record } = await requirePbUser(event)
  const ownership = `(user = ${pbQuote(record.id)} || email = ${pbQuote(record.email)})`

  const order = await pbFirst<PbRecord>('orders', {
    filter: `(id = ${pbQuote(id)} || legacy_id = ${pbQuote(id)}) && ${ownership}`
  })
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })

  const items = await loadOrderItems([order.id])
  return toOrderDetail(order, items)
})
