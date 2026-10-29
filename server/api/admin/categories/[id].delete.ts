import { pbDelete, pbFirst, pbGetRecord, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write', adminOnly: true })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã danh mục' })

  const category = await pbGetRecord<PbRecord>('categories', id)
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy danh mục' })

  const [children, products] = await Promise.all([
    pbFirst<PbRecord>('categories', { filter: `parent = ${pbQuote(id)}`, fields: 'id' }),
    pbFirst<PbRecord>('products', { filter: `category = ${pbQuote(id)}`, fields: 'id' })
  ])

  if (children) throw createError({ statusCode: 409, statusMessage: 'Danh mục còn danh mục con' })
  if (products) throw createError({ statusCode: 409, statusMessage: 'Danh mục còn sản phẩm — chuyển sản phẩm trước khi xoá' })

  await pbDelete('categories', id)
  return { ok: true }
})
