import { pbListAll, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { syncProductThumbnail } from '~~/server/utils/media'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const productId = String(getRouterParam(event, 'id') ?? '').trim()
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã sản phẩm' })

  const body = await readBody<{ ids?: string[] }>(event)
  const ids = Array.isArray(body?.ids) ? body!.ids!.map((id) => String(id)).filter(Boolean) : []
  if (ids.length === 0) throw createError({ statusCode: 400, statusMessage: 'Thiếu thứ tự media' })

  const rows = await pbListAll<PbRecord>('product_images', {
    filter: `product = "${productId.replace(/"/g, '\\"')}"`,
    fields: 'id'
  })
  const known = new Set(rows.map((row) => row.id))

  for (const [index, id] of ids.entries()) {
    if (!known.has(id)) continue
    await pbUpdate('product_images', id, { sort_order: index })
  }

  await syncProductThumbnail(productId)
  return { ok: true }
})
