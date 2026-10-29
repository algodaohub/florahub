import { addCartItem, hydrateCart, resolveUnitPrice, serializeCart } from './cart'
import { findOrder, loadOrderItems, toOrderDetail } from './order'
import { placeOrder, priceOrder } from './place-order'
import { pbCreate, pbDelete, pbFirst, pbGetRecord, pbUpdate, type PbRecord } from './pocketbase'
import { getStoreConfig } from './store'
import { resolvePaymentMethodForServer, sepayPublicBaseUrl } from './sepay-pg'
import { buildVietQrUrl, paymentMethodLabels } from '~~/utils/payments'
import { paymentReadiness, readPaymentSettings } from './payment-settings'

const CART_ID = /^[a-z0-9]{15}$/i

async function requireAgentCart(cartId: string) {
  const id = String(cartId ?? '').trim()
  if (!CART_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'cart_id không hợp lệ' })
  const cart = await pbGetRecord<PbRecord>('carts', id)
  if (!cart) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy giỏ hàng' })
  return hydrateCart(cart)
}

export async function createAgentCart() {
  const region = await pbFirst<PbRecord>('regions', { sort: 'name' })
  const now = new Date().toISOString()
  return pbCreate<PbRecord>('carts', {
    ...(region ? { region: region.id } : {}),
    created_at: now,
    updated_at: now
  })
}

export async function getAgentCart(event: any, cartId: string) {
  return serializeCart(await requireAgentCart(cartId), event)
}

export async function addAgentCartItem(event: any, cartId: string, variantId: string, quantity: number) {
  const cart = await requireAgentCart(cartId)
  const variant = await pbGetRecord<PbRecord>('variants', String(variantId ?? '').trim())
  if (!variant) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy biến thể sản phẩm' })

  const maxStock = variant.manage_inventory ? Math.max(0, Number(variant.inventory_quantity ?? 0)) : 99
  if (maxStock <= 0) throw createError({ statusCode: 400, statusMessage: 'Sản phẩm đã hết hàng' })

  const amount = Math.min(99, Math.max(1, Number(quantity ?? 1) || 1))
  const unitPrice = await resolveUnitPrice(variant, Number(variant.price ?? 0))

  await addCartItem(cart, {
    productId: String(variant.product),
    variantId: variant.id,
    quantity: amount,
    unitPrice,
    maxStock
  })

  return serializeCart(await hydrateCart(cart), event)
}

export async function updateAgentCartItem(event: any, cartId: string, itemId: string, quantity: number) {
  await requireAgentCart(cartId)
  const item = await pbGetRecord<PbRecord>('cart_items', String(itemId ?? '').trim())
  if (!item || String(item.cart) !== String(cartId)) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm trong giỏ' })
  }

  const variant = await pbGetRecord<PbRecord>('variants', String(item.variant ?? ''))
  const maxStock = variant?.manage_inventory ? Math.max(0, Number(variant.inventory_quantity ?? 0)) : 99
  if (maxStock <= 0) throw createError({ statusCode: 400, statusMessage: 'Sản phẩm đã hết hàng' })

  await pbUpdate('cart_items', item.id, {
    quantity: Math.min(99, maxStock, Math.max(1, Number(quantity ?? 1) || 1))
  })

  return serializeCart(await requireAgentCart(cartId), event)
}

export async function removeAgentCartItem(event: any, cartId: string, itemId: string) {
  await requireAgentCart(cartId)
  const item = await pbGetRecord<PbRecord>('cart_items', String(itemId ?? '').trim())
  if (!item || String(item.cart) !== String(cartId)) {
    throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm trong giỏ' })
  }

  await pbDelete('cart_items', item.id)
  return serializeCart(await requireAgentCart(cartId), event)
}

/** Thông tin thanh toán: VietQR miễn phí, COD hoặc cổng SePay (có phí) theo cấu hình cửa hàng. */
export async function agentPaymentInfo(event: any, amount: number, orderId = '') {
  const { config } = await getStoreConfig(event)
  const method = await resolvePaymentMethodForServer(config.payments)

  if (method === 'sepay') {
    const base = await sepayPublicBaseUrl(event)
    const payUrl = base && orderId ? `${base}/orders/${orderId}` : ''
    return {
      method: 'sepay' as const,
      label: paymentMethodLabels.sepay,
      amount,
      ...(payUrl ? { payUrl } : {}),
      instructions: orderId
        ? `Thanh toán online qua cổng SePay (có phí; thẻ quốc tế, VietQR, NAPAS): ${payUrl}`
        : 'Thanh toán online qua cổng SePay (có phí; thẻ quốc tế, VietQR, NAPAS) sau khi tạo đơn.'
    }
  }

  const qr = config.payments.qr
  const ready = method === 'qr' && Boolean(qr.bankId.trim() && qr.accountNo.trim())

  if (!ready) {
    return {
      method: 'cod' as const,
      label: paymentMethodLabels.cod,
      instructions: 'Thanh toán khi nhận hàng. FloraHub xác nhận đơn qua số điện thoại trước khi giao.'
    }
  }

  const readiness = paymentReadiness(await readPaymentSettings())
  const autoConfirm = readiness.webhook || readiness.api

  return {
    method: 'qr' as const,
    label: paymentMethodLabels.qr,
    bankName: qr.bankName || qr.bankId,
    bankId: qr.bankId,
    accountNo: qr.accountNo,
    accountName: qr.accountName,
    amount,
    addInfo: orderId || 'FloraHub',
    autoConfirm,
    qrUrl: buildVietQrUrl(config.payments, { amount, addInfo: orderId || 'FloraHub' }),
    instructions: `Chuyển khoản ${amount}₫ tới ${qr.bankName || qr.bankId} · ${qr.accountNo} · ${qr.accountName}. Nội dung: ${
      orderId || 'FloraHub'
    }. ${autoConfirm ? 'Đơn tự xác nhận khi tiền về.' : 'Shop sẽ xác nhận sau khi nhận được tiền.'}`
  }
}

export async function previewAgentOrder(event: any, cartId: string, promoCode = '') {
  const cart = await requireAgentCart(cartId)
  if (cart.items.length === 0) throw createError({ statusCode: 400, statusMessage: 'Giỏ hàng đang trống' })

  const priced = await priceOrder(event, cart, { promoCode })
  return {
    cartId,
    items: (await serializeCart(cart, event)).items,
    subtotal: priced.subtotal,
    discount: priced.discount,
    shipping: priced.shipping,
    total: priced.total,
    quantity: priced.quantity,
    currency: 'VND',
    payment: await agentPaymentInfo(event, priced.total)
  }
}

export async function createAgentOrder(
  event: any,
  input: {
    cartId: string
    name: string
    phone: string
    email: string
    address: string
    note?: string
    promoCode?: string
    expectedTotal: number
    confirm?: boolean
  }
) {
  if (input.confirm !== true) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cần confirm: true sau khi khách đã đồng ý người bán, sản phẩm, số lượng và tổng tiền.'
    })
  }

  const cart = await requireAgentCart(input.cartId)
  if (cart.items.length === 0) throw createError({ statusCode: 400, statusMessage: 'Giỏ hàng đang trống' })

  const priced = await priceOrder(event, cart, { promoCode: input.promoCode })
  const expected = Math.round(Number(input.expectedTotal ?? 0))
  if (expected !== priced.total) {
    throw createError({
      statusCode: 409,
      statusMessage: `Tổng tiền đã đổi: ${priced.total}₫ (khách xác nhận ${expected}₫). Gọi preview_order lại rồi xác nhận.`
    })
  }

  const placed = await placeOrder(
    event,
    {
      email: input.email,
      name: input.name,
      phone: input.phone,
      address: input.address,
      note: input.note,
      promoCode: input.promoCode
    },
    cart
  )

  const order = await pbGetRecord<PbRecord>('orders', placed.orderId)
  const items = await loadOrderItems([placed.orderId])

  return {
    order: order ? toOrderDetail(order, items) : { id: placed.orderId, total: placed.total },
    payment: await agentPaymentInfo(event, placed.total, placed.orderId)
  }
}

/** Tra đơn phải khớp email người đặt, tránh lộ đơn của khách khác. */
export async function getAgentOrder(event: any, orderId: string, email: string) {
  const order = await findOrder(String(orderId ?? '').trim())
  if (!order) return null
  if (String(order.email ?? '').trim().toLowerCase() !== String(email ?? '').trim().toLowerCase()) return null

  const items = await loadOrderItems([order.id])
  return {
    order: toOrderDetail(order, items),
    payment: await agentPaymentInfo(event, Number(order.total ?? 0), order.id)
  }
}
