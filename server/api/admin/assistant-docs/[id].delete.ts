import { pbDelete, pbGetRecord, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã tài liệu' })

  const doc = await pbGetRecord<PbRecord>('assistant_docs', id)
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tài liệu' })

  await pbDelete('assistant_docs', id)
  return { ok: true }
})
