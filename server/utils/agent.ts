import { fetchProductCards } from './catalog'
import { pbFirst, pbListAll, pbQuote, type PbRecord } from './pocketbase'
import { toFaq, toHighlights } from './admin-data'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type AgentProduct = {
  handle: string
  title: string
  subtitle: string | null
  url: string
  price: number
  currency: string
  inStock: boolean
  seller: string
  category: string
  thumbnail: string
  variantId: string | null
  variantTitle: string | null
}

/** Catalog gọn cho agent: chỉ sản phẩm đã publish, giá VND, kèm URL tuyệt đối. */
export async function searchAgentCatalog(query: string, baseUrl: string, limit = 10): Promise<AgentProduct[]> {
  const cards = await fetchProductCards('status = "published"')
  const needle = normalizeText(query.trim())
  const tokens = [...new Set(needle.split(/[^a-z0-9]+/).filter((token) => token.length > 1))]

  const scored = cards.map((card) => {
    const haystack = normalizeText(
      `${card.title} ${card.subtitle ?? ''} ${card.color ?? ''} ${card.category.name} ${card.seller.name}`
    )
    let score = needle && haystack.includes(needle) ? 10 : 0
    for (const token of tokens) if (haystack.includes(token)) score += 2
    return { card, score }
  })

  const ranked = needle
    ? scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score)
    : scored

  return ranked.slice(0, Math.min(Math.max(limit, 1), 24)).map(({ card }) => ({
    handle: card.handle,
    title: card.title,
    subtitle: card.subtitle,
    url: `${baseUrl}/product/${encodeURIComponent(card.handle)}`,
    price: card.price,
    currency: 'VND',
    inStock: card.inStock,
    seller: card.seller.name,
    category: card.category.name,
    thumbnail: card.thumbnail.startsWith('http') ? card.thumbnail : `${baseUrl}${card.thumbnail}`,
    variantId: card.variantId,
    variantTitle: card.variantTitle
  }))
}

export async function getAgentProduct(handle: string, baseUrl: string) {
  const product = await pbFirst<PbRecord>('products', {
    filter: `handle = ${pbQuote(handle)} && status = "published"`,
    expand: 'seller,category'
  })
  if (!product) return null

  const variants = await pbListAll<PbRecord>('variants', {
    filter: `product = ${pbQuote(product.id)}`,
    sort: 'price'
  })
  const prices = variants.map((variant) => Number(variant.price ?? 0)).filter((price) => price > 0)

  return {
    handle: String(product.handle ?? ''),
    title: String(product.title ?? ''),
    subtitle: product.subtitle || null,
    description: stripHtml(String(product.description ?? '')).slice(0, 4000),
    aeoSummary: String(product.aeo_summary ?? ''),
    url: `${baseUrl}/product/${encodeURIComponent(String(product.handle ?? ''))}`,
    price: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    currency: 'VND',
    inStock: variants.some((variant) => Number(variant.inventory_quantity ?? 0) > 0),
    seller: String(product.expand?.seller?.name ?? ''),
    category: String(product.expand?.category?.name ?? ''),
    highlights: toHighlights(product.highlights),
    faq: toFaq(product.faq, 10),
    variants: variants.map((variant) => ({
      id: variant.id,
      title: String(variant.title ?? ''),
      price: Number(variant.price ?? 0),
      inStock: Number(variant.inventory_quantity ?? 0) > 0,
      options: variant.options_json || '[]'
    }))
  }
}
