import { findOrder } from '~~/server/utils/order'
import { readPaymentSettings } from '~~/server/utils/payment-settings'
import { reconcileOrder } from '~~/server/utils/sepay-api'

export default defineEventHandler(async (event) => {
  const order = await findOrder(String(getRouterParam(event, 'id') ?? ''))
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đơn hàng' })
  if (String(order.status) === 'cancelled') {
    throw createError({ statusCode: 400, statusMessage: 'Đơn hàng đã huỷ' })
  }
  if (String(order.payment_status) === 'paid') {
    return { paid: true, checked: false, message: 'Đơn hàng đã được thanh toán.' }
  }
  if (!['qr', 'sepay'].includes(String(order.payment_method))) {
    throw createError({ statusCode: 400, statusMessage: 'Đơn hàng không dùng chuyển khoản' })
  }

  const settings = await readPaymentSettings()
  if (!settings.apiToken) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Chưa cấu hình SePay API token trong /admin/payments'
    })
  }

  const result = await reconcileOrder(order)
  const message = result.paid
    ? 'Đã xác nhận thanh toán. Cảm ơn bạn!'
    : result.reason === 'throttled'
      ? 'Vui lòng thử lại sau ít giây.'
      : 'Chưa thấy giao dịch. Vui lòng thử lại sau ít phút hoặc chờ hệ thống tự xác nhận.'

  return { paid: result.paid, checked: result.checked, message }
})
