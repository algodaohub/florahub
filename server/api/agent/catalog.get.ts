import { getStoreConfig } from '~~/server/utils/store'
import { searchAgentCatalog } from '~~/server/utils/agent'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().slice(0, 200)
  const limit = Math.min(Math.max(Number(query.limit ?? 10) || 10, 1), 24)
  const baseUrl = getRequestURL(event).origin

  const { config } = await getStoreConfig(event)
  const products = await searchAgentCatalog(q, baseUrl, limit)

  return {
    store: {
      name: config.brand.name,
      description: config.brand.description || config.brand.tagline,
      url: baseUrl,
      currency: config.features.currency,
      locale: config.features.locale
    },
    query: q,
    products,
    total: products.length
  }
})
