import { getCart } from '~~/server/utils/cart'
import { createQuote } from '~~/server/utils/shipping-quote'

type QuoteBody = {
  cityCode?: string
  cityName?: string
  wardCode?: string
  wardName?: string
  districtCode?: string
  street?: string
  itemIds?: string[]
  paymentMethod?: string
  promoCode?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<QuoteBody>(event)
  const cart = await getCart(event)
  if (!cart || cart.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Giỏ hàng đang trống' })
  }

  const { quote } = await createQuote(event, {
    cart,
    itemIds: Array.isArray(body?.itemIds) ? body.itemIds : undefined,
    address: {
      cityCode: body?.cityCode,
      cityName: body?.cityName,
      wardCode: body?.wardCode,
      wardName: body?.wardName,
      districtCode: body?.districtCode,
      street: body?.street
    },
    paymentMethod: body?.paymentMethod,
    promoCode: body?.promoCode
  })

  return quote
})
