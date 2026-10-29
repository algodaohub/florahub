import { pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã danh mục' })

  const current = await pbGetRecord<PbRecord>('categories', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy danh mục' })

  await pbUpdate('categories', id, { image: null })
  return { ok: true, imageUrl: current.image_url || '' }
})
