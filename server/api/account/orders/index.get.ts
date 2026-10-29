import { requirePbUser, pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { loadOrderItems } from '~~/server/utils/order'

export default defineEventHandler(async (event) => {
  const { record } = await requirePbUser(event)
  const query = getQuery(event)
  const status = String(query.status ?? '').trim()
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const limit = Math.min(30, Math.max(1, Number(query.limit ?? 20) || 20))

  const ownership = `(user = ${pbQuote(record.id)} || email = ${pbQuote(record.email)})`
  const filter = status ? `${ownership} && status = ${pbQuote(status)}` : ownership

  const result = await pbListPage<PbRecord>('orders', {
    filter,
    sort: '-created_at',
    page,
    perPage: limit
  })

  const items = await loadOrderItems(result.items.map((order) => order.id))
  const itemsByOrder = new Map<string, PbRecord[]>()
  for (const item of items) {
    const key = String(item.order ?? '')
    const list = itemsByOrder.get(key) ?? []
    list.push(item)
    itemsByOrder.set(key, list)
  }

  return {
    orders: result.items.map((order) => {
      const orderItems = itemsByOrder.get(order.id) ?? []
      return {
        id: order.id,
        status: order.status,
        total: Number(order.total ?? 0),
        itemCount: orderItems.length,
        shippingName: order.shipping_name,
        createdAt: order.created_at || order.created,
        preview: orderItems.slice(0, 3).map((item) => ({
          id: item.id,
          title: item.title,
          thumbnail: item.thumbnail,
          quantity: Number(item.quantity ?? 0)
        }))
      }
    }),
    total: result.totalItems,
    page,
    limit,
    hasMore: page * limit < result.totalItems
  }
})
