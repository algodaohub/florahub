import { pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { toMedia } from '~~/server/utils/media'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã media' })

  const current = await pbGetRecord<PbRecord>('product_images', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy media' })

  const body = await readBody<{ alt?: string; isFeatured?: boolean; sortOrder?: number; duration?: number }>(event)
  const patch: Record<string, unknown> = {}

  if (body?.alt !== undefined) patch.alt = String(body.alt).trim().slice(0, 200)
  if (body?.isFeatured !== undefined) patch.is_featured = Boolean(body.isFeatured)
  if (body?.sortOrder !== undefined) patch.sort_order = Math.max(0, Number(body.sortOrder) || 0)
  if (body?.duration !== undefined) patch.duration = Math.max(0, Number(body.duration) || 0)

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  const updated = await pbUpdate<PbRecord>('product_images', id, patch)
  return { media: toMedia(updated) }
})
