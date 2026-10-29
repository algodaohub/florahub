import { findOrder } from '~~/server/utils/order'
import { pbUpdate } from '~~/server/utils/pocketbase'
import { buildSepayCheckout } from '~~/server/utils/sepay-pg'

export default defineEventHandler(async (event) => {
  const order = await findOrder(String(getRouterParam(event, 'id') ?? ''))
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })
  if (String(order.payment_method) !== 'sepay') {
    throw createError({ statusCode: 400, statusMessage: 'Đơn hàng không dùng thanh toán SePay' })
  }
  if (String(order.status) === 'cancelled') {
    throw createError({ statusCode: 400, statusMessage: 'Đơn hàng đã huỷ' })
  }
  if (String(order.payment_status) === 'paid') {
    return { paid: true as const }
  }

  const checkout = await buildSepayCheckout(event, order)
  await pbUpdate('orders', order.id, { sepay_invoice_number: checkout.invoice })

  return { paid: false as const, action: checkout.action, fields: checkout.fields }
})
