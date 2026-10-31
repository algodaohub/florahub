import { pbFirst, pbGetRecord, pbQuote, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { isProductStatus, isProductType, slugify, toText } from '~~/server/utils/admin-data'
import { buildProductFields } from '~~/server/utils/product-input'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã sản phẩm' })

  const current = await pbGetRecord<PbRecord>('products', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm' })

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}

  if (body?.title !== undefined) {
    const title = toText(body.title, 160)
    if (!title) throw createError({ statusCode: 400, statusMessage: 'Nhập tên sản phẩm' })
    patch.title = title
  }

  if (body?.handle !== undefined) {
    const handle = slugify(toText(body.handle, 120))
    if (!handle) throw createError({ statusCode: 400, statusMessage: 'Handle không hợp lệ' })
    if (handle !== current.handle) {
      const duplicate = await pbFirst<PbRecord>('products', {
        filter: `handle = ${pbQuote(handle)} && id != ${pbQuote(id)}`,
        fields: 'id'
      })
      if (duplicate) throw createError({ statusCode: 409, statusMessage: `Handle "${handle}" đã tồn tại` })
    }
    patch.handle = handle
  }

  if (body?.subtitle !== undefined) patch.subtitle = toText(body.subtitle, 200)
  if (body?.description !== undefined) patch.description = toText(body.description, 5000)
  if (body?.category !== undefined) {
    const category = toText(body.category, 40)
    if (!category) throw createError({ statusCode: 400, statusMessage: 'Chọn danh mục' })
    patch.category = category
  }
  if (body?.seller !== undefined) {
    const seller = toText(body.seller, 40)
    if (!seller) throw createError({ statusCode: 400, statusMessage: 'Chọn nhà bán' })
    patch.seller = seller
  }
  if (body?.thumbnail !== undefined) patch.thumbnail = toText(body.thumbnail, 500)
  if (body?.unit !== undefined) patch.unit = toText(body.unit, 40) || 'sản phẩm'
  if (body?.color !== undefined) patch.color = toText(body.color, 40)
  if (body?.status !== undefined) {
    if (!isProductStatus(body.status)) {
      throw createError({ statusCode: 400, statusMessage: 'Trạng thái sản phẩm không hợp lệ' })
    }
    patch.status = body.status
  }
  const requestedType = body?.type
  if (requestedType !== undefined) {
    if (!isProductType(requestedType)) {
      throw createError({ statusCode: 400, statusMessage: 'Loại sản phẩm không hợp lệ' })
    }
    const currentType = isProductType(current.type) ? current.type : ''
    if (currentType && currentType !== requestedType) {
      throw createError({
        statusCode: 400,
        statusMessage: `Sản phẩm đã xác định loại "${currentType}", không đổi sang loại khác. Hãy tạo sản phẩm mới.`
      })
    }
  }
  Object.assign(patch, buildProductFields({ ...body, type: requestedType ?? current.type }, { current }))

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  patch.updated_at = new Date().toISOString()
  const updated = await pbUpdate<PbRecord>('products', id, patch)

  return {
    product: {
      id: updated.id,
      handle: updated.handle,
      title: updated.title,
      status: updated.status,
      type: updated.type,
      updatedAt: updated.updated
    }
  }
})
