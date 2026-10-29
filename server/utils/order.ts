import { pbFirst, pbListAll, pbQuote, type PbRecord } from './pocketbase'

export function toOrderDetail(order: PbRecord, items: PbRecord[]) {
  return {
    id: order.id,
    email: order.email,
    status: order.status,
    subtotal: Number(order.subtotal ?? 0),
    shippingTotal: Number(order.shipping_total ?? 0),
    discountTotal: Number(order.discount_total ?? 0),
    taxTotal: Number(order.tax_total ?? 0),
    total: Number(order.total ?? 0),
    paymentMethod: order.payment_method || 'cod',
    paymentStatus: order.payment_status || '',
    sepayInvoiceNumber: order.sepay_invoice_number || '',
    sepayOrderId: order.sepay_order_id || '',
    shippingName: order.shipping_name,
    shippingPhone: order.shipping_phone,
    shippingAddress: order.shipping_address,
    note: order.note || null,
    createdAt: order.created_at || order.created,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title,
      thumbnail: item.thumbnail,
      unitPrice: Number(item.unit_price ?? 0),
      quantity: Number(item.quantity ?? 0)
    }))
  }
}

export async function loadOrderItems(orderIds: string[]) {
  if (orderIds.length === 0) return []
  return pbListAll<PbRecord>('order_items', {
    filter: orderIds.map((id) => `order = ${pbQuote(id)}`).join(' || ')
  })
}

export async function findOrder(id: string) {
  const direct = await pbFirst<PbRecord>('orders', {
    filter: `id = ${pbQuote(id)} || legacy_id = ${pbQuote(id)}`
  })
  if (direct) return direct

  const suffix = id
    .trim()
    .replace(/^#/, '')
    .replace(/^ord-/i, '')
    .toLowerCase()
  if (!/^[a-z0-9]{4,12}$/.test(suffix)) return null

  const orders = await pbListAll<PbRecord>('orders', { fields: 'id' })
  const match = orders.find((order) => String(order.id).toLowerCase().endsWith(suffix))
  if (!match) return null

  return pbFirst<PbRecord>('orders', { filter: `id = ${pbQuote(match.id)}` })
}
