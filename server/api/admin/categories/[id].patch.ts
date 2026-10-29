import { pbFirst, pbGetRecord, pbQuote, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { slugify, toBool, toNumber, toText } from '~~/server/utils/admin-data'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã danh mục' })

  const current = await pbGetRecord<PbRecord>('categories', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy danh mục' })

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}

  if (body?.name !== undefined) {
    const name = toText(body.name, 120)
    if (!name) throw createError({ statusCode: 400, statusMessage: 'Nhập tên danh mục' })
    patch.name = name
  }

  if (body?.slug !== undefined) {
    const slug = slugify(toText(body.slug, 120))
    if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug không hợp lệ' })
    if (slug !== current.slug) {
      const duplicate = await pbFirst<PbRecord>('categories', {
        filter: `slug = ${pbQuote(slug)} && id != ${pbQuote(id)}`,
        fields: 'id'
      })
      if (duplicate) throw createError({ statusCode: 409, statusMessage: `Slug "${slug}" đã tồn tại` })
    }
    patch.slug = slug
  }

  if (body?.parent !== undefined) {
    const parent = toText(body.parent, 40)
    if (parent === id) throw createError({ statusCode: 400, statusMessage: 'Danh mục không thể là cha của chính nó' })

    // Chặn vòng lặp: cha mới không được nằm trong cây con của danh mục này.
    let cursor = parent
    for (let depth = 0; cursor && depth < 20; depth += 1) {
      if (cursor === id) {
        throw createError({ statusCode: 400, statusMessage: 'Danh mục cha tạo thành vòng lặp' })
      }
      const record = await pbGetRecord<PbRecord>('categories', cursor)
      cursor = record?.parent ? String(record.parent) : ''
    }

    patch.parent = parent || null
  }

  if (body?.description !== undefined) patch.description = toText(body.description, 2000)
  if (body?.imageUrl !== undefined) patch.image_url = toText(body.imageUrl, 500)
  if (body?.seoTitle !== undefined) patch.seo_title = toText(body.seoTitle, 120)
  if (body?.seoDescription !== undefined) patch.seo_description = toText(body.seoDescription, 320)
  if (body?.isActive !== undefined) patch.is_active = toBool(body.isActive)
  if (body?.sortOrder !== undefined) patch.sort_order = toNumber(body.sortOrder, 0)

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  patch.updated_at = new Date().toISOString()
  const updated = await pbUpdate<PbRecord>('categories', id, patch)

  return { category: { id: updated.id, name: updated.name, slug: updated.slug } }
})
