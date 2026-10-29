import { pbListAll, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'products', action: 'read' })

  const [categories, products] = await Promise.all([
    pbListAll<PbRecord>('categories', { sort: 'sort_order,name', expand: 'parent' }),
    pbListAll<PbRecord>('products', { fields: 'id,category,status' })
  ])

  const counts = new Map<string, number>()
  for (const product of products) {
    const key = String(product.category ?? '')
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return {
    items: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent: category.parent
        ? { id: String(category.parent), name: String(category.expand?.parent?.name ?? '') }
        : null,
      description: category.description || '',
      imageUrl: category.image
        ? `/media/categories/${category.id}/${encodeURIComponent(String(category.image))}`
        : category.image_url || '',
      seoTitle: category.seo_title || '',
      seoDescription: category.seo_description || '',
      isActive: Boolean(category.is_active),
      sortOrder: Number(category.sort_order ?? 0),
      productCount: counts.get(category.id) ?? 0,
      updatedAt: category.updated_at || category.created || null
    }))
  }
})
