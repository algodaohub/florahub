import type { H3Event } from 'h3'
import type { PbRecord } from './pocketbase'
import {
  pbCreate,
  pbDelete,
  pbDeleteWhere,
  pbFirst,
  pbGetRecord,
  pbListAll,
  pbQuote,
  pbUpdate
} from './pocketbase'
import { publicShippingPolicy, readStoreShippingPolicy } from './shipping-policy'
import { readShippingSettings } from './shipping-settings'

export type CartItemRecord = PbRecord & {
  cart: string
  product: string
  variant: string
  quantity: number
  unit_price: number
}

export type HydratedCartItem = CartItemRecord & {
  productRecord: PbRecord
  variantRecord: PbRecord
}

export type CartWithItems = PbRecord & {
  items: HydratedCartItem[]
}

const CART_COOKIE = 'cart_id'
const MAX_AGE = 60 * 60 * 24 * 30

export async function hydrateCart(cart: PbRecord, event?: H3Event | any): Promise<CartWithItems> {
  const items = await pbListAll<CartItemRecord>('cart_items', {
    filter: `cart = ${pbQuote(cart.id)}`,
    sort: 'created'
  })

  const productIds = [...new Set(items.map((item) => String(item.product ?? '')).filter(Boolean))]
  const variantIds = [...new Set(items.map((item) => String(item.variant ?? '')).filter(Boolean))]

  const [products, variants] = await Promise.all([
    productIds.length
      ? pbListAll<PbRecord>('products', {
          filter: productIds.map((id) => `id = ${pbQuote(id)}`).join(' || '),
          expand: 'seller'
        })
      : Promise.resolve([]),
    variantIds.length
      ? pbListAll<PbRecord>('variants', {
          filter: variantIds.map((id) => `id = ${pbQuote(id)}`).join(' || ')
        })
      : Promise.resolve([])
  ])

  const productsById = new Map(products.map((product) => [product.id, product]))
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]))

  return {
    ...cart,
    items: items
      .map((item) => {
        const productRecord = productsById.get(String(item.product))
        const variantRecord = variantsById.get(String(item.variant))
        if (!productRecord || !variantRecord) return null
        return { ...item, productRecord, variantRecord }
      })
      .filter((item): item is HydratedCartItem => Boolean(item))
  }
}

export async function getCart(event: H3Event): Promise<CartWithItems | null> {
  const cartId = getCookie(event, CART_COOKIE)
  if (!cartId) return null

  let cart = cartId.length === 15 ? await pbGetRecord('carts', cartId) : null
  if (!cart) {
    cart = await pbFirst('carts', { filter: `legacy_id = ${pbQuote(cartId)}` })
  }
  if (!cart) return null

  return hydrateCart(cart, event)
}

export async function getOrCreateCart(event: H3Event): Promise<CartWithItems> {
  const existing = await getCart(event)
  if (existing) return existing

  const region = await pbFirst('regions', { sort: 'name' })
  const now = new Date().toISOString()
  const cart = await pbCreate('carts', {
    ...(region ? { region: region.id } : {}),
    created_at: now,
    updated_at: now
  })

  setCookie(event, CART_COOKIE, cart.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE
  })

  return { ...cart, items: [] }
}

export async function serializeCart(cart: CartWithItems | null, event?: H3Event | any) {
  const settings = await readShippingSettings()
  const policy = await readStoreShippingPolicy(event)
  const shippingPolicy = publicShippingPolicy(policy, settings.codEnabled)

  if (!cart) {
    return {
      id: null,
      items: [],
      count: 0,
      subtotal: 0,
      shipping: 0,
      shippingPending: false,
      shippingRequired: false,
      shippingPolicy,
      total: 0
    }
  }

  const items = cart.items.map((item) => ({
    id: item.id,
    productId: item.product,
    variantId: item.variant,
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
    lineTotal: Number(item.unit_price ?? 0) * Number(item.quantity ?? 0),
    product: {
      id: item.productRecord.id,
      handle: item.productRecord.handle,
      title: item.productRecord.title,
      thumbnail: item.productRecord.thumbnail,
      unit: item.productRecord.unit,
      seller: item.productRecord.expand?.seller?.name ?? ''
    },
    variant: {
      id: item.variantRecord.id,
      title: item.variantRecord.title,
      optionsJson: item.variantRecord.options_json || '[]',
      inventoryQuantity: Number(item.variantRecord.inventory_quantity ?? 0)
    }
  }))

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const shippingRequired = cart.items.some((item) => {
    const type = String(item.productRecord.type ?? 'physical')
    return type === 'physical' && item.productRecord.requires_shipping !== false
  })

  // Phí giao do server báo giá ở bước thanh toán; giỏ hàng chỉ tạm tính tiền hàng.
  return {
    id: cart.id,
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    shipping: shippingRequired ? null : 0,
    shippingPending: shippingRequired,
    shippingRequired,
    shippingPolicy,
    total: subtotal
  }
}

export async function clearCartCookie(event: H3Event) {
  deleteCookie(event, CART_COOKIE, { path: '/' })
}

export async function addCartItem(
  cart: CartWithItems,
  input: { productId: string; variantId: string; quantity: number; unitPrice: number; maxStock: number }
) {
  const existing = await pbFirst<CartItemRecord>('cart_items', {
    filter: `cart = ${pbQuote(cart.id)} && variant = ${pbQuote(input.variantId)}`
  })

  if (existing) {
    await pbUpdate('cart_items', existing.id, {
      quantity: Math.min(99, input.maxStock, Number(existing.quantity ?? 0) + input.quantity),
      unit_price: input.unitPrice
    })
  } else {
    await pbCreate('cart_items', {
      cart: cart.id,
      product: input.productId,
      variant: input.variantId,
      quantity: Math.min(input.quantity, input.maxStock),
      unit_price: input.unitPrice
    })
  }
}

export async function removeCartItems(cartId: string, itemIds: string[]) {
  for (const id of itemIds) {
    await pbDelete('cart_items', id)
  }
  const remaining = await pbListAll('cart_items', {
    filter: `cart = ${pbQuote(cartId)}`,
    fields: 'id'
  })
  return remaining.length
}

export async function clearCartItems(cartId: string) {
  await pbDeleteWhere('cart_items', `cart = ${pbQuote(cartId)}`)
}

/** Giá bán thực tế: flash sale đang chạy, nếu không thì giá biến thể. */
export async function resolveUnitPrice(variant: PbRecord, fallback: number) {
  const now = Date.now()
  const items = await pbListAll<PbRecord>('flash_sale_items', {
    filter: `variant = ${pbQuote(variant.id)}`,
    sort: 'sale_price'
  })

  for (const item of items) {
    const sale = await pbGetRecord<PbRecord>('flash_sales', String(item.flash_sale ?? ''))
    if (!sale || !sale.active) continue
    const startsAt = new Date(String(sale.starts_at ?? '')).getTime()
    const endsAt = new Date(String(sale.ends_at ?? '')).getTime()
    if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && endsAt >= now) {
      return Number(item.sale_price ?? fallback)
    }
  }

  return fallback
}
