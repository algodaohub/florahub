import { placeOrder, type PlaceOrderBody } from '~~/server/utils/place-order'

export default defineEventHandler(async (event) => {
  const body = await readBody<PlaceOrderBody>(event)
  return placeOrder(event, body ?? {})
})
