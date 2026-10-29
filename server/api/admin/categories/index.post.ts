import { pbCreate, pbFirst, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { slugify, toBool, toNumber, toText } from '~~/server/utils/admin-data'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const body = await readBody<Record<string, unknown>>(event)
  const name = toText(body?.name, 120)
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Nhập tên danh mục' })

  const slug = slugify(toText(body?.slug, 120) || name)
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug không hợp lệ' })

  const duplicate = await pbFirst<PbRecord>('categories', { filter: `slug = ${pbQuote(slug)}`, fields: 'id' })
  if (duplicate) throw createError({ statusCode: 409, statusMessage: `Slug "${slug}" đã tồn tại` })

  const created = await pbCreate<PbRecord>('categories', {
    name,
    slug,
    parent: toText(body?.parent, 40) || null,
    description: toText(body?.description, 2000),
    image_url: toText(body?.imageUrl, 500),
    seo_title: toText(body?.seoTitle, 120),
    seo_description: toText(body?.seoDescription, 320),
    is_active: body?.isActive === undefined ? true : toBool(body.isActive),
    sort_order: toNumber(body?.sortOrder, 0),
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  })

  return { category: { id: created.id, name: created.name, slug: created.slug } }
})
