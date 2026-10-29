import { computeTrend } from '~~/server/utils/catalog'
import { pbFirst, pbListAll, pbQuote, type PbRecord } from '~~/server/utils/pocketbase'
import { toFaq, toHighlights } from '~~/server/utils/admin-data'
import { listProductMedia } from '~~/server/utils/media'

export default defineEventHandler(async (event) => {
  const handle = getRouterParam(event, 'handle')
  if (!handle) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã sản phẩm' })

  const product = await pbFirst<PbRecord>('products', {
    filter: `handle = ${pbQuote(handle)}`,
    expand: 'seller,category'
  })
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm' })

  const byProduct = `product = ${pbQuote(product.id)}`
  const [media, specs, options, variants, reviews, priceTrends, stockTrends] = await Promise.all([
    listProductMedia(product.id),
    pbListAll<PbRecord>('product_specs', { filter: byProduct, sort: 'sort_order' }),
    pbListAll<PbRecord>('product_options', { filter: byProduct, sort: 'sort_order' }),
    pbListAll<PbRecord>('variants', { filter: byProduct, sort: 'price' }),
    pbListAll<PbRecord>('reviews', { filter: byProduct, sort: '-created_at', perPage: 10 }),
    pbListAll<PbRecord>('price_trends', { filter: byProduct, sort: 'date' }),
    pbListAll<PbRecord>('stock_trends', { filter: byProduct, sort: 'date' })
  ])

  const optionIds = options.map((option) => option.id)
  const optionValues = optionIds.length
    ? await pbListAll<PbRecord>('product_option_values', {
        filter: optionIds.map((id) => `option = ${pbQuote(id)}`).join(' || '),
        sort: 'sort_order'
      })
    : []

  const reviewCount = reviews.length
  const rating =
    reviewCount === 0
      ? 0
      : Math.round((reviews.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) / reviewCount) * 10) / 10

  const type = product.type === 'digital' || product.type === 'service' ? product.type : 'physical'

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    subtitle: product.subtitle || null,
    description: product.description,
    thumbnail: product.thumbnail,
    unit: product.unit,
    color: product.color || null,
    status: product.status,
    type,
    requiresShipping: type === 'physical' ? Boolean(product.requires_shipping) : false,
    weightGrams: Number(product.weight_grams ?? 0),
    category: {
      ...(product.expand?.category ?? {}),
      imageUrl: product.expand?.category?.image_url || null,
      description: product.expand?.category?.description || '',
      parentId: product.expand?.category?.parent ? String(product.expand.category.parent) : null,
      seoTitle: product.expand?.category?.seo_title || '',
      seoDescription: product.expand?.category?.seo_description || ''
    },
    seller: product.expand?.seller ?? {},
    media,
    images: media
      .filter((item) => item.type === 'image')
      .map((item) => ({ id: item.id, url: item.url, alt: item.alt || null })),
    specs: specs.map((spec) => ({ id: spec.id, name: spec.name, value: spec.value })),
    highlights: toHighlights(product.highlights),
    faq: toFaq(product.faq),
    seo: {
      title: product.seo_title || '',
      description: product.seo_description || '',
      keywords: product.seo_keywords || '',
      canonicalUrl: product.canonical_url || ''
    },
    aeoSummary: product.aeo_summary || '',
    digital: {
      downloadLimit: Number(product.digital_download_limit ?? 0),
      expiryDays: Number(product.digital_expiry_days ?? 0),
      license: product.digital_license || ''
    },
    service: {
      duration: Number(product.service_duration ?? 0),
      location: product.service_location || '',
      capacity: Number(product.service_capacity ?? 0),
      bookingNote: product.service_booking_note || ''
    },
    options: options.map((option) => ({
      id: option.id,
      title: option.title,
      values: optionValues
        .filter((value) => value.option === option.id)
        .map((value) => ({ id: value.id, value: value.value }))
    })),
    variants: variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: Number(variant.price ?? 0),
      compareAtPrice: Number(variant.compare_at_price ?? 0) || null,
      inventoryQuantity: Number(variant.inventory_quantity ?? 0),
      optionsJson: variant.options_json || '[]'
    })),
    reviews: reviews.map((review) => ({
      id: review.id,
      authorName: review.author_name,
      rating: Number(review.rating ?? 0),
      body: review.body,
      createdAt: review.created_at || review.created
    })),
    priceTrends: priceTrends.map((point) => ({ date: point.date, price: Number(point.price ?? 0) })),
    stockTrends: stockTrends.map((point) => ({ date: point.date, stock: Number(point.stock ?? 0) })),
    rating,
    reviewCount,
    trend: computeTrend([...priceTrends].reverse().map((point) => ({ price: Number(point.price ?? 0) })))
  }
})
