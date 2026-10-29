import { pbListAll, pbQuote, type PbRecord } from './pocketbase'

export type Trend = {
  direction: 'up' | 'down' | 'flat'
  label: string
  percent: number
}

export function computeTrend(points: Array<{ price: number }>): Trend {
  if (points.length < 2) {
    return { direction: 'flat', label: 'Giá ổn định', percent: 0 }
  }

  const latest = points[0]!.price
  const oldest = points[points.length - 1]!.price
  const percent = oldest === 0 ? 0 : Math.round(((latest - oldest) / oldest) * 100)

  if (percent > 0) {
    return { direction: 'up', label: 'Giá đang tăng', percent }
  }
  if (percent < 0) {
    return { direction: 'down', label: 'Giá đang giảm', percent: Math.abs(percent) }
  }
  return { direction: 'flat', label: 'Giá ổn định', percent: 0 }
}

export type ProductCard = ReturnType<typeof toProductCard>

export function toProductCard(product: PbRecord, variants: PbRecord[], trends: PbRecord[]) {
  const variant = variants[0]
  const compareAtPrice = Number(variant?.compare_at_price ?? 0) || null
  const price = Number(variant?.price ?? 0)
  const seller = product.expand?.seller ?? {}
  const category = product.expand?.category ?? {}

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    subtitle: product.subtitle || null,
    thumbnail: product.thumbnail,
    unit: product.unit,
    color: product.color || null,
    type: product.type || 'physical',
    price,
    compareAtPrice,
    discountPercent:
      compareAtPrice && compareAtPrice > price
        ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
        : 0,
    variantId: variant?.id ?? null,
    variantTitle: variant?.title ?? null,
    inStock: (variant?.inventory_quantity ?? 0) > 0,
    seller: { name: seller.name, slug: seller.slug, rating: Number(seller.rating ?? 0) },
    category: { name: category.name, slug: category.slug },
    trend: computeTrend(trends.map((point) => ({ price: Number(point.price ?? 0) }))),
    createdAt: product.created_at || product.created
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function relatedByProduct(collection: string, productIds: string[], sort: string) {
  const rows: PbRecord[] = []
  for (const ids of chunk(productIds, 40)) {
    const filter = ids.map((id) => `product = ${pbQuote(id)}`).join(' || ')
    rows.push(...(await pbListAll<PbRecord>(collection, { filter, sort })))
  }
  return rows
}

function groupByProduct(rows: PbRecord[]) {
  const groups = new Map<string, PbRecord[]>()
  for (const row of rows) {
    const key = String(row.product ?? '')
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  return groups
}

export async function fetchProductCards(filter: string) {
  const products = await pbListAll<PbRecord>('products', {
    filter,
    sort: '-created_at',
    expand: 'seller,category'
  })
  if (products.length === 0) return []

  const productIds = products.map((product) => product.id)
  const [variants, trends] = await Promise.all([
    relatedByProduct('variants', productIds, 'price'),
    relatedByProduct('price_trends', productIds, '-date')
  ])

  const variantsByProduct = groupByProduct(variants)
  const trendsByProduct = groupByProduct(trends)

  return products.map((product) =>
    toProductCard(
      product,
      (variantsByProduct.get(product.id) ?? []).sort((a, b) => Number(a.price) - Number(b.price)),
      (trendsByProduct.get(product.id) ?? []).slice(0, 8)
    )
  )
}

export function toCategory(record: PbRecord) {
  const imageUrl = record.image
    ? `/media/categories/${record.id}/${encodeURIComponent(String(record.image))}`
    : record.image_url || null
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    imageUrl,
    description: record.description || '',
    parentId: record.parent ? String(record.parent) : null,
    seoTitle: record.seo_title || '',
    seoDescription: record.seo_description || ''
  }
}

export function toPost(record: PbRecord) {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    excerpt: record.excerpt,
    body: record.body,
    coverUrl: record.cover_url,
    publishedAt: record.published_at || record.created_at || record.created
  }
}
