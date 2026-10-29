import { pbFirst, pbGetRecord, pbQuote, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { toBool, toNumber, toText } from '~~/server/utils/admin-data'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã biến thể' })

  const current = await pbGetRecord<PbRecord>('variants', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy biến thể' })

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}

  if (body?.title !== undefined) patch.title = toText(body.title, 120) || 'Mặc định'

  if (body?.sku !== undefined) {
    const sku = toText(body.sku, 80)
    if (!sku) throw createError({ statusCode: 400, statusMessage: 'Nhập SKU cho biến thể' })
    if (sku !== current.sku) {
      const duplicate = await pbFirst<PbRecord>('variants', {
        filter: `sku = ${pbQuote(sku)} && id != ${pbQuote(id)}`,
        fields: 'id'
      })
      if (duplicate) throw createError({ statusCode: 409, statusMessage: `SKU "${sku}" đã tồn tại` })
    }
    patch.sku = sku
  }

  if (body?.price !== undefined) {
    const price = toNumber(body.price, 0)
    if (price <= 0) throw createError({ statusCode: 400, statusMessage: 'Giá biến thể phải lớn hơn 0' })
    patch.price = price
  }

  if (body?.compareAtPrice !== undefined) {
    const compareAtPrice = toNumber(body.compareAtPrice, 0)
    patch.compare_at_price = compareAtPrice > 0 ? compareAtPrice : null
  }

  if (body?.inventoryQuantity !== undefined) {
    patch.inventory_quantity = toNumber(body.inventoryQuantity, 0)
  }

  if (body?.manageInventory !== undefined) patch.manage_inventory = toBool(body.manageInventory)

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  const updated = await pbUpdate<PbRecord>('variants', id, patch)

  return {
    variant: {
      id: updated.id,
      title: updated.title,
      sku: updated.sku,
      price: Number(updated.price ?? 0),
      compareAtPrice: updated.compare_at_price === null ? null : Number(updated.compare_at_price ?? 0),
      inventoryQuantity: Number(updated.inventory_quantity ?? 0),
      manageInventory: Boolean(updated.manage_inventory)
    }
  }
})
