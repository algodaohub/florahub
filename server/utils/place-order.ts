import { AFFILIATE_COOKIE, effectiveAffiliateRate, findAffiliateByCode } from './affiliate'
import { getCart, removeCartItems, type CartWithItems } from './cart'
import { optionalPbUser, pbCreate, pbUpdate } from './pocketbase'
import { getStoreConfig } from './store'
import { calculateDiscount, findActivePromotion } from './promotion'
import { resolvePaymentMethodForServer } from './sepay-pg'
import { fallbackShippingFee, readStoreShippingPolicy } from './shipping-policy'
import { markQuoteUsed, validateQuote, type ValidatedQuote } from './shipping-quote'
import { initialPaymentStatus, resolvePaymentMethod } from '~~/utils/payments'
import { vatFromGross } from '~~/utils/accounting'

export type PlaceOrderBody = {
  email?: string
  name?: string
  phone?: string
  address?: string
  note?: string
  promoCode?: string
  itemIds?: string[]
  shippingQuoteId?: string
  shippingOptionId?: string
  cityCode?: string
  wardCode?: string
  districtCode?: string
  cityName?: string
  wardName?: string
}

export type PricedOrder = {
  items: CartWithItems['items']
  subtotal: number
  discount: number
  shipping: number
  shippingRequired: boolean
  shippingQuote: ValidatedQuote | null
  total: number
  quantity: number
  promotion: Awaited<ReturnType<typeof findActivePromotion>>
  paymentMethod: ReturnType<typeof resolvePaymentMethod>
  storeConfig: Awaited<ReturnType<typeof getStoreConfig>>['config']
}

function requiresShipping(item: CartWithItems['items'][number]) {
  const product = item.productRecord
  return String(product.type ?? 'physical') === 'physical' && product.requires_shipping !== false
}

/** Phí giao lấy từ quote server-side; chỉ dùng phí dự phòng khi shop cấu hình `flat`. */
async function priceShipping(
  event: any,
  cart: CartWithItems,
  body: PlaceOrderBody,
  items: CartWithItems['items'],
  subtotal: number,
  discount: number,
  config: PricedOrder['storeConfig']
) {
  if (!items.some(requiresShipping)) {
    return { shipping: 0, shippingRequired: false, shippingQuote: null as ValidatedQuote | null }
  }

  const quoteId = String(body.shippingQuoteId ?? '').trim()
  if (quoteId) {
    const cityCode = String(body.cityCode ?? '').trim()
    const wardCode = String(body.wardCode ?? '').trim()
    const districtCode = String(body.districtCode ?? '').trim()
    const address =
      cityCode || wardCode || districtCode
        ? {
            cityCode,
            wardCode,
            districtCode,
            cityName: body.cityName,
            wardName: body.wardName,
            street: body.address
          }
        : undefined

    const shippingQuote = await validateQuote(event, {
      quoteId,
      optionId: body.shippingOptionId,
      cart,
      itemIds: body.itemIds,
      subtotal,
      discount,
      address
    })
    return { shipping: shippingQuote.shippingTotal, shippingRequired: true, shippingQuote }
  }

  const policy = await readStoreShippingPolicy(event, config)
  if (policy.fallbackBehavior !== 'flat') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vui lòng chọn phương án vận chuyển trước khi đặt hàng',
      data: { code: 'SHIPPING_QUOTE_REQUIRED' }
    })
  }
  return {
    shipping: fallbackShippingFee(policy, Math.max(0, subtotal - discount)),
    shippingRequired: true,
    shippingQuote: null
  }
}

function orderShippingFields(quote: ValidatedQuote | null, now: string) {
  if (!quote) return {}
  const address = quote.address
  return {
    shipping_provider: quote.mode === 'live' ? 'goship' : 'fallback',
    shipping_quote_id: quote.recordId,
    shipping_option_id: quote.option.id,
    shipping_carrier: quote.option.carrier,
    shipping_carrier_name: quote.option.carrierName,
    shipping_service: quote.option.service,
    shipping_rate_id: quote.option.rateId,
    shipping_fee_quoted: quote.carrierFee,
    shipping_cod: quote.cod,
    shipping_payer: 1,
    shipping_chargeable_weight: quote.parcel?.chargeableWeight ?? 0,
    shipping_city_name: address?.city ?? '',
    shipping_district_name: address?.district ?? '',
    shipping_ward_name: address?.ward ?? '',
    shipping_city_code: address?.cityCode ?? '',
    shipping_district_code: address?.districtCode ?? '',
    shipping_ward_code_goship: address?.wardCode ?? '',
    shipping_updated_at: now
  }
}

/** Tính tiền một giỏ hàng theo cùng quy tắc với trang thanh toán. */
export async function priceOrder(event: any, cart: CartWithItems, body: PlaceOrderBody = {}): Promise<PricedOrder> {
  const requestedIds = Array.isArray(body.itemIds)
    ? new Set(body.itemIds.map((id) => String(id)).filter(Boolean))
    : null
  const items = requestedIds ? cart.items.filter((item) => requestedIds.has(item.id)) : cart.items
  if (items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng chọn sản phẩm để thanh toán' })
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price ?? 0) * Number(item.quantity ?? 0), 0)
  const { config } = await getStoreConfig(event)
  const quantity = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)

  const minQuantity = config.features.minOrderQuantity
  if (minQuantity > 1 && quantity < minQuantity) {
    const unit = items[0]?.productRecord?.unit || 'sản phẩm'
    throw createError({
      statusCode: 400,
      statusMessage: `Đơn tối thiểu ${minQuantity} ${unit}. Cần thêm ${minQuantity - quantity} ${unit}.`
    })
  }

  const promoCode = String(body.promoCode ?? '').trim()
  const promotion = promoCode ? await findActivePromotion(promoCode) : null
  const discount = calculateDiscount(promotion, subtotal)
  const { shipping, shippingRequired, shippingQuote } = await priceShipping(
    event,
    cart,
    body,
    items,
    subtotal,
    discount,
    config
  )

  return {
    items,
    subtotal,
    discount,
    shipping,
    shippingRequired,
    shippingQuote,
    total: subtotal - discount + shipping,
    quantity,
    promotion,
    paymentMethod: await resolvePaymentMethodForServer(config.payments),
    storeConfig: config
  }
}

/** Tạo đơn thật từ giỏ hàng. Dùng chung cho trang thanh toán và MCP. */
export async function placeOrder(event: any, body: PlaceOrderBody, cartOverride?: CartWithItems | null) {
  const auth = await optionalPbUser(event)
  const email = String(body.email ?? auth?.record.email ?? '').trim()
  const name = String(body.name ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const address = String(body.address ?? '').trim()
  const note = String(body.note ?? '').trim()

  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Email không hợp lệ' })
  }
  if (!name || !phone || !address) {
    throw createError({ statusCode: 400, statusMessage: 'Vui lòng nhập đủ họ tên, số điện thoại và địa chỉ' })
  }

  const cart = cartOverride ?? (await getCart(event))
  if (!cart || cart.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Giỏ hàng đang trống' })
  }

  const priced = await priceOrder(event, cart, body)
  const paymentStatus = initialPaymentStatus(priced.paymentMethod)

  // Giá bán đã bao gồm GTGT: tách thuế từ tổng, không đổi số tiền khách trả.
  const taxRate = Math.min(100, Math.max(0, Math.round(Number(priced.storeConfig.features.taxRate ?? 0))))
  const taxTotal = vatFromGross(priced.total, taxRate)

  const referralCode = String(getCookie(event, AFFILIATE_COOKIE) ?? '').trim().toUpperCase()
  const affiliate = referralCode ? await findAffiliateByCode(referralCode) : null
  const validAffiliate =
    affiliate && affiliate.status === 'active' && affiliate.user !== auth?.record.id ? affiliate : null
  // Hoa hồng chỉ trên tiền hàng sau giảm giá (đã gồm VAT), không gồm phí vận chuyển.
  const commissionBase = Math.max(0, priced.subtotal - priced.discount)
  const commissionRate = validAffiliate ? effectiveAffiliateRate(priced.storeConfig, validAffiliate) : 0
  const commission = Math.round((commissionBase * commissionRate) / 100)

  const now = new Date().toISOString()
  const regionCityCode = String(body.cityCode ?? '').trim()
  const regionWardCode = String(body.wardCode ?? '').trim()
  const order = await pbCreate('orders', {
    ...(auth?.record.id ? { user: auth.record.id } : {}),
    ...(validAffiliate ? { affiliate: validAffiliate.id } : {}),
    // Mã vùng 2 cấp khách chọn ở checkout — dùng lại khi admin sửa địa chỉ đơn hàng.
    ...(regionCityCode ? { shipping_region_city_code: regionCityCode } : {}),
    ...(regionWardCode ? { shipping_region_ward_code: regionWardCode } : {}),
    email,
    status: 'pending',
    payment_method: priced.paymentMethod,
    payment_status: paymentStatus,
    subtotal: priced.subtotal,
    shipping_total: priced.shipping,
    discount_total: priced.discount,
    tax_rate: taxRate,
    tax_total: taxTotal,
    total: priced.total,
    affiliate_commission: commission,
    shipping_name: name,
    shipping_phone: phone,
    shipping_address: address,
    ...orderShippingFields(priced.shippingQuote, now),
    ...(note ? { note } : {}),
    created_at: now
  })

  if (priced.shippingQuote) {
    await markQuoteUsed(priced.shippingQuote.recordId, order.id)
  }

  for (const item of priced.items) {
    await pbCreate('order_items', {
      order: order.id,
      product: item.product,
      variant: item.variant,
      title: item.productRecord.title,
      variant_title: item.variantRecord.title,
      thumbnail: item.productRecord.thumbnail,
      unit_price: Number(item.unit_price ?? 0),
      quantity: Number(item.quantity ?? 0)
    })
  }

  if (validAffiliate && commission > 0) {
    await pbCreate('affiliate_commissions', {
      affiliate: validAffiliate.id,
      order: order.id,
      amount: commission,
      rate: commissionRate,
      status: 'pending'
    })
  }

  const remainingItems = await removeCartItems(
    cart.id,
    priced.items.map((item) => item.id)
  )

  await pbUpdate('carts', cart.id, {
    completed_at: remainingItems === 0 ? now : null,
    updated_at: now
  })

  if (remainingItems === 0) deleteCookie(event, 'cart_id', { path: '/' })
  deleteCookie(event, 'promo_code', { path: '/' })
  deleteCookie(event, 'checkout_items', { path: '/' })

  return {
    orderId: order.id,
    total: Number(order.total ?? 0),
    paymentMethod: priced.paymentMethod,
    itemCount: priced.quantity,
    remainingItems,
    shipping: priced.shipping,
    discount: priced.discount,
    subtotal: priced.subtotal,
    email
  }
}
