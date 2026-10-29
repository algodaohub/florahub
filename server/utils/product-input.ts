import { isProductType, toBool, toFaq, toHighlights, toNumber, toText } from './admin-data'
import type { PbRecord } from './pocketbase'

export function productTypeOf(record?: PbRecord | null) {
  return record && isProductType(record.type) ? record.type : 'physical'
}

/**
 * Chuẩn hoá các field mở rộng của sản phẩm (loại hàng, SEO/AEO, số/dịch vụ).
 * - `creating`: luôn ghi đủ field để bản ghi mới có giá trị mặc định.
 * - PATCH: chỉ ghi field có trong body.
 */
export function buildProductFields(
  body: Record<string, unknown>,
  options: { current?: PbRecord | null; creating?: boolean } = {}
) {
  const current = options.current ?? null
  const creating = Boolean(options.creating)
  const has = (key: string) => body[key] !== undefined

  const type = isProductType(body.type) ? body.type : productTypeOf(current)
  const patch: Record<string, unknown> = {}

  if (creating || has('type')) patch.type = type

  if (creating || has('requiresShipping') || has('type')) {
    const fallback = current ? Boolean(current.requires_shipping) : true
    patch.requires_shipping =
      type === 'physical' ? (has('requiresShipping') ? toBool(body.requiresShipping) : fallback) : false
  }

  if (creating || has('weightGrams')) {
    patch.weight_grams = Math.max(0, toNumber(body.weightGrams, Number(current?.weight_grams ?? 0)))
  }

  if (creating || has('seoTitle')) patch.seo_title = toText(body.seoTitle, 120)
  if (creating || has('seoDescription')) patch.seo_description = toText(body.seoDescription, 320)
  if (creating || has('seoKeywords')) patch.seo_keywords = toText(body.seoKeywords, 300)
  if (creating || has('canonicalUrl')) patch.canonical_url = toText(body.canonicalUrl, 500)
  if (creating || has('aeoSummary')) patch.aeo_summary = toText(body.aeoSummary, 1200)

  if (creating || has('highlights')) patch.highlights = toHighlights(body.highlights)
  if (creating || has('faq')) patch.faq = toFaq(body.faq)

  if (creating || has('digitalDownloadLimit')) {
    patch.digital_download_limit = Math.max(0, toNumber(body.digitalDownloadLimit, 0))
  }
  if (creating || has('digitalExpiryDays')) {
    patch.digital_expiry_days = Math.max(0, toNumber(body.digitalExpiryDays, 0))
  }
  if (creating || has('digitalLicense')) patch.digital_license = toText(body.digitalLicense, 5000)

  if (creating || has('serviceDuration')) {
    patch.service_duration = Math.max(0, toNumber(body.serviceDuration, 0))
  }
  if (creating || has('serviceLocation')) patch.service_location = toText(body.serviceLocation, 200)
  if (creating || has('serviceCapacity')) {
    patch.service_capacity = Math.max(0, toNumber(body.serviceCapacity, 0))
  }
  if (creating || has('serviceBookingNote')) patch.service_booking_note = toText(body.serviceBookingNote, 2000)

  return patch
}
