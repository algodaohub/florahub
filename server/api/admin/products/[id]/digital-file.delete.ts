import { pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã sản phẩm' })

  const product = await pbGetRecord<PbRecord>('products', id)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm' })

  await pbUpdate('products', id, { digital_file: null })
  return { ok: true }
})
