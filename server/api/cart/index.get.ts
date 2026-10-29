export default defineEventHandler(async (event) => {
  const cart = await getCart(event)
  return await serializeCart(cart, event)
})
