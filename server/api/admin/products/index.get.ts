import { pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { combineFilters, parsePaging, searchFilter } from '~~/server/utils/admin-data'

const SORTS: Record<string, string> = {
  newest: '-created_at',
  oldest: 'created_at',
  title: 'title',
  updated: '-updated'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'products', action: 'read' })

  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const category = String(query.category ?? '').trim()
  const seller = String(query.seller ?? '').trim()
  const status = String(query.status ?? '').trim()
  const type = String(query.type ?? '').trim()
  const sort = SORTS[String(query.sort ?? 'newest')] ?? SORTS.newest
  const { page, perPage } = parsePaging(event)

  const filter = combineFilters([
    category ? `category = ${pbQuote(category)}` : null,
    seller ? `seller = ${pbQuote(seller)}` : null,
    status ? `status = ${pbQuote(status)}` : null,
    type ? `type = ${pbQuote(type)}` : null,
    searchFilter(['title', 'handle', 'subtitle'], q)
  ])

  const result = await pbListPage<PbRecord>('products', {
    filter: filter || undefined,
    sort,
    page,
    perPage,
    expand: 'category,seller',
    fields:
      'id,handle,title,thumbnail,status,type,unit,color,category,seller,created_at,updated,expand.category.id,expand.category.name,expand.seller.id,expand.seller.name'
  })

  const ids = result.items.map((item) => item.id)
  const stats = new Map<string, { variants: number; stock: number; minPrice: number; maxPrice: number }>()

  if (ids.length > 0) {
    const variants = await pbListPage<PbRecord>('variants', {
      filter: ids.map((id) => `product = ${pbQuote(id)}`).join(' || '),
      perPage: 500,
      fields: 'id,product,price,inventory_quantity'
    })

    for (const variant of variants.items) {
      const key = String(variant.product ?? '')
      const price = Number(variant.price ?? 0)
      const stock = Number(variant.inventory_quantity ?? 0)
      const entry = stats.get(key)
      if (!entry) {
        stats.set(key, { variants: 1, stock, minPrice: price, maxPrice: price })
      } else {
        entry.variants += 1
        entry.stock += stock
        entry.minPrice = Math.min(entry.minPrice, price)
        entry.maxPrice = Math.max(entry.maxPrice, price)
      }
    }
  }

  return {
    page: result.page,
    perPage: result.perPage,
    total: result.totalItems,
    totalPages: result.totalPages,
    items: result.items.map((item) => {
      const stat = stats.get(item.id)
      return {
        id: item.id,
        handle: item.handle,
        title: item.title,
        thumbnail: item.thumbnail,
        status: item.status,
        type: item.type || 'physical',
        unit: item.unit,
        color: item.color,
        category: item.expand?.category ? { id: item.expand.category.id, name: item.expand.category.name } : null,
        seller: item.expand?.seller ? { id: item.expand.seller.id, name: item.expand.seller.name } : null,
        variantCount: stat?.variants ?? 0,
        stock: stat?.stock ?? 0,
        minPrice: stat?.minPrice ?? 0,
        maxPrice: stat?.maxPrice ?? 0,
        createdAt: item.created_at || item.created,
        updatedAt: item.updated
      }
    })
  }
})
