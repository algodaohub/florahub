import { pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { pbUpload } from '~~/server/utils/media'

const MAX_BYTES = 50 * 1024 * 1024

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { resource: 'products', action: 'write' })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã sản phẩm' })

  const product = await pbGetRecord<PbRecord>('products', id)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy sản phẩm' })

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find((part) => part.name === 'file' && part.filename)
  if (!filePart?.data?.length) throw createError({ statusCode: 400, statusMessage: 'Chưa chọn tệp sản phẩm số' })

  if (filePart.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Tệp sản phẩm số tối đa 50 MB' })
  }

  const form = new FormData()
  form.set('digital_file', new Blob([filePart.data as unknown as BlobPart], { type: filePart.type || 'application/octet-stream' }), filePart.filename)

  const updated = await pbUpload<PbRecord>('products', form, { method: 'PATCH', id })

  return { fileName: updated.digital_file, size: filePart.data.length }
})
