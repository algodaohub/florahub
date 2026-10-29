import { calculateDiscount, findActivePromotion } from '~~/server/utils/promotion'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ code?: string; subtotal?: number }>(event)
  const code = String(body?.code ?? '').trim()
  const subtotal = Math.max(0, Math.round(Number(body?.subtotal ?? 0)))

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập mã giảm giá' })
  }

  const promotion = await findActivePromotion(code)
  if (!promotion) {
    throw createError({ statusCode: 404, statusMessage: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' })
  }

  const discount = calculateDiscount(promotion, subtotal)
  if (discount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Mã giảm giá chưa áp dụng được cho đơn này' })
  }

  return {
    code: promotion.code,
    type: promotion.type,
    value: promotion.value,
    discount
  }
})
