import { pbCreate, pbFirst, pbGetRecord, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { toBool, toNumber, toText } from '~~/server/utils/admin-data'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const productId = String(getRouterParam(event, 'id') ?? '').trim()
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã sản phẩm' })

  const product = await pbGetRecord('products', productId)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm' })

  const body = await readBody<Record<string, unknown>>(event)
  const title = toText(body?.title, 120) || 'Mặc định'
  const sku = toText(body?.sku, 80)
  if (!sku) throw createError({ statusCode: 400, statusMessage: 'Nhập SKU cho biến thể' })

  const price = toNumber(body?.price, 0)
  if (price <= 0) throw createError({ statusCode: 400, statusMessage: 'Giá biến thể phải lớn hơn 0' })

  const duplicate = await pbFirst<PbRecord>('variants', {
    filter: `sku = ${pbQuote(sku)}`,
    fields: 'id'
  })
  if (duplicate) throw createError({ statusCode: 409, statusMessage: `SKU "${sku}" đã tồn tại` })

  const compareAtPrice = toNumber(body?.compareAtPrice, 0)

  const created = await pbCreate<PbRecord>('variants', {
    product: productId,
    title,
    sku,
    price,
    compare_at_price: compareAtPrice > 0 ? compareAtPrice : null,
    inventory_quantity: toNumber(body?.inventoryQuantity, 0),
    manage_inventory: toBool(body?.manageInventory),
    created_at: new Date().toISOString()
  })

  return {
    variant: {
      id: created.id,
      title: created.title,
      sku: created.sku,
      price: Number(created.price ?? 0),
      compareAtPrice: created.compare_at_price === null ? null : Number(created.compare_at_price ?? 0),
      inventoryQuantity: Number(created.inventory_quantity ?? 0),
      manageInventory: Boolean(created.manage_inventory)
    }
  }
})
