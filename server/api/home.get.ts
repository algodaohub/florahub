import { fetchProductCards, toCategory, toPost } from '~~/server/utils/catalog'
import { pbFirst, pbListAll, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'

export default defineEventHandler(async () => {
  const [banners, categories, flashSale, posts] = await Promise.all([
    pbListAll<PbRecord>('banners', { filter: 'active = true', sort: 'sort_order' }),
    pbListAll<PbRecord>('categories', { filter: 'is_active = true', sort: 'sort_order' }),
    pbFirst<PbRecord>('flash_sales', {
      filter: 'active = true && starts_at <= @now && ends_at >= @now',
      sort: '-starts_at'
    }),
    pbListAll<PbRecord>('posts', { sort: '-published_at', perPage: 3 })
  ])

  const recommended = await fetchProductCards('status = "published"')

  let flashSalePayload: {
    id: string
    title: string
    endsAt: string
    items: Array<{ id: string; salePrice: number; quantityLimit: number; variantId: string; product: any }>
  } | null = null

  if (flashSale) {
    const items = await pbListAll<PbRecord>('flash_sale_items', {
      filter: `flash_sale = ${pbQuote(flashSale.id)}`
    })

    const productIds = [...new Set(items.map((item) => String(item.product ?? '')).filter(Boolean))]
    const cards = productIds.length
      ? await fetchProductCards(productIds.map((id) => `id = ${pbQuote(id)}`).join(' || '))
      : []
    const cardsById = new Map(cards.map((card) => [card.id, card]))

    flashSalePayload = {
      id: flashSale.id,
      title: flashSale.title,
      endsAt: flashSale.ends_at,
      items: items
        .map((item) => {
          const product = cardsById.get(String(item.product))
          if (!product) return null
          return {
            id: item.id,
            salePrice: Number(item.sale_price ?? 0),
            quantityLimit: Number(item.quantity_limit ?? 0),
            variantId: String(item.variant ?? ''),
            product
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    }
  }

  return {
    banners,
    categories: categories.map(toCategory),
    flashSale: flashSalePayload,
    recommended: recommended.slice(0, 8),
    posts: posts.map(toPost)
  }
})
