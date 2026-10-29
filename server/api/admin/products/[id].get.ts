import { pbGetRecord, pbListAll, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdmin } from '~~/server/utils/admin'
import { isProductType, toFaq, toHighlights } from '~~/server/utils/admin-data'
import { listProductMedia } from '~~/server/utils/media'

export default defineEventHandler(async (event) => {
  await requireAdmin(event, { resource: 'products', action: 'read' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã sản phẩm' })

  const product = await pbGetRecord<PbRecord>('products', id)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm' })

  const [variants, media, specs] = await Promise.all([
    pbListAll<PbRecord>('variants', { filter: `product = ${pbQuote(id)}`, sort: 'price' }),
    listProductMedia(id),
    pbListAll<PbRecord>('product_specs', { filter: `product = ${pbQuote(id)}`, sort: 'sort_order' })
  ])

  const type = isProductType(product.type) ? product.type : 'physical'

  return {
    product: {
      id: product.id,
      handle: product.handle,
      title: product.title,
      subtitle: product.subtitle,
      description: product.description,
      category: product.category,
      seller: product.seller,
      thumbnail: product.thumbnail,
      unit: product.unit,
      color: product.color,
      status: product.status,
      type,
      requiresShipping: type === 'physical' ? Boolean(product.requires_shipping) : false,
      weightGrams: Number(product.weight_grams ?? 0),
      seoTitle: product.seo_title || '',
      seoDescription: product.seo_description || '',
      seoKeywords: product.seo_keywords || '',
      canonicalUrl: product.canonical_url || '',
      aeoSummary: product.aeo_summary || '',
      highlights: toHighlights(product.highlights),
      faq: toFaq(product.faq),
      digitalFileName: product.digital_file || null,
      digitalDownloadLimit: Number(product.digital_download_limit ?? 0),
      digitalExpiryDays: Number(product.digital_expiry_days ?? 0),
      digitalLicense: product.digital_license || '',
      serviceDuration: Number(product.service_duration ?? 0),
      serviceLocation: product.service_location || '',
      serviceCapacity: Number(product.service_capacity ?? 0),
      serviceBookingNote: product.service_booking_note || '',
      createdAt: product.created_at || product.created,
      updatedAt: product.updated
    },
    variants: variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: Number(variant.price ?? 0),
      compareAtPrice: variant.compare_at_price === null ? null : Number(variant.compare_at_price ?? 0),
      inventoryQuantity: Number(variant.inventory_quantity ?? 0),
      manageInventory: Boolean(variant.manage_inventory)
    })),
    media,
    specs: specs.map((spec) => ({
      id: spec.id,
      name: spec.name,
      value: spec.value,
      sortOrder: Number(spec.sort_order ?? 0)
    }))
  }
})
