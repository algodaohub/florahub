import { getCart, serializeCart } from '~~/server/utils/cart'
import { pbDelete, pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ quantity?: number }>(event)
  const quantity = Number(body?.quantity)

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã dòng hàng' })
  if (!Number.isFinite(quantity)) {
    throw createError({ statusCode: 400, statusMessage: 'Số lượng không hợp lệ' })
  }

  const cart = await getCart(event)
  if (!cart) throw createError({ statusCode: 404, statusMessage: 'Giỏ hàng trống' })

  const item = cart.items.find((entry) => entry.id === id)
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy dòng hàng' })

  if (quantity <= 0) {
    await pbDelete('cart_items', item.id)
  } else {
    const variant = await pbGetRecord<PbRecord>('variants', item.variant)
    const max = variant?.manage_inventory ? Math.max(0, Number(variant.inventory_quantity ?? 0)) : 99
    const next = Math.min(99, Math.floor(quantity), max)
    if (next <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Sản phẩm đã hết hàng' })
    }
    await pbUpdate('cart_items', item.id, { quantity: next })
  }

  const updated = await getCart(event)
  return await serializeCart(updated, event)
})
