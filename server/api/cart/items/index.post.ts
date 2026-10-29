import { addCartItem, getOrCreateCart, hydrateCart, resolveUnitPrice, serializeCart } from '~~/server/utils/cart'
import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ variantId?: string; quantity?: number }>(event)
  const variantId = String(body?.variantId ?? '')
  const quantity = Math.min(99, Math.max(1, Number(body?.quantity ?? 1) || 1))

  if (!variantId) {
    throw createError({ statusCode: 400, statusMessage: 'Thiếu variantId' })
  }

  const variant = await pbGetRecord<PbRecord>('variants', variantId)
  if (!variant) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy biến thể sản phẩm' })
  }

  const maxStock = variant.manage_inventory ? Math.max(0, Number(variant.inventory_quantity ?? 0)) : 99
  if (maxStock <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Sản phẩm đã hết hàng' })
  }

  const unitPrice = await resolveUnitPrice(variant, Number(variant.price ?? 0))
  const cart = await getOrCreateCart(event)

  await addCartItem(cart, {
    productId: String(variant.product),
    variantId: variant.id,
    quantity,
    unitPrice,
    maxStock
  })

  const updated = await hydrateCart(cart, event)
  return await serializeCart(updated, event)
})
