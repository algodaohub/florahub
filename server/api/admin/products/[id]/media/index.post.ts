import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import {
  MAX_PRODUCT_PHOTOS,
  MAX_PRODUCT_VIDEOS,
  MEDIA_COLLECTION,
  isMediaKind,
  listProductMedia,
  pbUpload,
  syncProductThumbnail,
  toMedia
} from '~~/server/utils/media'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 25 * 1024 * 1024

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const productId = String(getRouterParam(event, 'id') ?? '').trim()
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã sản phẩm' })

  const product = await pbGetRecord<PbRecord>('products', productId)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm' })

  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw createError({ statusCode: 400, statusMessage: 'Chưa chọn tệp' })

  const filePart = parts.find((part) => part.name === 'file' && part.filename)
  if (!filePart?.data?.length) throw createError({ statusCode: 400, statusMessage: 'Chưa chọn tệp' })

  const requestedType = String(parts.find((part) => part.name === 'type')?.data?.toString() ?? '')
  const mime = String(filePart.type || '')
  const type = isMediaKind(requestedType) ? requestedType : mime.startsWith('video/') ? 'video' : 'image'

  const existing = await listProductMedia(productId)
  const counts = {
    image: existing.filter((item) => item.type === 'image').length,
    video: existing.filter((item) => item.type === 'video').length
  }
  const limit = type === 'video' ? MAX_PRODUCT_VIDEOS : MAX_PRODUCT_PHOTOS
  if (counts[type] >= limit) {
    throw createError({
      statusCode: 400,
      statusMessage:
        type === 'video'
          ? `Mỗi sản phẩm chỉ có tối đa ${MAX_PRODUCT_VIDEOS} video`
          : `Mỗi sản phẩm chỉ có tối đa ${MAX_PRODUCT_PHOTOS} ảnh`
    })
  }

  const maxBytes = type === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (filePart.data.length > maxBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: type === 'video' ? 'Video tối đa 25 MB' : 'Ảnh tối đa 10 MB'
    })
  }

  const form = new FormData()
  form.set('product', productId)
  form.set('type', type)
  form.set('alt', String(parts.find((part) => part.name === 'alt')?.data?.toString() ?? '').slice(0, 200))
  form.set('is_featured', String(parts.find((part) => part.name === 'is_featured')?.data?.toString() === 'true'))
  form.set('sort_order', String(existing.length))
  form.set(
    'file',
    new Blob([filePart.data as unknown as BlobPart], { type: mime || (type === 'video' ? 'video/mp4' : 'image/jpeg') }),
    filePart.filename
  )

  const posterPart = parts.find((part) => part.name === 'poster' && part.filename)
  if (posterPart?.data?.length) {
    form.set('poster', new Blob([posterPart.data as unknown as BlobPart], { type: posterPart.type || 'image/jpeg' }), posterPart.filename)
  }

  const created = await pbUpload<PbRecord>(MEDIA_COLLECTION, form)
  await syncProductThumbnail(productId)

  return { media: toMedia(created), counts: { image: counts.image + (type === 'image' ? 1 : 0), video: counts.video + (type === 'video' ? 1 : 0) } }
})
