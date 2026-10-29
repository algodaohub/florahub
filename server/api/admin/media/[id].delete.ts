import { pbDelete, pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { syncProductThumbnail } from '~~/server/utils/media'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã media' })

  const record = await pbGetRecord<PbRecord>('product_images', id)
  if (!record) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy media' })

  const productId = String(record.product ?? '')
  await pbDelete('product_images', id)
  if (productId) await syncProductThumbnail(productId)

  return { ok: true }
})
