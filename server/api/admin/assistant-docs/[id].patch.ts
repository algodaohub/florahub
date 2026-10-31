import { pbGetRecord, pbUpdate, type PbRecord } from '~~/server/utils/pocketbase'
import { requireAdminMutation } from '~~/server/utils/admin'
import { toBool, toNumber, toText } from '~~/server/utils/admin-data'
import { toAdminDoc } from '~~/server/utils/assistant-docs'

export default defineEventHandler(async (event) => {
  await requireAdminMutation(event, { adminOnly: true })

  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Thiếu mã tài liệu' })

  const current = await pbGetRecord<PbRecord>('assistant_docs', id)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tài liệu' })

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}

  if (body?.title !== undefined) {
    const title = toText(body.title, 200)
    if (!title) throw createError({ statusCode: 400, statusMessage: 'Nhập tiêu đề tài liệu' })
    patch.title = title
  }
  if (body?.content !== undefined) {
    const content = toText(body.content, 20000)
    if (!content) throw createError({ statusCode: 400, statusMessage: 'Nhập nội dung tài liệu' })
    patch.content = content
  }
  if (body?.tags !== undefined) patch.tags = toText(body.tags, 300)
  if (body?.isActive !== undefined) patch.is_active = toBool(body.isActive)
  if (body?.forTraining !== undefined) patch.for_training = toBool(body.forTraining)
  if (body?.sortOrder !== undefined) patch.sort_order = toNumber(body.sortOrder, 0)

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Không có thay đổi để lưu' })
  }

  patch.updated_at = new Date().toISOString()
  const updated = await pbUpdate<PbRecord>('assistant_docs', id, patch)

  return { doc: toAdminDoc(updated) }
})
