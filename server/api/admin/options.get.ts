import { pbListAll, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [categories, sellers] = await Promise.all([
    pbListAll<PbRecord>('categories', { sort: 'sort_order,name', fields: 'id,name,slug,is_active,parent', expand: 'parent' }),
    pbListAll<PbRecord>('sellers', { sort: 'name', fields: 'id,name,slug' })
  ])

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      isActive: Boolean(category.is_active),
      parent: category.parent ? { id: String(category.parent), name: String(category.expand?.parent?.name ?? '') } : null
    })),
    sellers: sellers.map((seller) => ({ id: seller.id, name: seller.name, slug: seller.slug }))
  }
})
