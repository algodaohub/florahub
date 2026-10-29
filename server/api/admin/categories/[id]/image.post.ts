import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { pbUpload } from '~~/server/utils/media'

const MAX_BYTES = 5 * 1024 * 1024

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã danh mục' })

  const current = await pbGetRecord<PbRecord>('categories', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy danh mục' })

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find((part) => part.name === 'file' && part.filename)
  if (!filePart?.data?.length) throw createError({ statusCode: 400, statusMessage: 'Chưa chọn ảnh' })

  if (filePart.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Ảnh danh mục tối đa 5 MB' })
  }
  if (!String(filePart.type || '').startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Tệp phải là ảnh' })
  }

  const form = new FormData()
  form.set('image', new Blob([filePart.data as unknown as BlobPart], { type: filePart.type || 'image/jpeg' }), filePart.filename)

  const updated = await pbUpload<PbRecord>('categories', form, { method: 'PATCH', id })
  const imageUrl = updated.image
    ? `/media/categories/${updated.id}/${encodeURIComponent(String(updated.image))}`
    : (updated.image_url || '')

  return { imageUrl, fileName: updated.image || null }
})
