import { fetchProductCards } from '~~/server/utils/catalog'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const category = String(query.category ?? '').trim()
  const seller = String(query.seller ?? '').trim()
  const color = String(query.color ?? '').trim()
  const sort = String(query.sort ?? 'newest')
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const limit = Math.min(48, Math.max(1, Number(query.limit ?? 12) || 12))
  const minPrice = Number(query.minPrice ?? 0) || 0
  const maxPrice = Number(query.maxPrice ?? 0) || 0

  let cards = await fetchProductCards('status = "published"')

  if (category) cards = cards.filter((card) => card.category.slug === category)
  if (seller) cards = cards.filter((card) => card.seller.slug === seller)

  const colors = [...new Set(cards.map((card) => card.color).filter((value): value is string => Boolean(value)))].sort(
    (a, b) => a.localeCompare(b, 'vi')
  )

  if (q) {
    const needle = normalizeText(q)
    cards = cards.filter((card) =>
      normalizeText(`${card.title} ${card.subtitle ?? ''} ${card.seller.name} ${card.category.name}`).includes(needle)
    )
  }
  if (color) cards = cards.filter((card) => card.color === color)
  if (minPrice > 0) cards = cards.filter((card) => card.price >= minPrice)
  if (maxPrice > 0) cards = cards.filter((card) => card.price <= maxPrice)

  cards.sort((a, b) => {
    if (sort === 'price-asc') return a.price - b.price
    if (sort === 'price-desc') return b.price - a.price
    if (sort === 'name') return a.title.localeCompare(b.title, 'vi')
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const total = cards.length
  const start = (page - 1) * limit
  const items = cards.slice(start, start + limit)

  return {
    items,
    total,
    page,
    limit,
    hasMore: start + items.length < total,
    colors,
    filters: { q, category, seller, color, sort, minPrice, maxPrice }
  }
})
