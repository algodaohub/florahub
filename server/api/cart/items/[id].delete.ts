import { getCart, serializeCart } from '~~/server/utils/cart'
import { pbDelete } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã dòng hàng' })

  const cart = await getCart(event)
  if (!cart) throw createError({ statusCode: 404, statusMessage: 'Giỏ hàng trống' })

  const item = cart.items.find((entry) => entry.id === id)
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy dòng hàng' })

  await pbDelete('cart_items', item.id)

  const updated = await getCart(event)
  return await serializeCart(updated, event)
})
