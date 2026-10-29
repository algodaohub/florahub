import { clearCartItems, getCart, serializeCart } from '~~/server/utils/cart'

export default defineEventHandler(async (event) => {
  const cart = await getCart(event)
  if (!cart) return await serializeCart(null, event)

  await clearCartItems(cart.id)
  return await serializeCart({ ...cart, items: [] }, event)
})
