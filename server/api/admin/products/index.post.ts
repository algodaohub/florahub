import { pbCreate, pbFirst, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { isProductStatus, isProductType, slugify, toText } from '~~/server/utils/admin-data'
import { buildProductFields } from '~~/server/utils/product-input'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const body = await readBody<Record<string, unknown>>(event)
  const title = toText(body?.title, 160)
  if (!title) throw createError({ statusCode: 400, statusMessage: 'Nhập tên sản phẩm' })

  const handle = slugify(toText(body?.handle, 120) || title)
  if (!handle) throw createError({ statusCode: 400, statusMessage: 'Handle không hợp lệ' })

  const category = toText(body?.category, 40)
  const seller = toText(body?.seller, 40)
  if (!category) throw createError({ statusCode: 400, statusMessage: 'Chọn danh mục' })
  if (!seller) throw createError({ statusCode: 400, statusMessage: 'Chọn nhà bán' })

  if (body?.type !== undefined && !isProductType(body.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Loại sản phẩm không hợp lệ' })
  }

  const duplicate = await pbFirst<PbRecord>('products', {
    filter: `handle = ${pbQuote(handle)}`,
    fields: 'id'
  })
  if (duplicate) {
    throw createError({ statusCode: 409, statusMessage: `Handle "${handle}" đã tồn tại` })
  }

  const status = isProductStatus(body?.status) ? body.status : 'draft'

  const created = await pbCreate<PbRecord>('products', {
    handle,
    title,
    subtitle: toText(body?.subtitle, 200),
    description: toText(body?.description, 5000),
    category,
    seller,
    thumbnail: toText(body?.thumbnail, 500),
    unit: toText(body?.unit, 40) || 'sản phẩm',
    color: toText(body?.color, 40),
    status,
    ...buildProductFields(body, { creating: true }),
    created_at: new Date().toISOString()
  })

  return { product: { id: created.id, handle: created.handle, title: created.title, type: created.type } }
})
