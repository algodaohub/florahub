import { PB_URL, getPbAdminToken, pbGetRecord, pbListAll, pbUpdate, type PbRecord } from './pocketbase'

export const MEDIA_COLLECTION = 'product_images'
export const MAX_PRODUCT_PHOTOS = 20
export const MAX_PRODUCT_VIDEOS = 2

export type MediaKind = 'image' | 'video'

export function isMediaKind(value: unknown): value is MediaKind {
  return value === 'image' || value === 'video'
}

/** URL same-origin để trình duyệt tải media qua Nuxt (PB không cần public). */
export function mediaUrl(collection: string, recordId: string, file: string, thumb?: string) {
  if (!file) return ''
  const suffix = thumb ? `?thumb=${encodeURIComponent(thumb)}` : ''
  return `/media/${collection}/${recordId}/${encodeURIComponent(file)}${suffix}`
}

export function mediaFileUrl(record: PbRecord, options: { thumb?: string } = {}) {
  if (record.file) return mediaUrl(MEDIA_COLLECTION, record.id, String(record.file), options.thumb)
  return String(record.url || '')
}

export function mediaPosterUrl(record: PbRecord) {
  return record.poster ? mediaUrl(MEDIA_COLLECTION, record.id, String(record.poster)) : ''
}

export function toMedia(record: PbRecord) {
  const kind: MediaKind = isMediaKind(record.type) ? record.type : 'image'
  const posterUrl = mediaPosterUrl(record)
  return {
    id: record.id,
    type: kind,
    url: mediaFileUrl(record),
    thumbUrl: kind === 'image' ? mediaFileUrl(record, { thumb: '240x240' }) : posterUrl,
    posterUrl,
    alt: String(record.alt || ''),
    isFeatured: Boolean(record.is_featured),
    sortOrder: Number(record.sort_order ?? 0),
    duration: Number(record.duration ?? 0),
    fileName: record.file || record.url || ''
  }
}

/** Upload multipart trực tiếp lên PocketBase (giữ nguyên binary, không base64). */
export async function pbUpload<T = PbRecord>(
  collection: string,
  form: FormData,
  options: { method?: 'POST' | 'PATCH'; id?: string } = {}
): Promise<T> {
  const token = await getPbAdminToken()
  const path =
    options.method === 'PATCH'
      ? `/api/collections/${collection}/records/${encodeURIComponent(String(options.id))}`
      : `/api/collections/${collection}/records`

  let response: Response
  try {
    response = await fetch(`${PB_URL}${path}`, {
      method: options.method ?? 'POST',
      headers: { Authorization: token },
      body: form
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Không kết nối được PocketBase' })
  }

  const text = await response.text()
  let data: any = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }
  if (!response.ok) {
    throw createError({
      statusCode: response.status < 500 ? response.status : 502,
      statusMessage: data?.message || 'PocketBase từ chối tệp tải lên'
    })
  }
  return data as T
}

export async function listProductMedia(productId: string) {
  const rows = await pbListAll<PbRecord>(MEDIA_COLLECTION, {
    filter: `product = "${productId.replace(/"/g, '\\"')}"`,
    sort: 'sort_order,created'
  })
  return rows.map(toMedia)
}

/**
 * Ảnh đầu tiên (theo sort_order) là thumbnail mặc định.
 * Chỉ ghi đè khi sản phẩm đang dùng media hoặc chưa có thumbnail.
 */
export async function syncProductThumbnail(productId: string) {
  const rows = await pbListAll<PbRecord>(MEDIA_COLLECTION, {
    filter: `product = "${productId.replace(/"/g, '\\"')}" && type = "image"`,
    sort: 'sort_order,created'
  })
  const first = rows.find((row) => row.file || row.url)
  const nextThumbnail = first ? mediaFileUrl(first) : ''
  const product = await pbGetRecord<PbRecord>('products', productId)
  if (!product) return

  const current = String(product.thumbnail || '')
  if (nextThumbnail) {
    if (current !== nextThumbnail) await pbUpdate('products', productId, { thumbnail: nextThumbnail })
    return
  }
  if (current.startsWith('/media/')) {
    await pbUpdate('products', productId, { thumbnail: '' })
  }
}
