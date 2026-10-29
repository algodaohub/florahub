import { pbListAll, pbListPage, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { toCategory } from '~~/server/utils/catalog'

export default defineEventHandler(async () => {
  const categories = await pbListAll<PbRecord>('categories', { filter: 'is_active = true', sort: 'sort_order,name' })

  const counts = await Promise.all(
    categories.map(async (category) => {
      const result = await pbListPage('products', {
        filter: `category = ${pbQuote(category.id)} && status = "published"`,
        perPage: 1,
        fields: 'id'
      })
      return result.totalItems
    })
  )

  return categories.map((category, index) => ({
    ...toCategory(category),
    productCount: counts[index] ?? 0
  }))
})
